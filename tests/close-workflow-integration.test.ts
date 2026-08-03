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

function archiveName(target: string, changeId: string): string {
  const match = fs.readdirSync(path.join(target, "openspec", "changes", "archive"))
    .find((name) => name.endsWith(`-${changeId}`));
  assert.ok(match, `archive for ${changeId}`);
  return match;
}

const scenario = [
  "#### Scenario: Value is observed",
  "",
  "- **WHEN** the triggering condition occurs",
  "- **THEN** the expected value is observable",
].join("\n");

function writeProductChange(target: string): void {
  const root = "openspec/changes/add-probe";
  write(target, `${root}/.openspec.yaml`, "schema: product-change\n");
  write(target, `${root}/br.md`, "# BR binding\n");
  write(target, `${root}/prd.md`, "# PRD slice\n");
  write(target, `${root}/proposal.md`, [
    "## Why", "", "A probe is needed.", "",
    "## What Changes", "", "- Add probe behavior.", "",
    "## Capabilities", "", "### New Capabilities", "", "- `probe`: Probe behavior.", "",
    "### Modified Capabilities", "", "- None.", "",
    "## Impact", "", "- Test target.", "",
  ].join("\n"));
  write(target, `${root}/design.md`, [
    "## Context", "", "A test-only design.", "",
    "## Goals / Non-Goals", "", "**Goals:**", "", "- Add probe.", "", "**Non-Goals:**", "", "- None.", "",
    "## Decisions", "", "- Use a deterministic probe.", "",
    "## Risks / Trade-offs", "", "- Test only.", "",
  ].join("\n"));
  // An incomplete task and malformed legacy closeout prove that custom closeout inputs are ignored.
  write(target, `${root}/tasks.md`, "- [ ] 1.1 Deferred team-reviewed task\n");
  write(target, `${root}/closeout.json`, "{not-json\n");
  write(target, `${root}/verification.md`, "# Verification\n\nTeam-reviewed test detail.\n");
  write(target, `${root}/specs/probe/spec.md`, [
    "## ADDED Requirements", "",
    "### Requirement: PROBE-001 Observable probe", "",
    "The system SHALL expose a probe value.", "",
    scenario, "",
  ].join("\n"));
}

function writeBugfixChange(target: string): void {
  write(target, "openspec/specs/auth/spec.md", [
    "# auth Specification", "", "## Purpose", "Authentication.", "", "## Requirements", "",
    "### Requirement: AUTH-001 Password login", "", "The service SHALL create a session.", "", scenario, "",
  ].join("\n"));
  const root = "openspec/changes/fix-login";
  write(target, `${root}/.openspec.yaml`, "schema: bugfix\n");
  write(target, `${root}/proposal.md`, [
    "# Bug 修复提案", "", "## 缺陷", "", "Login can regress.", "",
    "## 预期行为", "", "Login creates a session.", "", "## 范围", "", "Authentication only.", "",
    "## 非目标", "", "No new behavior.", "", "## 能力范围", "", "- **新增**：无", "- **修改**：`auth`", "",
    "## 风险与回滚", "", "Revert the fix.", "",
  ].join("\n"));
  write(target, `${root}/tasks.md`, "- [x] 1.1 Fix and verify regression\n");
  write(target, `${root}/verification.md`, "# Verification\n\nRegression passed.\n");
  write(target, `${root}/specs/auth/spec.md`, [
    "## MODIFIED Requirements", "", "### Requirement: AUTH-001 Password login", "",
    "The service SHALL create a session.", "", scenario, "",
  ].join("\n"));
}

