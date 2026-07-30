import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { installWorkflow } from "../lib/installer";

const releaseRoot = path.resolve(__dirname, "..", "..");

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function run(target: string, args: string[]): childProcess.SpawnSyncReturns<string> {
  return childProcess.spawnSync(
    process.execPath,
    [path.join(target, "bin", "workflow.js"), ...args, "--target", target],
    { cwd: target, encoding: "utf8" },
  );
}

function output(result: childProcess.SpawnSyncReturns<string>): string {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

const validScenario = [
  "#### Scenario: User signs in",
  "",
  "- **WHEN** a user submits valid credentials",
  "- **THEN** the service creates a session",
].join("\n");

function writeProductChange(target: string, changeId = "add-login"): void {
  const change = `openspec/changes/${changeId}`;
  write(target, `${change}/.openspec.yaml`, "schema: product-change\n");
  write(target, `${change}/proposal.md`, "# Change: Add login\n\n## Why\n\nUsers need login.\n\n## What Changes\n\n- Add login.\n\n## Capabilities\n\n### New Capabilities\n\n- `auth`: Login behavior.\n\n### Modified Capabilities\n\n- None.\n\n## Impact\n\n- Authentication.\n");
  write(target, `${change}/design.md`, "# Design\n\n## Context\n\nLogin flow.\n");
  write(target, `${change}/tasks.md`, "- [x] 1.1 Implement login\n- [X] 1.2 Verify login\n");
  write(target, `${change}/prd.md`, "- **共享 PRD**：`docs/requirements/REQ-001/PRD-001.md`\n");
  write(target, `${change}/specs/auth/spec.md`, `## ADDED Requirements\n\n### Requirement: AUTH-001 Password login\n\nThe service SHALL create a session for valid credentials.\n\n${validScenario}\n`);
  write(target, `${change}/feature.md`, [
    "# Delivery record",
    "",
    "## 已交付结果",
    "",
    "| 结果 ID | 已交付结论 | Evidence IDs |",
    "|---|---|---|",
    "| FR-001 | Users can sign in | EV-TEST-001 |",
  ].join("\n"));
  write(target, "docs/requirements/REQ-001/PRD-001.md", [
    "# PRD",
    "",
    "## 结果级验收",
    "",
    "| 验收 ID | 期望产品结果 | 证据方式 |",
    "|---|---|---|",
    "| PA-001 | User can sign in | Automated test |",
  ].join("\n"));
  write(target, "docs/requirements/REQ-001/FEATURE.md", [
    "# FEATURE",
    "",
    "## 限制与变更",
    "",
    "| Change | 结果 IDs | 已交付切片 | 版本 / 日期 | 状态 |",
    "|---|---|---|---|---|",
    `| ${changeId} | FR-001 | Login | 1.0 / 2026-07-27 | ready |`,
  ].join("\n"));
  ["test", "security", "migration", "browser", "rollback"].forEach((name) => {
    write(target, `artifacts/${name}.json`, "{}\n");
  });
  write(target, `${change}/closeout.json`, JSON.stringify({
    version: 1,
    prd: "docs/requirements/REQ-001/PRD-001.md",
    sharedFeature: "docs/requirements/REQ-001/FEATURE.md",
    requirements: [{ id: "AUTH-001", acceptanceIds: ["PA-001"] }],
    featureResults: [{ id: "FR-001", evidenceIds: ["EV-TEST-001"] }],
    evidence: [
      { id: "EV-TEST-001", type: "test", status: "passed", command: "npm test", artifact: "artifacts/test.json" },
      { id: "EV-SECURITY-001", type: "security", status: "passed", command: "security scan", artifact: "artifacts/security.json" },
      { id: "EV-MIGRATION-001", type: "migration", status: "passed", command: "migration check", artifact: "artifacts/migration.json" },
      { id: "EV-BROWSER-001", type: "browser", status: "passed", command: "browser test", artifact: "artifacts/browser.json" },
      { id: "EV-ROLLBACK-001", type: "rollback", status: "passed", command: "rollback drill", artifact: "artifacts/rollback.json" },
    ],
    gates: {
      security: { applicable: true, reason: "Authentication changes", evidenceIds: ["EV-SECURITY-001"] },
      migration: { applicable: true, reason: "Migration reviewed", evidenceIds: ["EV-MIGRATION-001"] },
      browser: { applicable: true, reason: "Browser flow changed", evidenceIds: ["EV-BROWSER-001"] },
      rollback: { applicable: true, reason: "Rollback rehearsed", evidenceIds: ["EV-ROLLBACK-001"] },
    },
  }, null, 2));
}

function writeBugfixChange(target: string, changeId = "fix-login"): void {
  const change = `openspec/changes/${changeId}`;
  write(target, `${change}/.openspec.yaml`, "schema: bugfix\n");
  write(target, `${change}/proposal.md`, "# Change: Fix login\n\n## Why\n\nFix a bounded defect.\n");
  write(target, `${change}/tasks.md`, "- [x] 1.1 Fix regression\n");
  write(target, `${change}/specs/auth/spec.md`, `## MODIFIED Requirements\n\n### Requirement: AUTH-001 Password login\n\nThe service SHALL create a session for valid credentials.\n\n${validScenario}\n`);
  write(target, "artifacts/bugfix-security.json", "{}\n");
  write(target, `${change}/closeout.json`, JSON.stringify({
    version: 1,
    evidence: [{ id: "EV-SECURITY-001", type: "security", status: "passed", command: "security scan", artifact: "artifacts/bugfix-security.json" }],
    gates: {
      security: { applicable: true, reason: "Authentication defect", evidenceIds: ["EV-SECURITY-001"] },
      migration: { applicable: false, reason: "No data migration", evidenceIds: [] },
      browser: { applicable: false, reason: "No browser change", evidenceIds: [] },
      rollback: { applicable: false, reason: "No deployment change", evidenceIds: [] },
    },
  }, null, 2));
}

function archiveNames(target: string): string[] {
  return fs.readdirSync(path.join(target, "openspec", "changes", "archive")).sort();
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-closeout-integration-"));
try {
  const product = path.join(root, "product");
  installWorkflow(releaseRoot, product);
  writeProductChange(product);

  // Break caught: installed emitted validation must accept a fully evidenced product change through real OpenSpec strict validation.
  let result = run(product, ["validate:close", "add-login"]);
  assert.strictEqual(result.status, 0, output(result));

  // Break caught: an unchecked closeout task must remain visible without blocking single-change validation.
  const tasks = path.join(product, "openspec", "changes", "add-login", "tasks.md");
  fs.writeFileSync(tasks, "- [ ] 1.1 Implement login\n", "utf8");
  result = run(product, ["validate:close", "add-login"]);
  assert.strictEqual(result.status, 0, output(result));
  assert.match(output(result), /TASKS_INCOMPLETE/);
  assert.ok(fs.existsSync(path.join(product, "openspec", "changes", "add-login")));

  // Break caught: a malformed or missing tasks file must remain a blocking closeout input error.
  fs.writeFileSync(tasks, "No real checkbox\n", "utf8");
  result = run(product, ["validate:close", "add-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /TASKS_INVALID/);
  assert.ok(!archiveNames(product).some((name) => name.includes("add-login")));
  fs.rmSync(tasks);
  result = run(product, ["validate:close", "add-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /TASKS_INVALID/);
  assert.ok(!archiveNames(product).some((name) => name.includes("add-login")));
  fs.writeFileSync(tasks, "- [x] 1.1 Implement login\n", "utf8");

  // Break caught: a requirement cannot close against a dangling PRD acceptance ID.
  const productCloseout = path.join(product, "openspec", "changes", "add-login", "closeout.json");
  const validCloseout = fs.readFileSync(productCloseout, "utf8");
  fs.writeFileSync(productCloseout, validCloseout.replace("PA-001", "PA-404"), "utf8");
  result = run(product, ["validate:close", "add-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /PRD_TRACE_INVALID/);
  fs.writeFileSync(productCloseout, validCloseout, "utf8");

  // Break caught: evidence artifacts must not escape the installed project.
  fs.writeFileSync(productCloseout, validCloseout.replace("artifacts/test.json", "../escape.json"), "utf8");
  result = run(product, ["validate:close", "add-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /EVIDENCE_INVALID/);
  fs.writeFileSync(productCloseout, validCloseout, "utf8");

  // Break caught: incomplete-task warnings must not weaken an applicable gate's matching passed-evidence requirement.
  const invalidGate = JSON.parse(validCloseout) as {
    gates: { security: { evidenceIds: string[] } };
  };
  invalidGate.gates.security.evidenceIds = ["EV-TEST-001"];
  fs.writeFileSync(productCloseout, `${JSON.stringify(invalidGate, null, 2)}\n`, "utf8");
  result = run(product, ["validate:close", "add-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /GATE_INVALID/);
  assert.ok(!archiveNames(product).some((name) => name.includes("add-login")));
  fs.writeFileSync(productCloseout, validCloseout, "utf8");

  // Break caught: warning-only close must report before archiving, then rebuild generated indices and finish governance.
  fs.writeFileSync(tasks, "- [~] 1.1 Implementation deferred by user decision\n", "utf8");
  result = run(product, ["close", "add-login", "--skip-specs"]);
  assert.strictEqual(result.status, 0, output(result));
  assert.match(output(result), /TASKS_INCOMPLETE/);
  assert.ok(archiveNames(product).some((name) => name.includes("add-login")));
  assert.ok(!fs.existsSync(path.join(product, "openspec", "specs", "auth", "spec.md")));
  assert.match(fs.readFileSync(path.join(product, "SPEC.md"), "utf8"), /暂无活动 Change/);
  assert.match(fs.readFileSync(path.join(product, "openspec", "change-history.json"), "utf8"), /add-login/);

  const bugfix = path.join(root, "bugfix");
  installWorkflow(releaseRoot, bugfix);
  writeBugfixChange(bugfix);

  // Break caught: bugfix closure requires stable delta IDs but must not require product PRD or FEATURE records.
  result = run(bugfix, ["validate:close", "fix-login"]);
  assert.strictEqual(result.status, 0, output(result));
  const bugfixSpec = path.join(bugfix, "openspec", "changes", "fix-login", "specs", "auth", "spec.md");
  fs.writeFileSync(bugfixSpec, `## MODIFIED Requirements\n\n### Requirement: Password login\n\nThe service SHALL create a session.\n\n${validScenario}\n`, "utf8");
  result = run(bugfix, ["validate:close", "fix-login"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /REQUIREMENT_INVALID/);
  writeBugfixChange(bugfix);

  // Break caught: --skip-specs must reach real OpenSpec archive for a valid bugfix and leave no active change behind.
  result = run(bugfix, ["close", "fix-login", "--skip-specs"]);
  assert.strictEqual(result.status, 0, output(result));
  assert.ok(archiveNames(bugfix).some((name) => name.includes("fix-login")));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates installed closeout workflow end to end.\n");
