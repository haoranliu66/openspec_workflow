import fs from "node:fs";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument, RequirementTrace } from "./closeout-contract";
import { parseDeltaSpec } from "./change-history";
import { parseSectionTable, stripFencedCode } from "./structured-markdown";

export interface DeltaRequirementCollection {
  ids: string[];
  diagnostics: CloseoutDiagnostic[];
}

const REQUIREMENT_ID = /^[A-Z][A-Z0-9]*-\d+$/;
const PRD_HEADERS = ["验收 ID", "期望产品结果", "证据方式"] as const;

export function collectDeltaRequirementIds(changeRoot: string): DeltaRequirementCollection {
  const diagnostics: CloseoutDiagnostic[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const specsRoot = path.join(changeRoot, "specs");
  if (!fs.existsSync(specsRoot)) {
    return { ids, diagnostics };
  }

  const capabilities = fs.readdirSync(specsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(specsRoot, entry.name, "spec.md")))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const capability of capabilities) {
    const sourcePath = path.join(specsRoot, capability, "spec.md");
    let requirements;
    try {
      requirements = parseDeltaSpec(fs.readFileSync(sourcePath, "utf8"), sourcePath);
    } catch {
      diagnostics.push(diagnostic("REQUIREMENT_INVALID", sourcePath, "cannot parse delta requirements"));
      continue;
    }
    for (const requirement of requirements) {
      if (requirement.id === null) {
        diagnostics.push(diagnostic("REQUIREMENT_INVALID", sourcePath, "delta requirement lacks a stable ID"));
        continue;
      }
      if (seen.has(requirement.id)) {
        diagnostics.push(diagnostic("REQUIREMENT_INVALID", sourcePath, "duplicate delta requirement ID"));
        continue;
      }
      seen.add(requirement.id);
      ids.push(requirement.id);
    }
  }
  return { ids, diagnostics };
}

export function parseSharedPrdBinding(
  content: string,
  sourcePath: string,
): { path?: string; diagnostics: CloseoutDiagnostic[] } {
  const values = stripFencedCode(content).split("\n")
    .map((line) => /^\s*-\s+\*\*共享 PRD\*\*：`([^`]+)`\s*$/.exec(line)?.[1]);
  const bindings = values.filter((value): value is string => value !== undefined);
  if (bindings.length !== 1 || bindings[0].trim().length === 0) {
    return { diagnostics: [diagnostic("PRD_TRACE_INVALID", sourcePath, "shared PRD binding must occur exactly once")] };
  }
  return { path: bindings[0], diagnostics: [] };
}

export function parsePrdAcceptanceIds(
  content: string,
  sourcePath: string,
): { ids: string[]; diagnostics: CloseoutDiagnostic[] } {
  const table = parseSectionTable(content, "结果级验收", PRD_HEADERS, sourcePath);
  if (table.diagnostics.length > 0) {
    return {
      ids: [],
      diagnostics: table.diagnostics.map((entry) => diagnostic("PRD_TRACE_INVALID", entry.path, entry.message)),
    };
  }

  const ids: string[] = [];
  const diagnostics: CloseoutDiagnostic[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const id = row.cells[0];
    if (!REQUIREMENT_ID.test(id)) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, `invalid acceptance ID at line ${row.line}`));
      continue;
    }
    if (seen.has(id)) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, `duplicate acceptance ID at line ${row.line}`));
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return { ids, diagnostics };
}

export function validateProductRequirementTrace(
  projectRoot: string,
  changeRoot: string,
  closeout: CloseoutDocument,
): CloseoutDiagnostic[] {
  const delta = collectDeltaRequirementIds(changeRoot);
  const diagnostics = [...delta.diagnostics];
  const closeoutPath = path.join(changeRoot, "closeout.json");

  const changePrdPath = path.join(changeRoot, "prd.md");
  if (!fs.existsSync(changePrdPath)) {
    diagnostics.push(diagnostic("PRD_TRACE_INVALID", changePrdPath, "change PRD is missing"));
    return diagnostics;
  }
  const binding = parseSharedPrdBinding(fs.readFileSync(changePrdPath, "utf8"), changePrdPath);
  diagnostics.push(...binding.diagnostics);
  if (binding.path === undefined) {
    return diagnostics;
  }
  if (closeout.prd !== binding.path) {
    diagnostics.push(diagnostic("PRD_TRACE_INVALID", closeoutPath, "closeout PRD does not match change PRD binding"));
  }

  const sharedPrdPath = resolveProjectFile(projectRoot, binding.path);
  if (sharedPrdPath === undefined) {
    diagnostics.push(diagnostic("PRD_TRACE_INVALID", changePrdPath, "shared PRD path is not a project-local file"));
  }
  const acceptance = sharedPrdPath === undefined
    ? { ids: [], diagnostics: [] as CloseoutDiagnostic[] }
    : parsePrdAcceptanceIds(fs.readFileSync(sharedPrdPath, "utf8"), sharedPrdPath);
  diagnostics.push(...acceptance.diagnostics);

  validateRequirementMappings(delta.ids, closeout.requirements, acceptance.ids, closeoutPath, diagnostics);
  return diagnostics;
}

function validateRequirementMappings(
  deltaIds: readonly string[],
  mappings: RequirementTrace[] | undefined,
  acceptanceIds: readonly string[],
  sourcePath: string,
  diagnostics: CloseoutDiagnostic[],
): void {
  if (!Array.isArray(mappings)) {
    diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "requirement mappings are missing"));
    return;
  }
  const delta = new Set(deltaIds);
  const acceptance = new Set(acceptanceIds);
  const mapped = new Set<string>();
  for (const mapping of mappings) {
    if (!REQUIREMENT_ID.test(mapping.id) || !delta.has(mapping.id)) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "mapping references an unknown delta requirement"));
    }
    if (mapped.has(mapping.id)) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "delta requirement has duplicate mappings"));
    }
    mapped.add(mapping.id);
    if (!Array.isArray(mapping.acceptanceIds) || mapping.acceptanceIds.length === 0) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "requirement mapping lacks acceptance IDs"));
      continue;
    }
    const references = new Set<string>();
    for (const acceptanceId of mapping.acceptanceIds) {
      if (!REQUIREMENT_ID.test(acceptanceId) || !acceptance.has(acceptanceId)) {
        diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "mapping references an unknown PRD acceptance"));
      }
      if (references.has(acceptanceId)) {
        diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "requirement mapping repeats an acceptance ID"));
      }
      references.add(acceptanceId);
    }
  }
  for (const id of delta) {
    if (!mapped.has(id)) {
      diagnostics.push(diagnostic("PRD_TRACE_INVALID", sourcePath, "delta requirement has no acceptance mapping"));
    }
  }
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

function diagnostic(code: string, sourcePath: string, message: string): CloseoutDiagnostic {
  return { code, path: sourcePath, message };
}
