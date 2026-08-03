import fs from "node:fs";
import path from "node:path";

import { collectChangeHistory, renderChangeHistory } from "./change-history";
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
  retired: string[];
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
  {
    sourcePath: "dist/scripts/validate-schemas.js",
    targetPath: "scripts/validate-schemas.js",
  },
  {
    sourcePath: "dist/scripts/validate-changes.js",
    targetPath: "scripts/validate-changes.js",
  },
  {
    sourcePath: "dist/bin/workflow.js",
    targetPath: "bin/workflow.js",
  },
  {
    sourcePath: "dist/lib/openspec-cli.js",
    targetPath: "lib/openspec-cli.js",
  },
  {
    sourcePath: "dist/lib/project-root.js",
    targetPath: "lib/project-root.js",
  },
  {
    sourcePath: "dist/lib/schema-alignment.js",
    targetPath: "lib/schema-alignment.js",
  },
  {
    sourcePath: "dist/lib/change-history.js",
    targetPath: "lib/change-history.js",
  },
  {
    sourcePath: "dist/lib/close-workflow.js",
    targetPath: "lib/close-workflow.js",
  },
  {
    sourcePath: "dist/lib/installer.js",
    targetPath: "lib/installer.js",
  },
  { sourcePath: "docs/FULLSTACK_WORKFLOW.md", targetPath: "docs/FULLSTACK_WORKFLOW.md" },
  { sourcePath: "docs/QUALITY_GATES.md", targetPath: "docs/QUALITY_GATES.md" },
];

const REQUIRED_DIRECTORIES = [
  "openspec/schemas/bugfix",
  "openspec/schemas/product-change",
  "docs/requirements/_templates",
];

const RETIRED_MANAGED_FILES = [
  "scripts/validate-close.js",
  "lib/closeout-contract.js",
  "lib/structured-markdown.js",
  "lib/closeout-p0.js",
  "lib/closeout-trace.js",
  "lib/closeout-feature.js",
  "lib/closeout-validation.js",
  "docs/closeout-templates/product-change.json",
  "docs/closeout-templates/bugfix.json",
  "docs/closeout-templates/spec-driven.json",
] as const;

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

function readSourceVersion(sourceRoot: string): string {
  const packagePath = path.join(sourceRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error("工作流源 package.json 缺失。");
  }

  let content: string;
  try {
    content = fs.readFileSync(packagePath, "utf8");
  } catch {
    throw new Error("工作流源 package.json 无法读取。");
  }

  let metadata: unknown;
  try {
    metadata = JSON.parse(content);
  } catch {
    throw new Error("工作流源 package.json 不是有效 JSON。");
  }
  if (typeof metadata !== "object" || metadata === null
    || !("version" in metadata) || typeof metadata.version !== "string"
    || metadata.version.trim() === "") {
    throw new Error("工作流源 package.json 的 version 必须是非空字符串。");
  }
  return metadata.version;
}

function readPreviousManagedFiles(targetRoot: string): Set<string> {
  const manifestPath = path.join(targetRoot, ".ai-workflow.json");
  if (!fs.existsSync(manifestPath)) return new Set();

  let metadata: unknown;
  try {
    metadata = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error("现有 .ai-workflow.json 不是有效 JSON，本次未修改任何文件。");
  }
  if (typeof metadata !== "object" || metadata === null
    || !("managedFiles" in metadata) || !Array.isArray(metadata.managedFiles)
    || !metadata.managedFiles.every((entry) => typeof entry === "string")) {
    throw new Error("现有 .ai-workflow.json 的 managedFiles 必须是字符串数组，本次未修改任何文件。");
  }
  return new Set(metadata.managedFiles);
}

export function installWorkflow(
  sourceRoot: string,
  targetRoot: string,
  options: InstallOptions = {},
): InstallResult {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  if (!fs.existsSync(source)) throw new Error(`源仓库不存在：${source}`);
  const version = readSourceVersion(source);
  const previousManagedFiles = readPreviousManagedFiles(target);

  const operations = buildOperations(source, target);
  const sourceConflicts = operations
    .filter((operation) => {
      const targetPath = path.join(target, operation.relativePath);
      return fs.existsSync(targetPath) && !sameContent(targetPath, operation.content);
    })
    .map((operation) => operation.relativePath);

  if (sourceConflicts.length > 0 && !options.force) {
    throw new Error(`发现冲突的工作流文件，本次未修改任何文件：\n${sourceConflicts.join("\n")}`);
  }

  const model = collectChangeHistory(target);
  const generatedOperations: FileOperation[] = [
    { relativePath: "SPEC.md", content: Buffer.from(renderIndex(target, model), "utf8") },
    {
      relativePath: "openspec/change-history.json",
      content: Buffer.from(renderChangeHistory(model), "utf8"),
    },
  ];
  const managedOperations = [...operations, ...generatedOperations]
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  const generatedConflicts = generatedOperations
    .filter((operation) => {
      const targetPath = path.join(target, operation.relativePath);
      return fs.existsSync(targetPath) && !sameContent(targetPath, operation.content);
    })
    .map((operation) => operation.relativePath);
  const conflicts = [...sourceConflicts, ...generatedConflicts];
  if (conflicts.length > 0 && !options.force) {
    throw new Error(`发现冲突的工作流文件，本次未修改任何文件：\n${conflicts.join("\n")}`);
  }

  const result: InstallResult = {
    copied: [],
    skipped: [],
    conflicts: [],
    backedUp: [],
    retired: [],
  };
  fs.mkdirSync(target, { recursive: true });
  const backupStamp = options.backupStamp || new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(target, ".ai-workflow-backup", backupStamp);

  if (options.force) {
    conflicts.forEach((relativePath) => {
      result.backedUp.push(backupFile(target, relativePath, backupRoot));
    });
  }

  const retiredPaths = RETIRED_MANAGED_FILES.filter((relativePath) => (
    previousManagedFiles.has(relativePath)
    && fs.existsSync(path.join(target, relativePath))
  ));
  retiredPaths.forEach((relativePath) => {
    result.backedUp.push(backupFile(target, relativePath, backupRoot));
  });

  managedOperations.forEach((operation) => {
    const targetPath = path.join(target, operation.relativePath);
    if (sameContent(targetPath, operation.content)) {
      result.skipped.push(operation.relativePath);
      return;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, operation.content);
    result.copied.push(operation.relativePath);
  });

  retiredPaths.forEach((relativePath) => {
    fs.unlinkSync(path.join(target, relativePath));
    result.retired.push(relativePath);
  });
  const retiredTemplateDirectory = path.join(target, "docs", "closeout-templates");
  if (fs.existsSync(retiredTemplateDirectory)
    && fs.readdirSync(retiredTemplateDirectory).length === 0) {
    fs.rmdirSync(retiredTemplateDirectory);
  }

  const manifestPath = path.join(target, ".ai-workflow.json");
  const manifest = `${JSON.stringify({
    version,
    managedFiles: managedOperations.map((operation) => operation.relativePath).sort(),
  }, null, 2)}\n`;
  if (sameContent(manifestPath, Buffer.from(manifest))) {
    result.skipped.push(".ai-workflow.json");
  } else {
    fs.writeFileSync(manifestPath, manifest, "utf8");
    result.copied.push(".ai-workflow.json");
  }

  return result;
}
