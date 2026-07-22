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
  deltaSpec: string;
  requirements: RequirementChange[];
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
  version: 1;
  changes: ChangeRecord[];
  diagnostics: Diagnostic[];
}

const KNOWN_SCHEMAS = new Set(["bugfix", "product-change"]);
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

function requirementFromHeading(operation: DeltaOperation, heading: string): RequirementChange {
  const [firstToken, ...remaining] = heading.trim().split(/\s+/);
  if (REQUIREMENT_ID.test(firstToken)) {
    return {
      operation,
      id: firstToken,
      name: remaining.join(" "),
    };
  }
  return { operation, id: null, name: heading.trim() };
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
    requirements.push({
      operation: "RENAMED",
      id: null,
      name: `${pendingRename} -> ${marker.value}`,
      from: pendingRename,
      to: marker.value,
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

function archiveDate(directoryName: string): string | null {
  return directoryName.match(/^(\d{4}-\d{2}-\d{2})(?:-|$)/)?.[1] ?? null;
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
  diagnostics: Diagnostic[],
): ChangeRecord {
  const changeDirectory = state === "active" ? directoryName : `archive/${directoryName}`;
  const changeRoot = path.join(root, "openspec", "changes", ...changeDirectory.split("/"));
  const schema = schemaName(changeRoot);
  if (!KNOWN_SCHEMAS.has(schema)) {
    diagnostics.push({
      severity: state === "active" ? "error" : "warning",
      message: `${state === "active" ? "Active" : "Archived"} change ${directoryName} has unknown schema ${schema}`,
    });
  }
  return {
    changeId: directoryName,
    directoryName,
    state,
    archiveDate: state === "archived" ? archiveDate(directoryName) : null,
    schema,
    paths: artifactPaths(root, changeDirectory),
    capabilities: collectCapabilities(root, changeDirectory),
  };
}

export function collectChangeHistory(root: string): ChangeHistory {
  const diagnostics: Diagnostic[] = [];
  const changesRoot = path.join(root, "openspec", "changes");
  const active = directDirectories(changesRoot)
    .filter((directory) => directory !== "archive")
    .sort(compareEnglish)
    .map((directory) => collectRecord(root, directory, "active", diagnostics));
  const archived = directDirectories(path.join(changesRoot, "archive"))
    .sort(compareEnglish)
    .map((directory) => collectRecord(root, directory, "archived", diagnostics));

  return { version: 1, changes: [...active, ...archived], diagnostics };
}

export function renderChangeHistory(model: ChangeHistory): string {
  return `${JSON.stringify({ version: model.version, changes: model.changes }, null, 2)}\n`;
}
