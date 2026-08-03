import fs from "node:fs";
import path from "node:path";

export type DeltaOperation = "ADDED" | "MODIFIED" | "REMOVED" | "RENAMED";

export interface RequirementChange {
  operation: DeltaOperation;
  id: string | null;
  name: string;
  from?: string;
  to?: string;
}

export interface CapabilityChange {
  name: string;
  canonicalSpec: string;
  deltaSpec: string | null;
  requirements: RequirementChange[];
}

export interface ArchivedCapabilitySummary {
  name: string;
  requirements: Array<Pick<RequirementChange, "operation" | "id" | "name">>;
}

export interface ArchivedChangeSummary {
  changeId: string;
  archiveDate: string | null;
  schema: string;
  capabilities: ArchivedCapabilitySummary[];
}

export interface ChangeRecord {
  changeId: string;
  directoryName: string;
  state: "active" | "archived";
  archiveDate: string | null;
  schema: string;
  paths: Record<"br" | "prd" | "proposal" | "design" | "tasks" | "feature", string | null>;
  capabilities: CapabilityChange[];
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
}

export interface ChangeHistory {
  version: 2;
  changes: ChangeRecord[];
  diagnostics: Diagnostic[];
}

const KNOWN_SCHEMAS = new Set(["bugfix", "product-change", "spec-driven"]);
const OPERATIONS = new Set<DeltaOperation>(["ADDED", "MODIFIED", "REMOVED", "RENAMED"]);
const REQUIREMENT_ID = /^[A-Z][A-Z0-9]*-\d+$/;
const PATHS: Record<keyof ChangeRecord["paths"], string> = {
  br: "br.md",
  prd: "prd.md",
  proposal: "proposal.md",
  design: "design.md",
  tasks: "tasks.md",
  feature: "feature.md",
};

