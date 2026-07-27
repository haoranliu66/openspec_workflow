import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument } from "../lib/closeout-contract";
import {
  parseChangeFeatureResults,
  parseSharedFeatureRows,
  validateProductFeatureTrace,
} from "../lib/closeout-feature";

const RESULT_HEADING = "已交付结果";
const LEDGER_HEADING = "限制与变更";

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function hasCode(diagnostics: CloseoutDiagnostic[], code: string, sourcePath?: string): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === code && (sourcePath === undefined || diagnostic.path === sourcePath));
}

function feature(rows = "| FR-001 | 用户可以完成登录 | EV-E2E-001, EV-TEST-001 |\n"): string {
  return [
    `## ${RESULT_HEADING}`,
    "",
    "| 结果 ID | 已交付结论 | Evidence IDs |",
    "|---|---|---|",
    rows,
  ].join("\n");
}

function sharedFeature(rows = "| add-login | FR-001 | 登录 | 2.2.0 | ready |\n"): string {
  return [
    `## ${LEDGER_HEADING}`,
    "",
    "| Change | 结果 IDs | 已交付切片 | 版本 / 日期 | 状态 |",
    "|---|---|---|---|---|",
    rows,
  ].join("\n");
}

function closeout(): CloseoutDocument {
  return {
    version: 1,
    prd: "docs/requirements/REQ-001/PRD-001.md",
    sharedFeature: "docs/requirements/REQ-001/FEATURE.md",
    requirements: [],
    featureResults: [{ id: "FR-001", evidenceIds: ["EV-E2E-001", "EV-TEST-001"] }],
    evidence: [
      { id: "EV-E2E-001", type: "test", status: "passed", command: "npm run e2e", artifact: "reports/e2e.json" },
      { id: "EV-TEST-001", type: "test", status: "passed", command: "npm test", artifact: "reports/test.json" },
    ],
    gates: {
      security: { applicable: false, reason: "No security scope", evidenceIds: [] },
      migration: { applicable: false, reason: "No migration scope", evidenceIds: [] },
      browser: { applicable: false, reason: "No browser scope", evidenceIds: [] },
      rollback: { applicable: false, reason: "No rollback scope", evidenceIds: [] },
    },
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "closeout-feature-"));
try {
  const changeRoot = path.join(root, "openspec", "changes", "add-login");
  write(root, "openspec/changes/add-login/feature.md", feature());
  write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature());

  // Break caught: valid local and shared FEATURE records must remain closeable.
  assert.deepStrictEqual(parseChangeFeatureResults(feature(), "feature.md"), {
    results: [{ id: "FR-001", conclusion: "用户可以完成登录", evidenceIds: ["EV-E2E-001", "EV-TEST-001"] }],
    diagnostics: [],
  });
  assert.deepStrictEqual(parseSharedFeatureRows(sharedFeature(), "FEATURE.md", "add-login"), {
    resultIds: ["FR-001"],
    diagnostics: [],
  });
  assert.deepStrictEqual(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), []);

  // Break caught: result tables must be present and every delivered conclusion needs a real unique result ID.
  for (const content of [
    "## Other\n",
    feature("| FR-001 |  | EV-E2E-001 |\n"),
    feature("| invalid | conclusion | EV-E2E-001 |\n"),
    feature("| FR-001 | first | EV-E2E-001 |\n| FR-001 | second | EV-TEST-001 |\n"),
  ]) {
    assert.ok(hasCode(parseChangeFeatureResults(content, "feature.md").diagnostics, "FEATURE_TRACE_INVALID", "feature.md"));
  }

  // Break caught: evidence references must be non-empty and unique before trace comparison.
  for (const content of [
    feature("| FR-001 | conclusion |  |\n"),
    feature("| FR-001 | conclusion | EV-E2E-001, EV-E2E-001 |\n"),
  ]) {
    assert.ok(hasCode(parseChangeFeatureResults(content, "feature.md").diagnostics, "FEATURE_TRACE_INVALID", "feature.md"));
  }

  // Break caught: local FEATURE, closeout, and evidence index must agree exactly.
  for (const mutate of [
    (document: CloseoutDocument) => { document.featureResults = []; },
    (document: CloseoutDocument) => { document.featureResults![0].evidenceIds = ["EV-E2E-001"]; },
    (document: CloseoutDocument) => { document.evidence = document.evidence.filter((item) => item.id !== "EV-TEST-001"); },
  ]) {
    const document = closeout();
    mutate(document);
    assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", document), "FEATURE_TRACE_INVALID"));
  }

  // Break caught: the shared FEATURE reference must be a real project-local ordinary file.
  for (const sharedPath of ["docs/requirements/REQ-001/MISSING.md", "../outside/FEATURE.md"]) {
    const document = closeout();
    document.sharedFeature = sharedPath;
    assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", document), "SHARED_FEATURE_INVALID"));
  }

  // Break caught: the current change needs one ready ledger row with the exact local result IDs.
  for (const rows of [
    "| other-change | invalid | old | 1.0.0 | ready |\n",
    "| add-login | FR-002 | login | 2.2.0 | ready |\n",
    "| add-login | FR-001 | login | 2.2.0 | pending |\n",
    "| add-login | FR-001 | login | 2.2.0 | ready |\n| add-login | FR-001 | duplicate | 2.2.1 | ready |\n",
  ]) {
    write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature(rows));
    assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), "SHARED_FEATURE_INVALID"));
  }

  // Break caught: malformed historical rows are outside this change's ledger scope.
  write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature(
    "| other-change | invalid | old | 1.0.0 | unknown |\n| add-login | FR-001 | login | 2.2.0 | ready |\n",
  ));
  assert.deepStrictEqual(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), []);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates FEATURE evidence traces.\n");
