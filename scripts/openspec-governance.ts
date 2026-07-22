import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const INDEX_FILE = "SPEC.md";
const REQUIRED_DIRECTORIES = [
  "openspec/specs",
  "openspec/changes/archive",
];

interface CapabilityReference {
  change: string;
  path: string;
}

interface Capability {
  name: string;
  canonical: string | null;
  archived: CapabilityReference[];
  active: CapabilityReference[];
}

type CapabilityBucket = "archived" | "active";

interface CheckProjectOptions {
  archiveStatus?: string;
}

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
        path: toPosix(path.relative(root, specFile)),
      });
    });
  });
}

export function collectCapabilities(root: string): Capability[] {
  const capabilities = new Map<string, Capability>();
  const canonicalRoot = path.join(root, "openspec", "specs");
  listDirectories(canonicalRoot).forEach((capabilityName) => {
    const specFile = path.join(canonicalRoot, capabilityName, "spec.md");
    if (!fs.existsSync(specFile)) return;
    ensureCapability(capabilities, capabilityName).canonical = toPosix(path.relative(root, specFile));
  });

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

  return Array.from(capabilities.values())
    .map((capability) => ({
      ...capability,
      archived: capability.archived.sort((left, right) => left.change.localeCompare(right.change, "en")),
      active: capability.active.sort((left, right) => left.change.localeCompare(right.change, "en")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function markdownLink(label: string, target: string): string {
  return `[${label}](${target})`;
}

function renderReference(reference: CapabilityReference | undefined): string {
  return reference ? markdownLink(reference.change, reference.path) : "-";
}

export function renderIndex(root: string): string {
  const capabilities = collectCapabilities(root);
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
      return `| ${current} | ${renderReference(first)} | ${renderReference(latest)} | ${active} |`;
    })
    : ["| _暂无已同步或活动的 capability_ | - | - | - |"];

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
    "4. 仅在处理回归、冲突或设计依据时读取历史归档。",
    "5. BR/PRD 定义目标与范围；可执行行为只存在于 specs。",
    "",
    "## Capability 导航",
    "",
    "| 当前规格 | 首次归档 change | 最新归档 change | 活动 changes |",
    "|---|---|---|---|",
    ...rows,
    "",
    "## 生命周期",
    "",
    "`apply -> verify -> feature -> sync/archive -> index -> check`",
    "",
    "归档不可修改。新 delta 可以向后链接历史 changes；旧归档永不增加正向链接。",
    "",
  ].join("\n");
}

export function findArchiveViolations(status: string): string[] {
  return status
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.split(/\s+/)[0].startsWith("A"));
}

export function checkStructure(root: string): void {
  const missing = REQUIRED_DIRECTORIES
    .filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
  if (missing.length > 0) {
    throw new Error(`项目缺少必要目录：${missing.join(", ")}`);
  }
}

export function checkIndex(root: string): void {
  const indexPath = path.join(root, INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    throw new Error("缺少 SPEC.md，请执行 index 命令。");
  }
  const expected = renderIndex(root).replace(/\r\n/g, "\n");
  const actual = fs.readFileSync(indexPath, "utf8").replace(/\r\n/g, "\n");
  if (actual !== expected) {
    throw new Error("SPEC.md 已过期，请执行 index 命令。");
  }
}

function readArchiveStatus(root: string): string {
  try {
    childProcess.execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void message;
    return "";
  }
  return childProcess.execFileSync(
    "git",
    ["diff", "--name-status", "HEAD", "--", "openspec/changes/archive"],
    { cwd: root, encoding: "utf8" },
  );
}

export function checkProject(root: string, options: CheckProjectOptions = {}): void {
  checkStructure(root);
  checkIndex(root);
  const status = options.archiveStatus === undefined
    ? readArchiveStatus(root)
    : options.archiveStatus;
  const violations = findArchiveViolations(status);
  if (violations.length > 0) {
    throw new Error([
      "已提交的 OpenSpec 归档历史不可修改：",
      ...violations.map((line) => `  ${line}`),
    ].join("\n"));
  }
}

export function writeIndex(root: string): void {
  fs.writeFileSync(path.join(root, INDEX_FILE), renderIndex(root), "utf8");
}

function main(): void {
  const command = process.argv[2];
  const root = process.cwd();
  if (command === "index") {
    writeIndex(root);
    process.stdout.write(`已更新 ${path.join(root, INDEX_FILE)}\n`);
    return;
  }
  if (command === "check") {
    checkProject(root);
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
