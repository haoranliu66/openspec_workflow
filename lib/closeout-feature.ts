import fs from "node:fs";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument, FeatureResultTrace } from "./closeout-contract";
import { parseSectionTable } from "./structured-markdown";

export interface FeatureResultRecord {
  id: string;
  conclusion: string;
  evidenceIds: string[];
}

const FEATURE_HEADERS = ["结果 ID", "已交付结论", "Evidence IDs"] as const;
const SHARED_FEATURE_HEADERS = ["Change", "结果 IDs", "已交付切片", "版本 / 日期", "状态"] as const;
const FEATURE_RESULT_ID = /^FR-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const EVIDENCE_ID = /^EV-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function parseChangeFeatureResults(
  content: string,
  sourcePath: string,
): { results: FeatureResultRecord[]; diagnostics: CloseoutDiagnostic[] } {
  const table = parseSectionTable(content, "已交付结果", FEATURE_HEADERS, sourcePath);
  if (table.diagnostics.length > 0) {
    return { results: [], diagnostics: table.diagnostics.map(featureDiagnostic) };
  }

  const diagnostics: CloseoutDiagnostic[] = [];
  const results: FeatureResultRecord[] = [];
  const ids = new Set<string>();
  for (const row of table.rows) {
    const [id, conclusion, evidenceCell] = row.cells;
    if (!FEATURE_RESULT_ID.test(id)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `invalid result ID at line ${row.line}`));
    } else if (ids.has(id)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `duplicate result ID at line ${row.line}`));
    }
    ids.add(id);
    if (conclusion.length === 0) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `empty conclusion at line ${row.line}`));
    }
    const evidenceIds = splitIds(evidenceCell);
    if (evidenceIds.length === 0) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `missing evidence IDs at line ${row.line}`));
    }
    const references = new Set<string>();
    for (const evidenceId of evidenceIds) {
      if (!EVIDENCE_ID.test(evidenceId)) {
        diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `invalid evidence ID at line ${row.line}`));
      }
      if (references.has(evidenceId)) {
        diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `duplicate evidence ID at line ${row.line}`));
      }
      references.add(evidenceId);
    }
    results.push({ id, conclusion, evidenceIds });
  }
  return { results, diagnostics };
}

export function parseSharedFeatureRows(
  content: string,
  sourcePath: string,
  changeId: string,
): { resultIds: string[]; diagnostics: CloseoutDiagnostic[] } {
  const table = parseSectionTable(content, "限制与变更", SHARED_FEATURE_HEADERS, sourcePath);
  if (table.diagnostics.length > 0) {
    return { resultIds: [], diagnostics: table.diagnostics.map(sharedDiagnostic) };
  }

  const rows = table.rows.filter((row) => row.cells[0] === changeId);
  const diagnostics: CloseoutDiagnostic[] = [];
  if (rows.length === 0) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `missing ledger row for change: ${changeId}`));
    return { resultIds: [], diagnostics };
  }

  const resultIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.cells[4] !== "ready") {
      diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `ledger status must be ready at line ${row.line}`));
    }
    const rowResultIds = splitIds(row.cells[1]);
    if (rowResultIds.length === 0) {
      diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `ledger result IDs are missing at line ${row.line}`));
    }
    for (const resultId of rowResultIds) {
      if (!FEATURE_RESULT_ID.test(resultId)) {
        diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `invalid ledger result ID at line ${row.line}`));
      }
      if (!seen.has(resultId)) {
        seen.add(resultId);
        resultIds.push(resultId);
      }
    }
  }
  return { resultIds, diagnostics };
}

