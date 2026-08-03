import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CloseoutDocument, CloseoutDiagnostic } from "../lib/closeout-contract";
import {
  collectDeltaRequirementIds,
  parsePrdAcceptanceIds,
  parseSharedPrdBinding,
  validateProductRequirementTrace,
} from "../lib/closeout-trace";

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function hasCode(diagnostics: CloseoutDiagnostic[], code: string, sourcePath?: string): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === code && (sourcePath === undefined || diagnostic.path === sourcePath));
}

function closeout(): CloseoutDocument {
  return {
    version: 1,
    requirements: [{ id: "AUTH-001", acceptanceIds: ["PA-001"] }],
    evidence: [],
    gates: {
      security: { applicable: false, reason: "No security scope", evidenceIds: [] },
      migration: { applicable: false, reason: "No migration scope", evidenceIds: [] },
      browser: { applicable: false, reason: "No browser scope", evidenceIds: [] },
      rollback: { applicable: false, reason: "No rollback scope", evidenceIds: [] },
    },
  };
}

function setDelta(root: string, content: string): void {
  write(root, "openspec/changes/add-login/specs/auth/spec.md", content);
}

function setPrd(root: string, content: string): void {
  write(root, "docs/requirements/REQ-001/PRD-001.md", content);
}

function setChangePrd(root: string, content: string): void {
  write(root, "openspec/changes/add-login/prd.md", content);
}

const validDelta = "## ADDED Requirements\n\n### Requirement: AUTH-001 Password login\n";
const validChangePrd = "- **共享 PRD**：`docs/requirements/REQ-001/PRD-001.md`\n";
const validSharedPrd = [
  "## 结果级验收",
  "",
  "| 验收 ID | 期望产品结果 | 证据方式 |",
  "|---|---|---|",
  "| PA-001 | 用户可以登录 | 自动化测试 |",
].join("\n");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "closeout-trace-"));
try {
  const changeRoot = path.join(root, "openspec", "changes", "add-login");
  setDelta(root, validDelta);
  setChangePrd(root, validChangePrd);
  setPrd(root, validSharedPrd);

  // Break caught: valid traceability records must remain accepted across the delta, change PRD, and shared PRD.
  assert.deepStrictEqual(collectDeltaRequirementIds(changeRoot), { ids: ["AUTH-001"], diagnostics: [] });
  assert.deepStrictEqual(parseSharedPrdBinding(validChangePrd, "prd.md"), {
    path: "docs/requirements/REQ-001/PRD-001.md",
    diagnostics: [],
  });
  assert.deepStrictEqual(parsePrdAcceptanceIds(validSharedPrd, "shared-prd.md"), { ids: ["PA-001"], diagnostics: [] });
  assert.deepStrictEqual(validateProductRequirementTrace(root, changeRoot, closeout()), []);

  // Break caught: delta operations without a stable ID, including inconsistent renames, must not become closeable requirements.
  for (const delta of [
    "## ADDED Requirements\n\n### Requirement: Password login\n",
    "## RENAMED Requirements\n\n- FROM: AUTH-001 Old name\n- TO: AUTH-002 New name\n",
  ]) {
    setDelta(root, delta);
    assert.ok(hasCode(collectDeltaRequirementIds(changeRoot).diagnostics, "REQUIREMENT_INVALID"));
  }
  setDelta(root, `${validDelta}\n## MODIFIED Requirements\n\n### Requirement: AUTH-001 Password login again\n`);
  assert.ok(hasCode(collectDeltaRequirementIds(changeRoot).diagnostics, "REQUIREMENT_INVALID"));
  setDelta(root, validDelta);

  // Break caught: a change must bind one exact structured shared PRD path.
  setChangePrd(root, "- **共享 PRD**：docs/requirements/REQ-001/PRD-001.md\n");
  assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, closeout()), "PRD_TRACE_INVALID"));
  setChangePrd(root, "- **共享 PRD**：`docs/requirements/REQ-001/OTHER.md`\n");
  assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, closeout()), "PRD_TRACE_INVALID"));
  setChangePrd(root, validChangePrd);

  // Break caught: a PRD reference must resolve to a real file inside the project rather than a missing or escaping location.
  fs.rmSync(path.join(root, "docs", "requirements", "REQ-001", "PRD-001.md"));
  assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, closeout()), "PRD_TRACE_INVALID"));
  setPrd(root, validSharedPrd);
  setChangePrd(root, "- **共享 PRD**：`../outside-prd.md`\n");
  assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, closeout()), "PRD_TRACE_INVALID"));
  setChangePrd(root, validChangePrd);

  // Break caught: acceptance tables must contain unique, valid, non-placeholder IDs.
  for (const sharedPrd of [
    "## Scope\n",
    "## 结果级验收\n\n| 验收 ID | 期望产品结果 | 证据方式 |\n|---|---|---|\n",
    `${validSharedPrd}\n| PA-001 | Repeat | Test |`,
    validSharedPrd.replace("PA-001", "not-an-id"),
  ]) {
    setPrd(root, sharedPrd);
    assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, closeout()), "PRD_TRACE_INVALID"));
  }
  setPrd(root, validSharedPrd);

  // Break caught: every delta requirement needs exactly one mapping to real shared-PRD acceptance IDs.
  {
    const missing = closeout();
    missing.requirements = [];
    assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, missing), "PRD_TRACE_INVALID"));
    const duplicate = closeout();
    duplicate.requirements = [...duplicate.requirements!, { id: "AUTH-001", acceptanceIds: ["PA-001"] }];
    assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, duplicate), "PRD_TRACE_INVALID"));
    const danglingAcceptance = closeout();
    danglingAcceptance.requirements![0].acceptanceIds = ["PA-404"];
    assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, danglingAcceptance), "PRD_TRACE_INVALID"));
    const danglingRequirement = closeout();
    danglingRequirement.requirements = [{ id: "OTHER-001", acceptanceIds: ["PA-001"] }];
    assert.ok(hasCode(validateProductRequirementTrace(root, changeRoot, danglingRequirement), "PRD_TRACE_INVALID"));
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates Requirement to PRD acceptance traces.\n");
