import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CloseoutDiagnostic } from "../lib/closeout-contract";
import { validateCloseoutContent } from "../lib/closeout-validation";

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function hasCode(diagnostics: CloseoutDiagnostic[], code: string, sourcePath?: string): boolean {
  return diagnostics.some((entry) => entry.code === code && (sourcePath === undefined || entry.path === sourcePath));
}

function closeout(schema: "product-change" | "bugfix"): string {
  const document: Record<string, unknown> = {
    version: 1,
    evidence: [{ id: "EV-TEST-001", type: "test", status: "passed", command: "npm test", artifact: "reports/test.json" }],
    gates: {
      security: { applicable: false, reason: "No security scope", evidenceIds: [] },
      migration: { applicable: false, reason: "No migration scope", evidenceIds: [] },
      browser: { applicable: false, reason: "No browser scope", evidenceIds: [] },
      rollback: { applicable: false, reason: "No rollback scope", evidenceIds: [] },
    },
  };
  if (schema === "product-change") {
    Object.assign(document, {
      prd: "docs/requirements/REQ-001/PRD-001.md",
      sharedFeature: "docs/requirements/REQ-001/FEATURE.md",
      requirements: [{ id: "AUTH-001", acceptanceIds: ["PA-001"] }],
      featureResults: [{ id: "FR-001", evidenceIds: ["EV-TEST-001"] }],
    });
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}

function createChange(root: string, changeId: string, schema: "product-change" | "bugfix"): void {
  const base = `openspec/changes/${changeId}`;
  write(root, `${base}/.openspec.yaml`, `schema: ${schema}\n`);
  write(root, `${base}/tasks.md`, "- [x] implement\n");
  write(root, `${base}/closeout.json`, closeout(schema));
  write(root, `${base}/specs/auth/spec.md`, "## ADDED Requirements\n\n### Requirement: AUTH-001 Login\n");
  write(root, "reports/test.json", "{}\n");
  if (schema === "product-change") {
    write(root, `${base}/prd.md`, "- **共享 PRD**：`docs/requirements/REQ-001/PRD-001.md`\n");
    write(root, "docs/requirements/REQ-001/PRD-001.md", [
      "## 结果级验收",
      "",
      "| 验收 ID | 期望产品结果 | 证据方式 |",
      "|---|---|---|",
      "| PA-001 | 登录可用 | test |",
    ].join("\n"));
    write(root, `${base}/feature.md`, [
      "## 已交付结果",
      "",
      "| 结果 ID | 已交付结论 | Evidence IDs |",
      "|---|---|---|",
      "| FR-001 | 用户可以登录 | EV-TEST-001 |",
    ].join("\n"));
    write(root, "docs/requirements/REQ-001/FEATURE.md", [
      "## 限制与变更",
      "",
      "| Change | 结果 IDs | 已交付切片 | 版本 / 日期 | 状态 |",
      "|---|---|---|---|---|",
      `| ${changeId} | FR-001 | 登录 | 2.1.0 | ready |`,
    ].join("\n"));
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "closeout-validation-"));
try {
  createChange(root, "add-login", "product-change");
  createChange(root, "fix-login", "bugfix");

  // Break caught: only an exact, visible directory directly under active changes may be closed.
  for (const changeId of ["missing-change", "archive", ".hidden", "../add-login", "ADD-LOGIN"]) {
    const result = validateCloseoutContent(root, changeId);
    assert.ok(hasCode(result.diagnostics, "CHANGE_NOT_ACTIVE"));
  }
  write(root, "openspec/changes/file-change", "not a change\n");
  assert.ok(hasCode(validateCloseoutContent(root, "file-change").diagnostics, "CHANGE_NOT_ACTIVE"));
  createChange(root, "unknown-schema", "bugfix");
  write(root, "openspec/changes/unknown-schema/.openspec.yaml", "schema: future\n");
  assert.ok(hasCode(validateCloseoutContent(root, "unknown-schema").diagnostics, "SCHEMA_UNSUPPORTED"));
  fs.rmSync(path.join(root, "openspec", "changes", "unknown-schema", ".openspec.yaml"));
  assert.ok(hasCode(validateCloseoutContent(root, "unknown-schema").diagnostics, "SCHEMA_UNSUPPORTED"));

  // Break caught: closeout input must exist and malformed JSON must not reach content validators.
  fs.rmSync(path.join(root, "openspec", "changes", "fix-login", "closeout.json"));
  assert.ok(hasCode(validateCloseoutContent(root, "fix-login").diagnostics, "CLOSEOUT_MISSING"));
  write(root, "openspec/changes/fix-login/closeout.json", "{\n");
  const malformed = validateCloseoutContent(root, "fix-login");
  assert.deepStrictEqual(malformed.diagnostics.map((entry) => entry.code), ["CLOSEOUT_INVALID"]);
  write(root, "openspec/changes/fix-login/closeout.json", closeout("bugfix"));

  // Break caught: product changes aggregate every close gate in their documented phase order.
  assert.deepStrictEqual(validateCloseoutContent(root, "add-login"), {
    changeId: "add-login",
    schema: "product-change",
    diagnostics: [],
    warnings: [],
  });
  write(root, "openspec/changes/add-login/tasks.md", "- [ ] unfinished\n");
  const productWarning = validateCloseoutContent(root, "add-login");
  assert.deepStrictEqual(productWarning.diagnostics, []);
  assert.deepStrictEqual(
    productWarning.warnings.map((entry) => entry.code),
    ["TASKS_INCOMPLETE"],
  );
  write(root, "openspec/changes/add-login/tasks.md", "- [x] complete\n");

  // Break caught: independent content failures retain contract, P0, trace, and FEATURE phase ordering.
  const invalidProduct = JSON.parse(closeout("product-change")) as {
    evidence: Array<{ artifact: string }>;
    gates: { security: { applicable: boolean; reason: string; evidenceIds: string[] } };
    requirements: Array<{ acceptanceIds: string[] }>;
    featureResults: Array<{ evidenceIds: string[] }>;
  };
  invalidProduct.evidence[0].artifact = "reports/missing.json";
  invalidProduct.gates.security = { applicable: true, reason: "security changed", evidenceIds: ["EV-TEST-001"] };
  invalidProduct.requirements[0].acceptanceIds = ["PA-404"];
  invalidProduct.featureResults[0].evidenceIds = ["EV-OTHER-001"];
  write(root, "openspec/changes/add-login/tasks.md", "- [ ] unfinished\n");
  write(root, "openspec/changes/add-login/specs/auth/spec.md", "## ADDED Requirements\n\n### Requirement: Login\n");
  write(root, "openspec/changes/add-login/closeout.json", `${JSON.stringify(invalidProduct)}\n`);
  const invalidProductResult = validateCloseoutContent(root, "add-login");
  assert.deepStrictEqual(
    invalidProductResult.diagnostics.map((entry) => entry.code),
    ["EVIDENCE_INVALID", "GATE_INVALID", "REQUIREMENT_INVALID", "PRD_TRACE_INVALID", "PRD_TRACE_INVALID", "FEATURE_TRACE_INVALID", "FEATURE_TRACE_INVALID"],
  );
  assert.deepStrictEqual(
    invalidProductResult.warnings.map((entry) => entry.code),
    ["TASKS_INCOMPLETE"],
  );
  write(root, "openspec/changes/add-login/tasks.md", "- [x] complete\n");
  write(root, "openspec/changes/add-login/specs/auth/spec.md", "## ADDED Requirements\n\n### Requirement: AUTH-001 Login\n");
  write(root, "openspec/changes/add-login/closeout.json", closeout("product-change"));

  // Break caught: bugfixes enforce P0 and stable Requirement IDs but do not need product trace artifacts.
  assert.deepStrictEqual(validateCloseoutContent(root, "fix-login"), {
    changeId: "fix-login",
    schema: "bugfix",
    diagnostics: [],
    warnings: [],
  });
  write(root, "openspec/changes/fix-login/tasks.md", "- [~] deferred\n");
  const bugfixWarning = validateCloseoutContent(root, "fix-login");
  assert.deepStrictEqual(bugfixWarning.diagnostics, []);
  assert.deepStrictEqual(
    bugfixWarning.warnings.map((entry) => entry.code),
    ["TASKS_INCOMPLETE"],
  );
  fs.rmSync(path.join(root, "openspec", "changes", "fix-login", "tasks.md"));
  const missingTasks = validateCloseoutContent(root, "fix-login");
  assert.deepStrictEqual(
    missingTasks.diagnostics.map((entry) => entry.code),
    ["TASKS_INVALID"],
  );
  assert.deepStrictEqual(missingTasks.warnings, []);
  write(root, "openspec/changes/fix-login/tasks.md", "- [x] complete\n");
  write(root, "openspec/changes/fix-login/specs/auth/spec.md", "## ADDED Requirements\n\n### Requirement: Login\n");
  const bugfixDiagnostics = validateCloseoutContent(root, "fix-login").diagnostics;
  assert.ok(hasCode(bugfixDiagnostics, "REQUIREMENT_INVALID"));
  assert.ok(!bugfixDiagnostics.some((entry) => entry.code === "PRD_TRACE_INVALID" || entry.code === "FEATURE_TRACE_INVALID"));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates one active change before close.\n");
