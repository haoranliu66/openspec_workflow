import fs from "node:fs";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument } from "./closeout-contract";
import { parseSharedPrdBinding } from "./closeout-trace";
import { parseSectionTable } from "./structured-markdown";

export interface SharedFeatureResultRecord {
  id: string;
  conclusion: string;
  evidenceIds: string[];
  versionOrDate: string;
  status: string;
}

const SHARED_FEATURE_HEADERS = ["Change", "结果 ID", "已交付结论", "Evidence IDs", "版本 / 日期", "状态"] as const;
const FEATURE_RESULT_ID = /^FR-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const EVIDENCE_ID = /^EV-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function parseSharedFeatureRows(
  content: string,
  sourcePath: string,
  changeId: string,
): { results: SharedFeatureResultRecord[]; diagnostics: CloseoutDiagnostic[] } {
  const table = parseSectionTable(content, "限制与变更", SHARED_FEATURE_HEADERS, sourcePath);
  if (table.diagnostics.length > 0) {
    return { results: [], diagnostics: table.diagnostics.map(sharedDiagnostic) };
  }

  const rows = table.rows.filter((row) => row.cells[0] === changeId);
  const diagnostics: CloseoutDiagnostic[] = [];
  if (rows.length === 0) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `missing ledger row for change: ${changeId}`));
    return { results: [], diagnostics };
  }

  const results: SharedFeatureResultRecord[] = [];
  const resultIds = new Set<string>();
  for (const row of rows) {
    const [, id, conclusion, evidenceCell, versionOrDate, status] = row.cells;
    if (!FEATURE_RESULT_ID.test(id)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `invalid result ID at line ${row.line}`));
    } else if (resultIds.has(id)) {
      diagnostics.push(diagnostic("FEATURE_TRACE_INVALID", sourcePath, `duplicate result ID at line ${row.line}`));
    }
    resultIds.add(id);
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
    if (versionOrDate.length === 0) {
      diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `missing version or date at line ${row.line}`));
    }
    if (status !== "ready") {
      diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", sourcePath, `ledger status must be ready at line ${row.line}`));
    }
    results.push({ id, conclusion, evidenceIds, versionOrDate, status });
  }
  return { results, diagnostics };
}

export function validateProductFeatureTrace(
  projectRoot: string,
  changeRoot: string,
  changeId: string,
  closeout: CloseoutDocument,
): CloseoutDiagnostic[] {
  const diagnostics: CloseoutDiagnostic[] = [];
  const changePrdPath = path.join(changeRoot, "prd.md");
  let bindingContent: string;
  try {
    bindingContent = fs.readFileSync(changePrdPath, "utf8");
  } catch {
    return [diagnostic("SHARED_FEATURE_INVALID", changePrdPath, "change PRD is missing or unreadable")];
  }

  const binding = parseSharedPrdBinding(bindingContent, changePrdPath);
  diagnostics.push(...binding.diagnostics.map(sharedDiagnostic));
  if (binding.path === undefined) {
    return diagnostics;
  }
  const sharedPrdPath = resolveProjectFile(projectRoot, binding.path);
  if (sharedPrdPath === undefined) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", changePrdPath, "shared PRD path is not a project-local file"));
    return diagnostics;
  }
  const sharedFeatureReference = path.join(path.dirname(binding.path), "FEATURE.md");
  const sharedFeaturePath = resolveProjectFile(projectRoot, sharedFeatureReference);
  if (sharedFeaturePath === undefined) {
    diagnostics.push(diagnostic("SHARED_FEATURE_INVALID", changePrdPath, "sibling shared FEATURE is missing or unreadable"));
    return diagnostics;
  }

  const parsed = parseSharedFeatureRows(fs.readFileSync(sharedFeaturePath, "utf8"), sharedFeaturePath, changeId);
  diagnostics.push(...parsed.diagnostics);
  const evidenceById = new Map(closeout.evidence.map((evidence) => [evidence.id, evidence]));
  for (const result of parsed.results) {
    for (const evidenceId of result.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (evidence === undefined || evidence.status !== "passed") {
        diagnostics.push(diagnostic(
          "FEATURE_TRACE_INVALID",
          sharedFeaturePath,
          `result ${result.id} references missing or unsuccessful evidence: ${evidenceId}`,
        ));
      }
    }
  }
  return diagnostics;
}

function splitIds(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function resolveProjectFile(projectRoot: string, relativePath: string): string | undefined {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
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

function sharedDiagnostic(entry: CloseoutDiagnostic): CloseoutDiagnostic {
  return { ...entry, code: "SHARED_FEATURE_INVALID" };
}

function diagnostic(code: string, sourcePath: string, message: string): CloseoutDiagnostic {
  return { code, path: sourcePath, message };
}
