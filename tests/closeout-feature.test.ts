import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CloseoutDiagnostic, CloseoutDocument } from "../lib/closeout-contract";
import { parseSharedFeatureRows, validateProductFeatureTrace } from "../lib/closeout-feature";

const LEDGER_HEADING = "限制与变更";

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function hasCode(diagnostics: CloseoutDiagnostic[], code: string, sourcePath?: string): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === code && (sourcePath === undefined || diagnostic.path === sourcePath));
}

function sharedFeature(rows = "| add-login | FR-001 | 用户可以完成登录 | EV-E2E-001, EV-TEST-001 | 2.2.0 | ready |\n"): string {
  return [
    `## ${LEDGER_HEADING}`,
    "",
    "| Change | 结果 ID | 已交付结论 | Evidence IDs | 版本 / 日期 | 状态 |",
    "|---|---|---|---|---|---|",
    rows,
  ].join("\n");
}

function closeout(): CloseoutDocument {
  return {
    version: 1,
    requirements: [],
    evidence: [
      { id: "EV-E2E-001", type: "test", status: "passed", command: "npm run e2e", artifact: "reports/e2e.json" },
      { id: "EV-TEST-001", type: "test", status: "passed", artifact: "reports/test.json" },
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
  write(root, "openspec/changes/add-login/prd.md", "- **共享 PRD**：`docs/requirements/REQ-001/PRD-001.md`\n");
  write(root, "docs/requirements/REQ-001/PRD-001.md", "# Login PRD\n");
  write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature());

  // Break caught: a ready shared result with passed evidence remains closeable without change-local feature.md.
  assert.deepStrictEqual(parseSharedFeatureRows(sharedFeature(), "FEATURE.md", "add-login"), {
    results: [{
      id: "FR-001",
      conclusion: "用户可以完成登录",
      evidenceIds: ["EV-E2E-001", "EV-TEST-001"],
      versionOrDate: "2.2.0",
      status: "ready",
    }],
    diagnostics: [],
  });
  assert.deepStrictEqual(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), []);

  // Break caught: the shared FEATURE needs a structured table and at least one ready row for this change.
  for (const content of [
    "## Other\n",
    sharedFeature("| other-change | invalid | old | invalid | 1.0.0 | unknown |\n"),
    sharedFeature("| add-login | FR-001 | login | EV-E2E-001 | 2.2.0 | pending |\n"),
  ]) {
    write(root, "docs/requirements/REQ-001/FEATURE.md", content);
    assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), "SHARED_FEATURE_INVALID"));
  }

  // Break caught: each current-change row needs one unique result ID, a conclusion, evidence, and a version/date.
  for (const rows of [
    "| add-login | invalid | login | EV-E2E-001 | 2.2.0 | ready |\n",
    "| add-login | FR-001 |  | EV-E2E-001 | 2.2.0 | ready |\n",
    "| add-login | FR-001 | login |  | 2.2.0 | ready |\n",
    "| add-login | FR-001 | login | EV-E2E-001, EV-E2E-001 | 2.2.0 | ready |\n",
    "| add-login | FR-001 | login | invalid | 2.2.0 | ready |\n",
    "| add-login | FR-001 | login | EV-E2E-001 |  | ready |\n",
    "| add-login | FR-001 | first | EV-E2E-001 | 2.2.0 | ready |\n| add-login | FR-001 | second | EV-TEST-001 | 2.2.0 | ready |\n",
  ]) {
    const parsed = parseSharedFeatureRows(sharedFeature(rows), "FEATURE.md", "add-login");
    assert.ok(parsed.diagnostics.length > 0);
  }

  // Break caught: every shared FEATURE evidence reference must resolve to passed closeout evidence.
  write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature(
    "| add-login | FR-001 | login | EV-MISSING-001 | 2.2.0 | ready |\n",
  ));
  assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), "FEATURE_TRACE_INVALID"));

  // Break caught: the shared FEATURE location is derived from the one safe shared-PRD binding.
  for (const binding of [
    "- **共享 PRD**：`docs/requirements/REQ-001/MISSING.md`\n",
    "- **共享 PRD**：`../outside/PRD-001.md`\n",
    "No structured binding\n",
  ]) {
    write(root, "openspec/changes/add-login/prd.md", binding);
    assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), "SHARED_FEATURE_INVALID"));
  }
  write(root, "openspec/changes/add-login/prd.md", "- **共享 PRD**：`docs/requirements/REQ-001/PRD-001.md`\n");

  fs.rmSync(path.join(root, "docs", "requirements", "REQ-001", "FEATURE.md"));
  assert.ok(hasCode(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), "SHARED_FEATURE_INVALID"));

  // Break caught: semantic defects in historical rows are outside this change's validation scope.
  write(root, "docs/requirements/REQ-001/FEATURE.md", sharedFeature(
    "| other-change | invalid |  | invalid |  | unknown |\n| add-login | FR-001 | login | EV-E2E-001 | 2.2.0 | ready |\n",
  ));
  assert.deepStrictEqual(validateProductFeatureTrace(root, changeRoot, "add-login", closeout()), []);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates shared FEATURE evidence traces.\n");
