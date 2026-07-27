import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CloseoutDocument } from "../lib/closeout-contract";
import {
  validateEvidenceAndGates,
  validateTasksMarkdown,
} from "../lib/closeout-p0";
import { parseSectionTable, stripFencedCode } from "../lib/structured-markdown";

function hasCode(diagnostics: { code: string; path: string }[], code: string, sourcePath: string): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.path === sourcePath);
}

function closeout(artifact: string): CloseoutDocument {
  return {
    version: 1,
    evidence: [{
      id: "EV-SECURITY-001",
      type: "security",
      status: "passed",
      command: "node -e \"process.exit(1)\"",
      artifact,
    }],
    gates: {
      security: { applicable: true, reason: "Authentication boundary changed", evidenceIds: ["EV-SECURITY-001"] },
      migration: { applicable: false, reason: "No data migration", evidenceIds: [] },
      browser: { applicable: false, reason: "No browser surface", evidenceIds: [] },
      rollback: { applicable: false, reason: "No deployable change", evidenceIds: [] },
    },
  };
}

// Break caught: accepting unfinished task markers would permit a change to close early.
assert.deepStrictEqual(
  validateTasksMarkdown("## Work\n\n- [x] done\n- [X] also done\n", "tasks.md"),
  [],
);
for (const marker of ["[ ]", "[-]", "[~]"]) {
  const diagnostics = validateTasksMarkdown(`- ${marker} blocked\n`, "tasks.md");
  assert.ok(hasCode(diagnostics, "TASKS_INVALID", "tasks.md"));
}
assert.ok(hasCode(validateTasksMarkdown("No checkbox\n", "tasks.md"), "TASKS_INVALID", "tasks.md"));

// Break caught: example checkboxes in fenced code must not affect task completion.
assert.deepStrictEqual(
  validateTasksMarkdown("```md\n- [ ] example\n```\n\n- [x] real\n", "tasks.md"),
  [],
);
assert.deepStrictEqual(
  stripFencedCode("one\n~~~\n- [ ] sample\n~~~\nthree\n").split("\n"),
  ["one", "", "", "", "three", ""],
);

// Break caught: structural table parsing must only consume the first table under the exact section.
{
  const table = parseSectionTable(
    "## Result\n\n| ID | State |\n| --- | --- |\n| A | ready |\n\n## Result details\n\n| ID | State |\n| --- | --- |\n| B | ignored |\n",
    "Result",
    ["ID", "State"],
    "feature.md",
  );
  assert.deepStrictEqual(table.diagnostics, []);
  assert.deepStrictEqual(table.rows, [{ cells: ["A", "ready"], line: 5 }]);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "closeout-p0-root-"));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "closeout-p0-outside-"));
try {
  fs.mkdirSync(path.join(root, "reports"));
  fs.writeFileSync(path.join(root, "reports", "security.json"), "{}\n");

  // Break caught: a valid project-local ordinary file must remain valid even when command data is hostile.
  assert.deepStrictEqual(validateEvidenceAndGates(root, closeout("reports/security.json"), "closeout.json"), []);

  // Break caught: evidence references must never resolve outside the project or to directories/missing files.
  for (const artifact of ["missing.json", "reports", "../outside.json", "reports/../reports/security.json", path.join(outside, "report.json")]) {
    const diagnostics = validateEvidenceAndGates(root, closeout(artifact), "closeout.json");
    assert.ok(hasCode(diagnostics, "EVIDENCE_INVALID", "closeout.json"));
  }

  // Break caught: a directory junction that resolves within the project remains a valid artifact path.
  fs.mkdirSync(path.join(root, "linked-target"));
  fs.writeFileSync(path.join(root, "linked-target", "report.json"), "{}\n");
  fs.symlinkSync(path.join(root, "linked-target"), path.join(root, "linked-reports"), "junction");
  assert.deepStrictEqual(validateEvidenceAndGates(root, closeout("linked-reports/report.json"), "closeout.json"), []);

  // Break caught: symlink traversal must not turn an external file into accepted evidence.
  fs.writeFileSync(path.join(outside, "report.json"), "{}\n");
  fs.symlinkSync(outside, path.join(root, "escaped"), "junction");
  assert.ok(hasCode(
    validateEvidenceAndGates(root, closeout("escaped/report.json"), "closeout.json"),
    "EVIDENCE_INVALID",
    "closeout.json",
  ));

  // Break caught: applicable gate evidence must exist, pass, and use the matching gate type.
  {
    const badType = closeout("reports/security.json");
    badType.evidence[0].type = "test";
    assert.ok(hasCode(validateEvidenceAndGates(root, badType, "closeout.json"), "GATE_INVALID", "closeout.json"));
  }
  {
    const missingReference = closeout("reports/security.json");
    missingReference.gates.security.evidenceIds = ["EV-UNKNOWN-001"];
    assert.ok(hasCode(validateEvidenceAndGates(root, missingReference, "closeout.json"), "GATE_INVALID", "closeout.json"));
  }
  {
    const failedEvidence = closeout("reports/security.json");
    (failedEvidence.evidence[0] as { status: string }).status = "failed";
    assert.ok(hasCode(validateEvidenceAndGates(root, failedEvidence, "closeout.json"), "GATE_INVALID", "closeout.json"));
  }

  // Break caught: an inapplicable gate must not carry evidence that implies an unverified pass.
  {
    const inapplicableWithEvidence = closeout("reports/security.json");
    inapplicableWithEvidence.gates.browser.evidenceIds = ["EV-SECURITY-001"];
    assert.ok(hasCode(
      validateEvidenceAndGates(root, inapplicableWithEvidence, "closeout.json"),
      "GATE_INVALID",
      "closeout.json",
    ));
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}

process.stdout.write("PASS validates P0 tasks, evidence artifacts, and gates.\n");
