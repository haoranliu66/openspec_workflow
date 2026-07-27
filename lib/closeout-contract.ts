export type CloseoutSchema = "product-change" | "bugfix";
export type GateName = "security" | "migration" | "browser" | "rollback";
export type EvidenceType =
  | "test" | "build" | "security" | "migration" | "browser"
  | "rollback" | "acceptance" | "monitoring" | "other";

export interface CloseoutDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  status: "passed";
  command: string;
  artifact: string;
}

export interface GateRecord {
  applicable: boolean;
  reason: string;
  evidenceIds: string[];
}

export interface RequirementTrace {
  id: string;
  acceptanceIds: string[];
}

export interface FeatureResultTrace {
  id: string;
  evidenceIds: string[];
}

export interface CloseoutDocument {
  version: 1;
  prd?: string;
  sharedFeature?: string;
  requirements?: RequirementTrace[];
  featureResults?: FeatureResultTrace[];
  evidence: EvidenceRecord[];
  gates: Record<GateName, GateRecord>;
}

export interface ParseCloseoutResult {
  document?: CloseoutDocument;
  diagnostics: CloseoutDiagnostic[];
}

const REQUIREMENT_ID = /^[A-Z][A-Z0-9]*-\d+$/;
const FEATURE_RESULT_ID = /^FR-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const EVIDENCE_ID = /^EV-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const GATE_NAMES = ["security", "migration", "browser", "rollback"] as const;
const EVIDENCE_TYPES = new Set<EvidenceType>([
  "test", "build", "security", "migration", "browser",
  "rollback", "acceptance", "monitoring", "other",
]);

type JsonRecord = Record<string, unknown>;

export function parseCloseoutJson(
  content: string,
  schema: CloseoutSchema,
  sourcePath: string,
): ParseCloseoutResult {
  const diagnostics: CloseoutDiagnostic[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    addDiagnostic(diagnostics, sourcePath, "document: invalid JSON");
    return { diagnostics };
  }

  if (!isRecord(parsed)) {
    addDiagnostic(diagnostics, sourcePath, "document: must be an object");
    return { diagnostics };
  }

  validateDocument(parsed, schema, sourcePath, diagnostics);
  return diagnostics.length === 0
    ? { document: parsed as unknown as CloseoutDocument, diagnostics }
    : { diagnostics };
}

function validateDocument(value: JsonRecord, schema: CloseoutSchema, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  rejectUnknownKeys(
    value,
    ["version", "prd", "sharedFeature", "requirements", "featureResults", "evidence", "gates"],
    "document",
    sourcePath,
    diagnostics,
  );
  requireLiteral(value, "version", 1, "document.version", sourcePath, diagnostics);

  if (schema === "product-change") {
    for (const field of ["prd", "sharedFeature", "requirements", "featureResults"] as const) {
      requireField(value, field, `document.${field}`, sourcePath, diagnostics);
    }
    validateNonEmptyString(value.prd, "document.prd", sourcePath, diagnostics);
    validateNonEmptyString(value.sharedFeature, "document.sharedFeature", sourcePath, diagnostics);
    validateRequirements(value.requirements, sourcePath, diagnostics);
    validateFeatureResults(value.featureResults, sourcePath, diagnostics);
  } else {
    for (const field of ["prd", "sharedFeature", "requirements", "featureResults"] as const) {
      if (Object.hasOwn(value, field)) {
        addDiagnostic(diagnostics, sourcePath, `document.${field}: is not allowed for bugfix`);
      }
    }
  }

  requireField(value, "evidence", "document.evidence", sourcePath, diagnostics);
  validateEvidence(value.evidence, sourcePath, diagnostics);
  requireField(value, "gates", "document.gates", sourcePath, diagnostics);
  validateGates(value.gates, sourcePath, diagnostics);
}

function validateRequirements(value: unknown, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, sourcePath, "document.requirements: must be an array");
    return;
  }
  validateUniqueRecords(value, "document.requirements", REQUIREMENT_ID, "requirement", sourcePath, diagnostics, (item, path) => {
    rejectUnknownKeys(item, ["id", "acceptanceIds"], path, sourcePath, diagnostics);
    validateIdentifier(item.id, REQUIREMENT_ID, `${path}.id`, "requirement ID", sourcePath, diagnostics);
    validateReferenceIds(item.acceptanceIds, `${path}.acceptanceIds`, sourcePath, diagnostics, false);
  });
}

function validateFeatureResults(value: unknown, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, sourcePath, "document.featureResults: must be an array");
    return;
  }
  validateUniqueRecords(value, "document.featureResults", FEATURE_RESULT_ID, "feature result", sourcePath, diagnostics, (item, path) => {
    rejectUnknownKeys(item, ["id", "evidenceIds"], path, sourcePath, diagnostics);
    validateIdentifier(item.id, FEATURE_RESULT_ID, `${path}.id`, "feature result ID", sourcePath, diagnostics);
    validateReferenceIds(item.evidenceIds, `${path}.evidenceIds`, sourcePath, diagnostics, true);
  });
}

