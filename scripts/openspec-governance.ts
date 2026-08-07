import fs from "node:fs";
import path from "node:path";

import {
  collectChangeHistory,
  renderChangeHistory,
  type ChangeHistory,
  type Diagnostic,
} from "../lib/change-history";

const INDEX_FILE = "SPEC.md";
const HISTORY_FILE = "openspec/change-history.json";
const REQUIRED_DIRECTORIES = [
  "openspec/specs",
  "openspec/changes/archive",
];

interface CapabilityReference {
  change: string;
  path: string | null;
}

interface Capability {
  name: string;
  canonical: string | null;
  archived: CapabilityReference[];
  active: CapabilityReference[];
}

type CapabilityBucket = "archived" | "active";

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function listDirectories(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function ensureCapability(capabilities: Map<string, Capability>, name: string): Capability {
  const existing = capabilities.get(name);
  if (existing) return existing;
  const capability: Capability = {
    name,
    canonical: null,
    archived: [],
    active: [],
  };
  capabilities.set(name, capability);
  return capability;
}

function collectChangeSpecs(
  root: string,
  changesRoot: string,
  bucket: CapabilityBucket,
  capabilities: Map<string, Capability>,
): void {
  listDirectories(changesRoot).forEach((change) => {
    const specsRoot = path.join(changesRoot, change, "specs");
    listDirectories(specsRoot).forEach((capabilityName) => {
      const specFile = path.join(specsRoot, capabilityName, "spec.md");
      if (!fs.existsSync(specFile)) return;
      ensureCapability(capabilities, capabilityName)[bucket].push({
        change,
        path: bucket === "active" ? toPosix(path.relative(root, specFile)) : null,
      });
    });
  });
}

export function collectCapabilities(root: string, model?: ChangeHistory): Capability[] {
  const capabilities = new Map<string, Capability>();
  const canonicalRoot = path.join(root, "openspec", "specs");
  listDirectories(canonicalRoot).forEach((capabilityName) => {
    const specFile = path.join(canonicalRoot, capabilityName, "spec.md");
    if (!fs.existsSync(specFile)) return;
    ensureCapability(capabilities, capabilityName).canonical = toPosix(path.relative(root, specFile));
  });

  if (model === undefined) {
    collectChangeSpecs(
      root,
      path.join(root, "openspec", "changes", "archive"),
      "archived",
      capabilities,
    );

    const activeRoot = path.join(root, "openspec", "changes");
    listDirectories(activeRoot)
      .filter((change) => change !== "archive")
      .forEach((change) => {
        const specsRoot = path.join(activeRoot, change, "specs");
        listDirectories(specsRoot).forEach((capabilityName) => {
          const specFile = path.join(specsRoot, capabilityName, "spec.md");
          if (!fs.existsSync(specFile)) return;
          ensureCapability(capabilities, capabilityName).active.push({
            change,
            path: toPosix(path.relative(root, specFile)),
          });
        });
      });
  } else {
    model.changes.forEach((change) => {
      const bucket: CapabilityBucket = change.state === "active" ? "active" : "archived";
      change.capabilities.forEach((capability) => {
        ensureCapability(capabilities, capability.name)[bucket].push({
          change: change.directoryName,
          path: bucket === "active" ? capability.deltaSpec : null,
        });
      });
    });
  }

  return Array.from(capabilities.values())
    .map((capability) => ({
      ...capability,
      archived: capability.archived.sort((left, right) => left.change.localeCompare(right.change, "en")),
      active: capability.active.sort((left, right) => left.change.localeCompare(right.change, "en")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function isWorkflowSourceRepository(root: string): boolean {
  const packageFile = path.join(root, "package.json");
  if (!fs.existsSync(packageFile)) return false;
  try {
    const metadata = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { name?: unknown };
    return metadata.name === "ai-fullstack-openspec-workflow";
  } catch {
    return false;
  }
}

function escapeTableCell(value: string): string {
  return value.replace(/\r?\n|\r/g, "<br>").replace(/\|/g, "\\|");
}

function escapeLinkLabel(label: string): string {
  return label
    .replace(/\r?\n|\r/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/]/g, "\\]");
}

function escapeLinkTarget(target: string): string {
  return target.split("/").map((segment) => encodeURIComponent(segment)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function markdownLink(label: string, target: string): string {
  return `[${escapeLinkLabel(label)}](${escapeLinkTarget(target)})`;
}

function renderReference(reference: CapabilityReference | undefined): string {
  if (reference === undefined) return "-";
  return reference.path === null
    ? escapeLinkLabel(reference.change)
    : markdownLink(reference.change, reference.path);
}

function renderActiveChange(change: ChangeHistory["changes"][number]): string {
  const capabilities = change.capabilities.length > 0
    ? change.capabilities
      .map((capability) => capability.deltaSpec === null
        ? escapeLinkLabel(capability.name)
        : markdownLink(capability.name, capability.deltaSpec))
      .join("<br>")
    : "-";
  const artifacts: string[] = [];
  Object.entries(change.paths).forEach(([name, artifactPath]) => {
    if (artifactPath !== null) {
      artifacts.push(markdownLink(`${name}.md`, artifactPath));
    }
  });
  return [
    markdownLink(change.changeId, `openspec/changes/${change.directoryName}/`),
    change.schema,
    capabilities,
    artifacts.length > 0 ? artifacts.join("<br>") : "-",
  ].map(escapeTableCell).join(" | ").replace(/^/, "| ").concat(" |");
}

export function renderIndex(root: string, model?: ChangeHistory): string {
  const history = model ?? collectChangeHistory(root);
  const sourceRepository = isWorkflowSourceRepository(root);
  const capabilities = sourceRepository ? [] : collectCapabilities(root, history);
  const rows = capabilities.length > 0
    ? capabilities.map((capability) => {
      const first = capability.archived[0];
      const latest = capability.archived[capability.archived.length - 1];
      const current = capability.canonical
        ? markdownLink(capability.name, capability.canonical)
        : `${capability.name} (pending sync)`;
      const active = capability.active.length > 0
        ? capability.active.map(renderReference).join("<br>")
        : "-";
      return [
        current,
        renderReference(first),
        renderReference(latest),
        active,
      ].map(escapeTableCell).join(" | ").replace(/^/, "| ").concat(" |");
    })
    : [sourceRepository
      ? "| _暂无_ | - | - | - |"
      : "| _暂无已同步或活动的 capability_ | - | - | - |"];

  const activeRows = (sourceRepository ? [] : history.changes)
    .filter((change) => change.state === "active")
    .map(renderActiveChange);

  return [
    "# AI 全栈规格索引",
    "",
    "> 源仓库使用 `npm run index`，已安装目标使用 `node scripts/openspec-governance.js index`；本文件自动生成，请勿手工编辑。",
    "",
    "## AI 最小上下文顺序",
    "",
    "1. 使用本索引定位受影响 capabilities。",
    "2. 只读取 `openspec/specs/` 下受影响的当前规格。",
    "3. 读取修改相同 capabilities 的活动 changes。",
    "4. 需要 Requirement 级演变时读取 `openspec/change-history.json`；详细本地归档是可选记录，公开克隆通常不包含。",
    "5. BR/PRD 定义目标与范围；其前置完成属于团队流程治理，不是 OpenSpec artifact graph 或程序门禁。",
    "",
    "## 活动 Change",
    "",
    "详细历史与 Requirement 变更请查 `openspec/change-history.json`。",
    "",
    "| Change | Schema | Capabilities | Existing artifacts |",
    "|---|---|---|---|",
    ...(activeRows.length > 0 ? activeRows : ["| _暂无活动 Change_ | - | - | - |"]),
    "",
    "## Capability 导航",
    "",
    "| 当前规格 | 首次归档 change | 最新归档 change | 活动 changes |",
    "|---|---|---|---|",
    ...rows,
    "",
    "## 生命周期",
    "",
    "Product change: `planning -> implementation authorization -> apply -> change-local verification -> shared FEATURE/team review -> close authorization -> workflow close (strict/archive/index/check)`",
    "",
    "Bugfix / system-change: `planning -> implementation authorization -> apply -> change-local verification/team review -> close authorization -> workflow close (strict/archive/index/check)`",
    "",
    "归档内容按团队流程不得修改；该规则不由程序或 CI 强制证明。公开历史使用无路径摘要，不依赖详细归档目录。",
    "",
  ].join("\n");
}

export function checkStructure(root: string): void {
  const missing = REQUIRED_DIRECTORIES
    .filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
  if (missing.length > 0) {
    throw new Error(`项目缺少必要目录：${missing.join(", ")}`);
  }
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function errorDiagnostics(model: ChangeHistory): Diagnostic[] {
  return model.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

export function checkIndex(root: string): void {
  const indexPath = path.join(root, INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    throw new Error("缺少 SPEC.md，请执行 index 命令。");
  }
  const expected = normalizeLineEndings(renderIndex(root));
  const actual = normalizeLineEndings(fs.readFileSync(indexPath, "utf8"));
  if (actual !== expected) {
    throw new Error("SPEC.md 已过期，请执行 index 命令。");
  }
}

function validateGeneratedFiles(root: string, model: ChangeHistory): void {
  const errors = errorDiagnostics(model);
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.message).join("\n"));
  }

  const indexPath = path.join(root, INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    throw new Error("缺少 SPEC.md，请执行 index 命令。");
  }
  const historyPath = path.join(root, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    throw new Error("缺少 openspec/change-history.json，请执行 index 命令。");
  }

  const expectedIndex = normalizeLineEndings(renderIndex(root, model));
  const actualIndex = normalizeLineEndings(fs.readFileSync(indexPath, "utf8"));
  if (actualIndex !== expectedIndex) {
    throw new Error("SPEC.md 已过期，请执行 index 命令。");
  }

  const expectedHistory = normalizeLineEndings(renderChangeHistory(model));
  const actualHistory = normalizeLineEndings(fs.readFileSync(historyPath, "utf8"));
  if (actualHistory !== expectedHistory) {
    throw new Error("change-history.json 已过期，请执行 index 命令。");
  }
}

export function checkGeneratedFiles(root: string): void {
  const model = collectChangeHistory(root);
  validateGeneratedFiles(root, model);
}

export function checkProject(root: string): Diagnostic[] {
  checkStructure(root);
  const model = collectChangeHistory(root);
  validateGeneratedFiles(root, model);
  return model.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
}

function writeFileAtomic(filePath: string, content: string): void {
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporary, content, "utf8");
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function writeGeneratedFiles(root: string): void {
  const model = collectChangeHistory(root);
  writeFileAtomic(path.join(root, INDEX_FILE), renderIndex(root, model));
  writeFileAtomic(path.join(root, HISTORY_FILE), renderChangeHistory(model));
}

export function writeIndex(root: string): void {
  writeGeneratedFiles(root);
}

function main(): void {
  const command = process.argv[2];
  const root = process.cwd();
  if (command === "index") {
    writeGeneratedFiles(root);
    process.stdout.write(`已更新 ${path.join(root, INDEX_FILE)} 和 ${path.join(root, HISTORY_FILE)}\n`);
    return;
  }
  if (command === "check") {
    const warnings = checkProject(root);
    warnings.forEach((warning) => {
      process.stderr.write(`WARNING: ${warning.message}\n`);
    });
    process.stdout.write("AI 工作流治理检查通过。\n");
    return;
  }
  throw new Error("用法：node scripts/openspec-governance.js <index|check>");
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