export function validateProductFeatureTrace(
  projectRoot: string,
  changeRoot: string,
  changeId: string,
  closeout: CloseoutDocument,
): CloseoutDiagnostic[] {
  const diagnostics: CloseoutDiagnostic[] = [];
  const closeoutPath = path.join(changeRoot, "closeout.json");
  const featurePath = path.join(changeRoot, "feature.md");
  const local = readChangeFeature(featurePath);
  diagnostics.push(...local.diagnostics);
  const localResults = new Map(local.results.map((result) => [result.id, new Set(result.evidenceIds)]));
  validateCloseoutFeatureResults(localResults, closeout.featureResults, closeout, closeoutPath, diagnostics);

  const sharedPath = resolveProjectFile(projectRoot, closeout.sharedFeature);
  if (sharedPath === undefined) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", closeoutPath, "shared FEATURE must be a project-local file"));
    return diagnostics;
  }
  const shared = parseSharedFeatureRows(fs.readFileSync(sharedPath, "utf8"), sharedPath, changeId);
  diagnostics.push(...shared.diagnostics);
  if (!covers(new Set(shared.resultIds), new Set(localResults.keys()))) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sharedPath, "ledger result IDs do not cover local FEATURE results"));
  }
  return diagnostics;
}

function readChangeFeature(featurePath: string): { results: FeatureResultRecord[]; diagnostics: CloseoutDiagnostic[] } {
  try {
    return parseChangeFeatureResults(fs.readFileSync(featurePath, "utf8"), featurePath);
  } catch {
    return { results: [], diagnostics: [diagnostic("FEATURE_TRACE_INVALID", featurePath, "change feature is missing or unreadable")] };
  }
}

function validateCloseoutFeatureResults(
  localResults: ReadonlyMap<string, ReadonlySet<string>>,
  featureResults: FeatureResultTrace[] | undefined,
  closeout: CloseoutDocument,
  sourcePath: string,
  diagnostics: CloseoutDiagnostic[],
): void {
  if (!Array.isArray(featureResults)) {
    diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "closeout feature results are missing"));
    return;
  }
  const evidenceById = new Map(closeout.evidence.map((evidence) => [evidence.id, evidence]));
  const closeoutResults = new Map<string, ReadonlySet<string>>();
  for (const result of featureResults) {
    if (closeoutResults.has(result.id)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "closeout repeats a feature result"));
      continue;
    }
    const evidenceIds = new Set(result.evidenceIds);
    if (evidenceIds.size !== result.evidenceIds.length) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "closeout repeats an evidence reference"));
    }
    for (const evidenceId of evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || evidence.status !== "passed") {
        diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "feature references missing or unsuccessful evidence"));
      }
    }
    closeoutResults.set(result.id, evidenceIds);
  }
  if (!sameSet(new Set(localResults.keys()), new Set(closeoutResults.keys()))) {
    diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "closeout result IDs do not match local FEATURE results"));
  }
  for (const [id, localEvidenceIds] of localResults) {
    const closeoutEvidenceIds = closeoutResults.get(id);
    if (closeoutEvidenceIds !== undefined && !sameSet(localEvidenceIds, closeoutEvidenceIds)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, "closeout evidence IDs do not match local FEATURE results"));
    }
  }
}

function splitIds(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function resolveProjectFile(projectRoot: string, relativePath: string | undefined): string | undefined {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    return undefined;
  }
  try {
    const realRoot = fs.realpathSync.native(projectRoot);
    const candidate = path.resolve(realRoot, relativePath);
    if (!isWithin(realRoot, candidate)) {
      return undefined;
    }
    const resolved = fs.realpathSync.native(candidate);
    return isWithin(realRoot, resolved) && fs.statSync(resolved).isFile() ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative.length > 0 && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function covers(available: ReadonlySet<string>, required: ReadonlySet<string>): boolean {
  return [...required].every((value) => available.has(value));
}

function featureDiagnostic(entry: CloseoutDiagnostic): CloseoutDiagnostic {
  return { ...entry, code: "FEATURE_TRACE_INVALID" };
}

function sharedDiagnostic(entry: CloseoutDiagnostic): CloseoutDiagnostic {
  return { ...entry, code: "SHARED_FEATURE_INVALID" };
}

function diagnostic(code: string, sourcePath: string, message: string): CloseoutDiagnostic {
  return { code, path: sourcePath, message };
}