function validateEvidence(value: unknown, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, sourcePath, "document.evidence: must be an array");
    return;
  }
  validateUniqueRecords(value, "document.evidence", EVIDENCE_ID, "evidence", sourcePath, diagnostics, (item, path) => {
    rejectUnknownKeys(item, ["id", "type", "status", "command", "artifact"], path, sourcePath, diagnostics);
    validateIdentifier(item.id, EVIDENCE_ID, `${path}.id`, "evidence ID", sourcePath, diagnostics);
    if (typeof item.type !== "string" || !EVIDENCE_TYPES.has(item.type as EvidenceType)) {
      addDiagnostic(diagnostics, sourcePath, `${path}.type: must be a supported evidence type`);
    }
    requireLiteral(item, "status", "passed", `${path}.status`, sourcePath, diagnostics);
    validateNonEmptyString(item.command, `${path}.command`, sourcePath, diagnostics);
    validateNonEmptyString(item.artifact, `${path}.artifact`, sourcePath, diagnostics);
  });
}

function validateGates(value: unknown, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (!isRecord(value)) {
    addDiagnostic(diagnostics, sourcePath, "document.gates: must be an object");
    return;
  }
  rejectUnknownKeys(value, GATE_NAMES, "document.gates", sourcePath, diagnostics);
  for (const name of GATE_NAMES) {
    const path = `document.gates.${name}`;
    requireField(value, name, path, sourcePath, diagnostics);
    const gate = value[name];
    if (!isRecord(gate)) {
      addDiagnostic(diagnostics, sourcePath, `${path}: must be an object`);
      continue;
    }
    rejectUnknownKeys(gate, ["applicable", "reason", "evidenceIds"], path, sourcePath, diagnostics);
    if (typeof gate.applicable !== "boolean") {
      addDiagnostic(diagnostics, sourcePath, `${path}.applicable: must be a boolean`);
    }
    validateNonEmptyString(gate.reason, `${path}.reason`, sourcePath, diagnostics);
    validateReferenceIds(gate.evidenceIds, `${path}.evidenceIds`, sourcePath, diagnostics, true);
    if (typeof gate.applicable === "boolean" && Array.isArray(gate.evidenceIds)) {
      if (gate.applicable && gate.evidenceIds.length === 0) {
        addDiagnostic(diagnostics, sourcePath, `${path}.evidenceIds: must be non-empty when applicable`);
      }
      if (!gate.applicable && gate.evidenceIds.length !== 0) {
        addDiagnostic(diagnostics, sourcePath, `${path}.evidenceIds: must be empty when not applicable`);
      }
    }
  }
}

function validateUniqueRecords(
  values: unknown[],
  path: string,
  pattern: RegExp,
  label: string,
  sourcePath: string,
  diagnostics: CloseoutDiagnostic[],
  validate: (item: JsonRecord, path: string) => void,
): void {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(value)) {
      addDiagnostic(diagnostics, sourcePath, `${itemPath}: must be an object`);
      return;
    }
    validate(value, itemPath);
    if (typeof value.id === "string" && pattern.test(value.id)) {
      if (ids.has(value.id)) {
        addDiagnostic(diagnostics, sourcePath, `${itemPath}.id: duplicate ${label} ID`);
      }
      ids.add(value.id);
    }
  });
}

function validateReferenceIds(value: unknown, path: string, sourcePath: string, diagnostics: CloseoutDiagnostic[], evidenceIds: boolean): void {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, sourcePath, `${path}: must be an array`);
    return;
  }
  const references = new Set<string>();
  value.forEach((reference, index) => {
    const referencePath = `${path}[${index}]`;
    const valid = evidenceIds
      ? typeof reference === "string" && EVIDENCE_ID.test(reference)
      : typeof reference === "string" && reference.trim().length > 0;
    if (!valid) {
      addDiagnostic(diagnostics, sourcePath, `${referencePath}: must be a valid ${evidenceIds ? "evidence ID" : "non-empty string"}`);
      return;
    }
    if (references.has(reference)) {
      addDiagnostic(diagnostics, sourcePath, `${referencePath}: duplicate reference`);
    }
    references.add(reference);
  });
}

function validateIdentifier(value: unknown, pattern: RegExp, path: string, label: string, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (typeof value !== "string" || !pattern.test(value)) {
    addDiagnostic(diagnostics, sourcePath, `${path}: must be a valid ${label}`);
  }
}

function validateNonEmptyString(value: unknown, path: string, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    addDiagnostic(diagnostics, sourcePath, `${path}: must be a non-empty string`);
  }
}

function requireField(value: JsonRecord, field: string, path: string, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (!Object.hasOwn(value, field)) {
    addDiagnostic(diagnostics, sourcePath, `${path}: is required`);
  }
}

function requireLiteral(value: JsonRecord, field: string, expected: unknown, path: string, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  if (value[field] !== expected) {
    addDiagnostic(diagnostics, sourcePath, `${path}: must equal ${JSON.stringify(expected)}`);
  }
}

function rejectUnknownKeys(value: JsonRecord, allowed: readonly string[], path: string, sourcePath: string, diagnostics: CloseoutDiagnostic[]): void {
  const allowedKeys = new Set<string>(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addDiagnostic(diagnostics, sourcePath, `${path}.${key}: is not allowed`);
    }
  }
}

function addDiagnostic(diagnostics: CloseoutDiagnostic[], sourcePath: string, message: string): void {
  diagnostics.push({ code: "CLOSEOUT_INVALID", path: sourcePath, message });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
