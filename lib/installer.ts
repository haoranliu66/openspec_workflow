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
  notices: string[];
}

interface ManagedSource {
  sourcePath: string;
  targetPath: string;
}

interface FileOperation {
  relativePath: string;
  content: Buffer;
}

const OPENSPEC_PACKAGE = "@fission-ai/openspec";
const OPENSPEC_VERSION = "1.8.0";
const OPENSPEC_RUNTIME_ROOT = ".ai-workflow/openspec-runtime/node_modules";

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
    sourcePath: "dist/bin/openspec.js",
    targetPath: "bin/openspec.js",
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
  { sourcePath: "docs/AI_WORKFLOW_AGENTS.md", targetPath: "docs/AI_WORKFLOW_AGENTS.md" },
  { sourcePath: "docs/AGENTS.root.example.md", targetPath: "AGENTS.ai-workflow.example.md" },
];

const ROOT_AGENTS_SOURCE = "docs/AGENTS.root.example.md";
const ROOT_AGENTS_TARGET = "AGENTS.md";

const REQUIRED_DIRECTORIES = [
  ".agents/skills",
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

function packagePath(parent: string, packageName: string): string {
  return path.join(parent, ...packageName.split("/"));
}

function resolveDependencyPackage(
  packageDirectory: string,
  packageName: string,
  sourceRoot: string,
): string | undefined {
  let cursor = packageDirectory;
  const boundary = path.dirname(sourceRoot);
  while (cursor !== boundary) {
    const candidate = packagePath(path.join(cursor, "node_modules"), packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return undefined;
}

function readPackageMetadata(packageDirectory: string): {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
} {
  const packageFile = path.join(packageDirectory, "package.json");
  const metadata = JSON.parse(fs.readFileSync(packageFile, "utf8")) as {
    name?: unknown;
    version?: unknown;
    dependencies?: unknown;
    optionalDependencies?: unknown;
  };
  if (typeof metadata.name !== "string" || typeof metadata.version !== "string") {
    throw new Error(`OpenSpec 运行时依赖包含无效 package.json：${packageFile}`);
  }
  const dependencies = typeof metadata.dependencies === "object" && metadata.dependencies !== null
    ? metadata.dependencies as Record<string, string>
    : {};
  const optionalDependencies = typeof metadata.optionalDependencies === "object"
    && metadata.optionalDependencies !== null
    ? metadata.optionalDependencies as Record<string, string>
    : {};
  return { name: metadata.name, version: metadata.version, dependencies, optionalDependencies };
}

function runtimePackageDirectories(sourceRoot: string): string[] {
  const nodeModulesRoot = path.join(sourceRoot, "node_modules");
  const entry = packagePath(nodeModulesRoot, OPENSPEC_PACKAGE);
  if (!fs.existsSync(path.join(entry, "package.json"))) {
    throw new Error(`缺少固定 OpenSpec 运行时，请先在工作流源仓库执行 npm ci：${entry}`);
  }

  const pending = [entry];
  const visited = new Map<string, string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    const relative = toPosix(path.relative(nodeModulesRoot, current));
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
      throw new Error(`OpenSpec 运行时依赖越出源仓库 node_modules：${current}`);
    }
    if (visited.has(relative)) continue;
    const metadata = readPackageMetadata(current);
    if (current === entry && metadata.name !== OPENSPEC_PACKAGE) {
      throw new Error(`OpenSpec 运行时入口包名无效：${metadata.name}`);
    }
    if (current === entry && metadata.version !== OPENSPEC_VERSION) {
      throw new Error(`OpenSpec 运行时版本必须为 ${OPENSPEC_VERSION}，实际为 ${metadata.version}`);
    }
    visited.set(relative, current);

    const dependencies = {
      ...metadata.dependencies,
      ...metadata.optionalDependencies,
    };
    Object.keys(dependencies).sort().forEach((dependency) => {
      const resolved = resolveDependencyPackage(current, dependency, sourceRoot);
      if (resolved !== undefined) pending.push(resolved);
    });
  }
  return Array.from(visited.entries())
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([, directory]) => directory);
}

function runtimeOperations(sourceRoot: string): FileOperation[] {
  const nodeModulesRoot = path.join(sourceRoot, "node_modules");
  return runtimePackageDirectories(sourceRoot).flatMap((packageDirectory) => {
    const packageRelative = toPosix(path.relative(nodeModulesRoot, packageDirectory));
    return listFiles(packageDirectory).map((sourcePath) => ({
      relativePath: path.posix.join(
        OPENSPEC_RUNTIME_ROOT,
        packageRelative,
        toPosix(path.relative(packageDirectory, sourcePath)),
      ),
      content: readFile(sourcePath),
    }));
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

  operations.push(...runtimeOperations(sourceRoot));

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
  const rootAgentsPath = path.join(target, ROOT_AGENTS_TARGET);
  const shouldSeedRootAgents = !fs.existsSync(rootAgentsPath);

  const operations = buildOperations(source, target);
  const rootAgentsContent = readFile(path.join(source, ROOT_AGENTS_SOURCE));
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
    notices: [],
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

  if (shouldSeedRootAgents) {
    fs.writeFileSync(rootAgentsPath, rootAgentsContent);
    result.copied.push(ROOT_AGENTS_TARGET);
    result.notices.push(
      "已创建项目自有 AGENTS.md；该文件不由工作流 manifest 管理，后续请由项目维护。",
    );
  } else {
    result.notices.push(
      "已保留现有 AGENTS.md；请审阅 AGENTS.ai-workflow.example.md 并将适用规则合入项目指引。",
    );
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
