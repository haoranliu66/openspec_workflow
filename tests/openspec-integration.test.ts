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

const proposal = `# Change: Strict validation probe

## Why

Prove the installed validator uses real OpenSpec strict validation.

## What Changes

- Add a disposable validation fixture.

## Capabilities

### New Capabilities

- \`probe-capability\`: Demonstrate strict validation.

### Modified Capabilities

- None.

## Impact

- Test fixture only.
`;

const validDelta = `## ADDED Requirements

### Requirement: Validate every active change

The workflow SHALL validate each active change independently.

#### Scenario: Valid strict change

- **WHEN** CI validates active changes
- **THEN** this change passes strict validation
`;

const invalidDelta = `## ADDED Requirements

### Requirement: Validate every active change

The workflow SHALL fail strict validation without a scenario.
`;

function writeChange(
  root: string,
  changeId: string,
  delta: string,
): void {
  const changeRoot = path.join(root, "openspec", "changes", changeId);
  write(
    changeRoot,
    ".openspec.yaml",
    "schema: product-change\n",
  );
  write(changeRoot, "proposal.md", proposal);
  write(changeRoot, "specs/probe-capability/spec.md", delta);
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-real-openspec-"));
const target = path.join(base, "target");

try {
  installWorkflow(releaseRoot, target);
  writeChange(target, "a-valid", validDelta);
  writeChange(target, "b-invalid", invalidDelta);
  writeChange(target, "c-valid", validDelta);

  const archiveRoot = path.join(target, "openspec", "changes", "archive");
  const archiveBefore = fs.readdirSync(archiveRoot).sort();
  const result = childProcess.spawnSync(
    process.execPath,
    [path.join(target, "scripts", "validate-changes.js")],
    {
      cwd: target,
      encoding: "utf8",
    },
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.strictEqual(result.status, 1, output);
  assert.match(output, /\[1\/3\] validating a-valid/);
  assert.match(output, /\[2\/3\] validating b-invalid/);
  assert.match(output, /\[3\/3\] validating c-valid/);
  assert.match(output, /Change 'a-valid' is valid/);
  assert.match(output, /Change 'c-valid' is valid/);
  assert.match(output, /must include at least one scenario/);
  assert.match(output, /Strict validation failed for 1 active changes/);
  assert.match(output, /- b-invalid:/);
  assert.ok(
    output.indexOf("validating b-invalid") < output.indexOf("validating c-valid"),
    output,
  );
  assert.deepStrictEqual(fs.readdirSync(archiveRoot).sort(), archiveBefore);

  const installedRuntime = [
    ...fs.readdirSync(path.join(target, "lib")),
    ...fs.readdirSync(path.join(target, "scripts")),
  ];
  assert.ok(installedRuntime.every((file) => file.endsWith(".js")));
  assert.ok(installedRuntime.every((file) => !file.endsWith(".ts")));
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS installed runtime validates real OpenSpec changes.\n");
