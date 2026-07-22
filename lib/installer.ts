import fs from "node:fs";
import path from "node:path";

import { renderIndex } from "../scripts/openspec-governance";

export interface InstallOptions {
  force?: boolean;
  backupStamp?: string;
}

export interface InstallResult {
  copied: string[];
  skipped: string[];
  conflicts: string[];
  backedUp: string[];
}

interface ManagedSource {
  sourcePath: string;
  targetPath: string;
}

interface FileOperation {
  relativePath: string;
  content: Buffer;
}

const REQUIRED_FILES: ManagedSource[] = [
  {
    sourcePath: "dist/scripts/openspec-governance.js",
    targetPath: "scripts/openspec-governance.js",
  },
  { sourcePath: "docs/FULLSTACK_WORKFLOW.md", targetPath: "docs/FULLSTACK_WORKFLOW.md" },
  { sourcePath: "docs/QUALITY_GATES.md", targetPath: "docs/QUALITY_GATES.md" },
];

const REQUIRED_DIRECTORIES = [
  "openspec/schemas/bugfix",
  "openspec/schemas/product-change",
  "docs/requirements/_templates",
];

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function readFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

function sameContent(filePath: string, content: Buffer): boolean {
  return fs.existsSync(filePath) && Buffer.compare(readFile(filePath), content) === 0;
}

function listFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    });
}

export function buildOperations(sourceRoot: string, targetRoot: string): FileOperation[] {
  const managedSources: ManagedSource[] = [...REQUIRED_FILES];
  REQUIRED_DIRECTORIES.forEach((relativeDirectory) => {
    listFiles(path.join(sourceRoot, relativeDirectory)).forEach((sourcePath) => {
      const relativePath = toPosix(path.relative(sourceRoot, sourcePath));
      managedSources.push({ sourcePath: relativePath, targetPath: relativePath });
    });
  });

  const configTarget = path.join(targetRoot, "openspec", "config.yaml");
  managedSources.push({
    sourcePath: "openspec/config.yaml",
    targetPath: fs.existsSync(configTarget)
      ? "openspec/ai-workflow.config.example.yaml"
      : "openspec/config.yaml",
  });

  const operations = managedSources.map(({ sourcePath, targetPath }) => {
    const absoluteSourcePath = path.join(sourceRoot, sourcePath);
    if (!fs.existsSync(absoluteSourcePath)) {
      throw new Error(`工作流源文件缺失：${sourcePath}`);
    }
    return {
      relativePath: targetPath,
      content: readFile(absoluteSourcePath),
    };
  });

  operations.push(
    { relativePath: "openspec/specs/.gitkeep", content: Buffer.from("") },
    { relativePath: "openspec/changes/archive/.gitkeep", content: Buffer.from("") },
  );

  return operations.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

function backupFile(targetRoot: string, relativePath: string, backupRoot: string): string {
  const sourcePath = path.join(targetRoot, relativePath);
  const backupPath = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(sourcePath, backupPath);
  return toPosix(path.relative(targetRoot, backupPath));
}

export function installWorkflow(
  sourceRoot: string,
  targetRoot: string,
  options: InstallOptions = {},
): InstallResult {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  if (!fs.existsSync(source)) throw new Error(`源仓库不存在：${source}`);

  const operations = buildOperations(source, target);
  fs.mkdirSync(target, { recursive: true });
  const conflicts = operations
    .filter((operation) => {
      const targetPath = path.join(target, operation.relativePath);
      return fs.existsSync(targetPath) && !sameContent(targetPath, operation.content);
    })
    .map((operation) => operation.relativePath);

  const existingSpec = path.join(target, "SPEC.md");
  if (fs.existsSync(existingSpec)) {
    const specContent = fs.readFileSync(existingSpec, "utf8");
    if (!specContent.includes("# AI 全栈规格索引")) {
      conflicts.push("SPEC.md");
    }
  }

  if (conflicts.length > 0 && !options.force) {
    throw new Error(`发现冲突的工作流文件，本次未修改任何文件：\n${conflicts.join("\n")}`);
  }

  const result: InstallResult = {
    copied: [],
    skipped: [],
    conflicts: [],
    backedUp: [],
  };
  const backupStamp = options.backupStamp || new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(target, ".ai-workflow-backup", backupStamp);

  if (options.force) {
    conflicts.forEach((relativePath) => {
      result.backedUp.push(backupFile(target, relativePath, backupRoot));
    });
  }

  operations.forEach((operation) => {
    const targetPath = path.join(target, operation.relativePath);
    if (sameContent(targetPath, operation.content)) {
      result.skipped.push(operation.relativePath);
      return;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, operation.content);
    result.copied.push(operation.relativePath);
  });

  const specContent = Buffer.from(renderIndex(target), "utf8");
  if (sameContent(existingSpec, specContent)) {
    result.skipped.push("SPEC.md");
  } else {
    fs.writeFileSync(existingSpec, specContent);
    result.copied.push("SPEC.md");
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(source, "package.json"), "utf8"),
  ) as { version: string };
  const manifestPath = path.join(target, ".ai-workflow.json");
  const manifest = `${JSON.stringify({
    version: packageJson.version,
    managedFiles: operations.map((operation) => operation.relativePath).concat("SPEC.md").sort(),
  }, null, 2)}\n`;
  if (sameContent(manifestPath, Buffer.from(manifest))) {
    result.skipped.push(".ai-workflow.json");
  } else {
    fs.writeFileSync(manifestPath, manifest, "utf8");
    result.copied.push(".ai-workflow.json");
  }

  return result;
}
