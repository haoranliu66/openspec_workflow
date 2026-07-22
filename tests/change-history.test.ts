import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectChangeHistory,
  parseDeltaSpec,
  renderChangeHistory,
} from "../lib/change-history";

const tests: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void): void {
  tests.push({ name, fn });
}

function write(root: string, relativePath: string, content = ""): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function withProject(fn: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-change-history-"));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("parses requirement deltas and renamed FROM/TO pairs", () => {
  const delta = `## ADDED Requirements

### Requirement: AUTH-001 Password login
The system SHALL authenticate a valid account.

#### Scenario: Valid password
- **WHEN** valid credentials are submitted
- **THEN** the user is authenticated

## RENAMED Requirements

- FROM: Legacy login
- TO: Password login
`;

  assert.deepStrictEqual(parseDeltaSpec(delta, "specs/auth/spec.md"), [
    { operation: "ADDED", id: "AUTH-001", name: "Password login" },
    {
      operation: "RENAMED",
      id: null,
      name: "Legacy login -> Password login",
      from: "Legacy login",
      to: "Password login",
    },
  ]);
});

test("parses bold renamed markers and rejects an incomplete pair", () => {
  const delta = `## RENAMED Requirements

- **FROM**: \`Legacy login\`
- **TO**: \`Password login\`

## Notes

### Requirement: Ignored requirement
`;

  assert.deepStrictEqual(parseDeltaSpec(delta, "specs/auth/spec.md"), [
    {
      operation: "RENAMED",
      id: null,
      name: "Legacy login -> Password login",
      from: "Legacy login",
      to: "Password login",
    },
  ]);
  assert.throws(() => parseDeltaSpec("## RENAMED Requirements\n- FROM: Legacy", "specs/auth/spec.md"), /Incomplete RENAMED Requirement in specs\/auth\/spec\.md/);
});

test("collects active and archived changes deterministically", () => {
  withProject((root) => {
    write(root, "openspec/changes/new-login/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/new-login/proposal.md", "# Proposal\n");
    write(root, "openspec/changes/archive/2026-01-02-retire-login/.openspec.yaml", "schema: unknown\n");
    write(
      root,
      "openspec/changes/archive/2026-01-02-retire-login/specs/auth/spec.md",
      "## REMOVED Requirements\n\n### Requirement: AUTH-001 Password login\n",
    );

    const history = collectChangeHistory(root);

    assert.deepStrictEqual(history.changes.map((change) => change.changeId), [
      "new-login",
      "2026-01-02-retire-login",
    ]);
    assert.deepStrictEqual(history.changes[0].paths, {
      br: null,
      prd: null,
      proposal: "openspec/changes/new-login/proposal.md",
      design: null,
      tasks: null,
      feature: null,
    });
    assert.strictEqual(history.changes[0].schema, "product-change");
    assert.deepStrictEqual(history.changes[0].capabilities, []);
    assert.strictEqual(history.changes[1].archiveDate, "2026-01-02");
    assert.strictEqual(history.diagnostics[0].severity, "warning");
    assert.strictEqual(renderChangeHistory(history), renderChangeHistory(history));
  });
});

let failures = 0;
tests.forEach(({ name, fn }) => {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : String(error);
    const detail = error instanceof Error && error.stack ? error.stack : message;
    process.stderr.write(`FAIL ${name}\n${detail}\n`);
  }
});

if (failures > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(`All ${tests.length} change-history tests passed.\n`);
}