function compareEnglish(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function toRelativePath(...parts: string[]): string {
  return path.posix.join(...parts);
}

function requirementIdentity(heading: string): Pick<RequirementChange, "id" | "name"> {
  const [firstToken, ...remaining] = heading.trim().split(/\s+/);
  if (REQUIREMENT_ID.test(firstToken)) {
    return {
      id: firstToken,
      name: remaining.join(" "),
    };
  }
  return { id: null, name: heading.trim() };
}

function requirementFromHeading(operation: DeltaOperation, heading: string): RequirementChange {
  return { operation, ...requirementIdentity(heading) };
}

function renamedMarker(line: string): { marker: "FROM" | "TO"; value: string } | undefined {
  const match = line.match(
    /^\s*(?:[-*+]\s*)?(?:\*\*(FROM|TO)\s*:\*\*\s*(.*)|\*\*(FROM|TO)\s*\*\*\s*:\s*(.*)|(FROM|TO)\s*:\s*(.*))\s*$/,
  );
  if (match === null) return undefined;

  const marker = (match[1] ?? match[3] ?? match[5]) as "FROM" | "TO";
  const rawValue = (match[2] ?? match[4] ?? match[6]).trim();
  const value = rawValue.match(/^`(.*)`$/)?.[1] ?? rawValue;
  return { marker, value };
}

function sortRequirements(requirements: RequirementChange[]): RequirementChange[] {
  return requirements.sort((left, right) => {
    const nameOrder = compareEnglish(left.name, right.name);
    if (nameOrder !== 0) return nameOrder;
    const operationOrder = compareEnglish(left.operation, right.operation);
    if (operationOrder !== 0) return operationOrder;
    return compareEnglish(left.id ?? "", right.id ?? "");
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seedError(message: string): Error {
  return new Error(`openspec/change-history.json ${message}`);
}

function normalizeRequirement(value: unknown): RequirementChange {
  if (!isObject(value)
    || typeof value.operation !== "string"
    || !OPERATIONS.has(value.operation as DeltaOperation)
    || (value.id !== null && typeof value.id !== "string")
    || typeof value.name !== "string"
    || value.name.trim() === "") {
    throw seedError("包含无效的 Requirement 摘要。");
  }
  return {
    operation: value.operation as DeltaOperation,
    id: value.id,
    name: value.name,
  };
}

function normalizeCapabilities(value: unknown): ArchivedCapabilitySummary[] {
  if (!Array.isArray(value)) {
    throw seedError("中的 capabilities 必须是数组。");
  }
  return value.map((capability) => {
    if (!isObject(capability)
      || typeof capability.name !== "string"
      || capability.name.trim() === ""
      || !Array.isArray(capability.requirements)) {
      throw seedError("包含无效的 capability 摘要。");
    }
    return {
      name: capability.name,
      requirements: sortRequirements(capability.requirements.map(normalizeRequirement))
        .map(({ operation, id, name }) => ({ operation, id, name })),
    };
  }).sort((left, right) => compareEnglish(left.name, right.name));
}

function normalizeArchivedSummary(value: unknown): ArchivedChangeSummary {
  if (!isObject(value)
    || typeof value.changeId !== "string"
    || value.changeId.trim() === ""
    || (value.archiveDate !== null && typeof value.archiveDate !== "string")
    || (typeof value.archiveDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value.archiveDate))
    || typeof value.schema !== "string"
    || value.schema.trim() === "") {
    throw seedError("包含无效的 archived change 摘要。");
  }
  return {
    changeId: value.changeId,
    archiveDate: value.archiveDate,
    schema: value.schema,
    capabilities: normalizeCapabilities(value.capabilities),
  };
}

function readHistorySeed(root: string): ArchivedChangeSummary[] {
  const historyPath = path.join(root, "openspec", "change-history.json");
  if (!fs.existsSync(historyPath)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  } catch {
    throw seedError("不是有效 JSON；为避免历史丢失，未生成新索引。");
  }
  if (!isObject(parsed) || (parsed.version !== 1 && parsed.version !== 2)) {
    throw seedError("仅支持 version 1 或 version 2；为避免历史丢失，未生成新索引。");
  }
  if (!Array.isArray(parsed.changes)) {
    throw seedError("中的 changes 必须是数组。");
  }

  const archived = parsed.version === 1
    ? parsed.changes.flatMap((change) => {
      if (!isObject(change) || (change.state !== "active" && change.state !== "archived")) {
        throw seedError("包含无效的 version 1 change state。");
      }
      return change.state === "archived" ? [change] : [];
    })
    : parsed.changes;
  return archived.map(normalizeArchivedSummary);
}

export function parseDeltaSpec(content: string, sourcePath: string): RequirementChange[] {
  const requirements: RequirementChange[] = [];
  let operation: DeltaOperation | undefined;
  let pendingRename: string | undefined;

  const requireCompleteRename = (): void => {
    if (pendingRename !== undefined) {
      throw new Error(`Incomplete RENAMED Requirement in ${sourcePath}`);
    }
  };

  content.split(/\r?\n/).forEach((line) => {
    const secondLevel = line.match(/^##\s+(.+?)\s*$/);
    if (secondLevel !== null) {
      requireCompleteRename();
      const operationMatch = secondLevel[1].match(/^(ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/);
      const candidate = operationMatch?.[1] as DeltaOperation | undefined;
      operation = candidate !== undefined && OPERATIONS.has(candidate) ? candidate : undefined;
      return;
    }

    if (operation === undefined) return;

    const thirdLevel = line.match(/^###\s+Requirement:\s*(.*?)\s*$/);
    if (thirdLevel !== null) {
      requireCompleteRename();
      requirements.push(requirementFromHeading(operation, thirdLevel[1]));
      return;
    }

    if (operation !== "RENAMED") return;
    const marker = renamedMarker(line);
    if (marker === undefined) return;

    if (marker.marker === "FROM") {
      requireCompleteRename();
      pendingRename = marker.value;
      return;
    }

    if (pendingRename === undefined) {
      throw new Error(`Incomplete RENAMED Requirement in ${sourcePath}`);
    }
    const fromIdentity = requirementIdentity(pendingRename);
    const toIdentity = requirementIdentity(marker.value);
    const id = fromIdentity.id !== null && fromIdentity.id === toIdentity.id
      ? fromIdentity.id
      : null;
    const from = id === null ? pendingRename : fromIdentity.name;
    const to = id === null ? marker.value : toIdentity.name;
    requirements.push({
      operation: "RENAMED",
      id,
      name: `${from} -> ${to}`,
      from,
      to,
    });
    pendingRename = undefined;
  });

  requireCompleteRename();
  return requirements;
}

function directDirectories(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function containsFiles(directory: string): boolean {
  if (!fs.existsSync(directory)) return false;
  return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => (
    entry.isFile() || (entry.isDirectory() && containsFiles(path.join(directory, entry.name)))
  ));
}

function schemaName(changeRoot: string): string {
  const metadata = path.join(changeRoot, ".openspec.yaml");
  if (!fs.existsSync(metadata)) return "unknown";
  const content = fs.readFileSync(metadata, "utf8");
  return content.match(/^schema:\s*([a-z0-9-]+)\s*$/m)?.[1] ?? "unknown";
}

function artifactPaths(root: string, changeDirectory: string): ChangeRecord["paths"] {
  const changeRoot = path.join(root, "openspec", "changes", ...changeDirectory.split("/"));
  return Object.fromEntries(
    Object.entries(PATHS).map(([name, fileName]) => [
      name,
      fs.existsSync(path.join(changeRoot, fileName))
        ? toRelativePath("openspec", "changes", changeDirectory, fileName)
        : null,
    ]),
  ) as ChangeRecord["paths"];
}

function archiveIdentity(directoryName: string): { archiveDate: string | null; changeId: string } {
  const match = directoryName.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (match === null) {
    return { archiveDate: null, changeId: directoryName };
  }
  return {
    archiveDate: match[1],
    changeId: match[2],
  };
}

function collectCapabilities(root: string, changeDirectory: string): CapabilityChange[] {
  const changeRoot = path.join(root, "openspec", "changes", ...changeDirectory.split("/"));
  return directDirectories(path.join(changeRoot, "specs"))
    .filter((capability) => fs.existsSync(path.join(changeRoot, "specs", capability, "spec.md")))
    .sort(compareEnglish)
    .map((capability) => {
      const deltaSpec = toRelativePath("openspec", "changes", changeDirectory, "specs", capability, "spec.md");
      return {
        name: capability,
        canonicalSpec: toRelativePath("openspec", "specs", capability, "spec.md"),
        deltaSpec,
        requirements: sortRequirements(
          parseDeltaSpec(fs.readFileSync(path.join(root, ...deltaSpec.split("/")), "utf8"), deltaSpec),
        ),
      };
    });
}

function collectRecord(
  root: string,
  directoryName: string,
  state: ChangeRecord["state"],
): ChangeRecord {
  const changeDirectory = state === "active" ? directoryName : `archive/${directoryName}`;
  const changeRoot = path.join(root, "openspec", "changes", ...changeDirectory.split("/"));
  const archive = state === "archived" ? archiveIdentity(directoryName) : undefined;
  const schema = schemaName(changeRoot);
  return {
    changeId: archive?.changeId ?? directoryName,
    directoryName,
    state,
    archiveDate: archive?.archiveDate ?? null,
    schema,
    paths: artifactPaths(root, changeDirectory),
    capabilities: collectCapabilities(root, changeDirectory),
  };
}

function archiveKey(change: Pick<ChangeRecord, "archiveDate" | "changeId" | "schema">): string {
  return `${change.archiveDate ?? ""}\u0000${change.changeId}\u0000${change.schema}`;
}

function compareArchived(left: ChangeRecord, right: ChangeRecord): number {
  const dateOrder = compareEnglish(left.archiveDate ?? "", right.archiveDate ?? "");
  if (dateOrder !== 0) return dateOrder;
  const idOrder = compareEnglish(left.changeId, right.changeId);
  if (idOrder !== 0) return idOrder;
  return compareEnglish(left.schema, right.schema);
}

function recordFromSummary(summary: ArchivedChangeSummary): ChangeRecord {
  const directoryName = summary.archiveDate === null
    ? summary.changeId
    : `${summary.archiveDate}-${summary.changeId}`;
  return {
    changeId: summary.changeId,
    directoryName,
    state: "archived",
    archiveDate: summary.archiveDate,
    schema: summary.schema,
    paths: {
      br: null,
      prd: null,
      proposal: null,
      design: null,
      tasks: null,
      feature: null,
    },
    capabilities: summary.capabilities.map((capability) => ({
      name: capability.name,
      canonicalSpec: toRelativePath("openspec", "specs", capability.name, "spec.md"),
      deltaSpec: null,
      requirements: capability.requirements.map((requirement) => ({ ...requirement })),
    })),
  };
}

function archivedSummary(change: ChangeRecord): ArchivedChangeSummary {
  return {
    changeId: change.changeId,
    archiveDate: change.archiveDate,
    schema: change.schema,
    capabilities: change.capabilities.map((capability) => ({
      name: capability.name,
      requirements: sortRequirements(capability.requirements.map((requirement) => ({
        operation: requirement.operation,
        id: requirement.id,
        name: requirement.name,
      }))).map(({ operation, id, name }) => ({ operation, id, name })),
    })).sort((left, right) => compareEnglish(left.name, right.name)),
  };
}

export function collectChangeHistory(root: string): ChangeHistory {
  const changesRoot = path.join(root, "openspec", "changes");
  const active = directDirectories(changesRoot)
    .filter((directory) => directory !== "archive")
    .sort(compareEnglish)
    .map((directory) => collectRecord(root, directory, "active"));
  const localArchived = directDirectories(path.join(changesRoot, "archive"))
    .filter((directory) => containsFiles(path.join(changesRoot, "archive", directory)))
    .sort(compareEnglish)
    .map((directory) => collectRecord(root, directory, "archived"));

  const archivedByIdentity = new Map<string, ChangeRecord>();
  readHistorySeed(root).forEach((summary) => {
    const record = recordFromSummary(summary);
    archivedByIdentity.set(archiveKey(record), record);
  });
  localArchived.forEach((record) => archivedByIdentity.set(archiveKey(record), record));
  const archived = Array.from(archivedByIdentity.values()).sort(compareArchived);

  const changes = [...active, ...archived];
  const diagnostics: Diagnostic[] = changes
    .filter((change) => !KNOWN_SCHEMAS.has(change.schema))
    .map((change) => ({
      severity: change.state === "active" ? "error" : "warning",
      message: `${change.state === "active" ? "Active" : "Archived"} change ${change.directoryName} has unknown schema ${change.schema}`,
    }));

  return { version: 2, changes, diagnostics };
}

export function renderChangeHistory(model: ChangeHistory): string {
  const changes = model.changes
    .filter((change) => change.state === "archived")
    .sort(compareArchived)
    .map(archivedSummary);
  return `${JSON.stringify({ version: 2, changes }, null, 2)}\n`;
}
