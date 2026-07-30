import fs from "node:fs";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument, EvidenceRecord, GateName } from "./closeout-contract";
import { stripFencedCode } from "./structured-markdown";

const GATE_NAMES: readonly GateName[] = ["security", "migration", "browser", "rollback"];
const CHECKBOX = /^\s*[-*+]\s+\[([^\]]*)\]\s+\S/;

export interface TaskValidationResult {
  diagnostics: CloseoutDiagnostic[];
  warnings: CloseoutDiagnostic[];
}

export function validateTasksMarkdown(content: string, sourcePath: string): TaskValidationResult {
  const diagnostics: CloseoutDiagnostic[] = [];
  const warnings: CloseoutDiagnostic[] = [];
  let found = false;

  stripFencedCode(content).split("\n").forEach((line, index) => {
    const match = CHECKBOX.exec(line);
    if (!match) {
      return;
    }
    found = true;
    if (match[1].toLowerCase() !== "x") {
      warnings.push(diagnostic("TASKS_INCOMPLETE", sourcePath, `unfinished task at line ${index + 1}`));
    }
  });

  if (!found) {
    diagnostics.push(diagnostic("TASKS_INVALID", sourcePath, "tasks must contain at least one checkbox"));
  }
  return { diagnostics, warnings };
}

export function validateEvidenceAndGates(
  projectRoot: string,
  closeout: CloseoutDocument,
  sourcePath: string,
): CloseoutDiagnostic[] {
  const diagnostics: CloseoutDiagnostic[] = [];
  const evidenceById = new Map(closeout.evidence.map((record) => [record.id, record]));

  for (const evidence of closeout.evidence) {
    if (!isSafeArtifact(projectRoot, evidence.artifact)) {
      diagnostics.push(diagnostic("EVIDENCE_INVALID", sourcePath, `invalid evidence artifact: ${evidence.id}`));
    }
  }

  for (const gateName of GATE_NAMES) {
    const gate = closeout.gates[gateName];
    if (!gate) {
      diagnostics.push(diagnostic("GATE_INVALID", sourcePath, `missing gate: ${gateName}`));
      continue;
    }
    if (!gate.applicable) {
      if (gate.evidenceIds.length !== 0) {
        diagnostics.push(diagnostic("GATE_INVALID", sourcePath, `inapplicable gate has evidence: ${gateName}`));
      }
      continue;
    }
    if (gate.evidenceIds.length === 0) {
      diagnostics.push(diagnostic("GATE_INVALID", sourcePath, `applicable gate lacks evidence: ${gateName}`));
      continue;
    }
    const records = gate.evidenceIds.map((id) => evidenceById.get(id));
    if (records.some((record) => !record || !isMatchingGateEvidence(record, gateName))) {
      diagnostics.push(diagnostic("GATE_INVALID", sourcePath, `invalid evidence for gate: ${gateName}`));
    }
  }
  return diagnostics;
}

function isMatchingGateEvidence(record: EvidenceRecord | undefined, gateName: GateName): boolean {
  return record !== undefined && record.status === "passed" && record.type === gateName;
}

function isSafeArtifact(projectRoot: string, artifact: string): boolean {
  if (path.isAbsolute(artifact) || artifact.split(/[\\/]+/).includes("..")) {
    return false;
  }
  try {
    const realRoot = fs.realpathSync(projectRoot);
    const candidate = path.resolve(realRoot, artifact);
    if (!isWithin(realRoot, candidate)) {
      return false;
    }
    const realArtifact = fs.realpathSync(candidate);
    return isWithin(realRoot, realArtifact) && fs.statSync(realArtifact).isFile();
  } catch {
    return false;
  }
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative.length > 0 && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function diagnostic(code: string, sourcePath: string, message: string): CloseoutDiagnostic {
  return { code, path: sourcePath, message };
}