function writeSystemChange(target: string): void {
  const root = "openspec/changes/add-cache-policy";
  write(target, `${root}/.openspec.yaml`, "schema: spec-driven\n");
  write(target, `${root}/proposal.md`, [
    "## Why", "", "A bounded cache policy is needed.", "",
    "## What Changes", "", "- Add expiration behavior.", "",
    "## Capabilities", "", "### New Capabilities", "", "- `cache-policy`: Expiration behavior.", "",
    "### Modified Capabilities", "", "- None.", "", "## Impact", "", "- Cache adapter.", "",
  ].join("\n"));
  write(target, `${root}/design.md`, "## Context\n\nUse the existing cache adapter.\n");
  write(target, `${root}/tasks.md`, "- [x] 1.1 Implement and verify expiration\n");
  write(target, `${root}/verification.md`, "# Verification\n\nExpiration test passed.\n");
  write(target, `${root}/specs/cache-policy/spec.md`, [
    "## ADDED Requirements", "", "### Requirement: CACHE-001 Deterministic expiration", "",
    "The service SHALL expire cached values at the deadline.", "", scenario, "",
  ].join("\n"));
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-close-integration-"));
try {
  const product = path.join(base, "product");
  installWorkflow(releaseRoot, product);
  writeProductChange(product);

  let result = run(product, ["validate:close", "add-probe"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /validate:close does not accept positional arguments/);
  assert.ok(fs.existsSync(path.join(product, "openspec/changes/add-probe")));

  const productSpec = path.join(product, "openspec/changes/add-probe/specs/probe/spec.md");
  const validProductSpec = fs.readFileSync(productSpec, "utf8");
  fs.writeFileSync(productSpec, validProductSpec.replace(scenario, ""), "utf8");
  result = run(product, ["close", "add-probe"]);
  assert.notStrictEqual(result.status, 0, output(result));
  assert.match(output(result), /scenario/i);
  assert.ok(fs.existsSync(path.join(product, "openspec/changes/add-probe")));

  fs.writeFileSync(productSpec, validProductSpec, "utf8");
  result = run(product, ["close", "add-probe"]);
  assert.strictEqual(result.status, 0, output(result));
  const productArchive = archiveName(product, "add-probe");
  assert.ok(fs.existsSync(path.join(product, "openspec/specs/probe/spec.md")));
  assert.ok(fs.existsSync(path.join(product, "openspec/changes/archive", productArchive, "verification.md")));
  assert.ok(fs.existsSync(path.join(product, "openspec/changes/archive", productArchive, "closeout.json")));
  assert.doesNotMatch(output(result), /TASKS_INCOMPLETE|CLOSEOUT_/);
  const productHistory = fs.readFileSync(path.join(product, "openspec/change-history.json"), "utf8");
  assert.match(productHistory, /^\{\n  "version": 2,/);
  assert.match(productHistory, /"changeId": "add-probe"/);
  assert.doesNotMatch(productHistory, /directoryName|deltaSpec|proposal\.md|verification\.md/);
  fs.rmSync(path.join(product, "openspec/changes/archive", productArchive), {
    recursive: true,
    force: true,
  });
  result = run(product, ["index"]);
  assert.strictEqual(result.status, 0, output(result));
  assert.strictEqual(
    fs.readFileSync(path.join(product, "openspec/change-history.json"), "utf8"),
    productHistory,
  );

  const bugfix = path.join(base, "bugfix");
  installWorkflow(releaseRoot, bugfix);
  writeBugfixChange(bugfix);
  result = run(bugfix, ["close", "fix-login", "--skip-specs"]);
  assert.strictEqual(result.status, 0, output(result));
  archiveName(bugfix, "fix-login");
  assert.ok(fs.existsSync(path.join(bugfix, "openspec/specs/auth/spec.md")));

  const system = path.join(base, "system");
  installWorkflow(releaseRoot, system);
  writeSystemChange(system);
  assert.ok(!fs.existsSync(path.join(system, "openspec/schemas/spec-driven")));
  result = run(system, ["close", "add-cache-policy"]);
  assert.strictEqual(result.status, 0, output(result));
  archiveName(system, "add-cache-policy");
  assert.ok(fs.existsSync(path.join(system, "openspec/specs/cache-policy/spec.md")));
  assert.match(fs.readFileSync(path.join(system, "openspec/change-history.json"), "utf8"), /"schema": "spec-driven"/);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS closes all workflow paths through strict and mechanical finalization.\n");
