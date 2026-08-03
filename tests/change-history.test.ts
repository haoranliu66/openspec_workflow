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

test("preserves a stable ID only when both renamed sides agree", () => {
  const sourcePath = "specs/auth/spec.md";

  assert.deepStrictEqual(parseDeltaSpec(
    "## RENAMED Requirements\n\n- FROM: AUTH-001 Old name\n- TO: AUTH-001 New name\n",
    sourcePath,
  ), [{
    operation: "RENAMED",
    id: "AUTH-001",
    name: "Old name -> New name",
    from: "Old name",
    to: "New name",
  }]);

  for (const renamed of [
    "- FROM: AUTH-001 Old name\n- TO: AUTH-002 New name",
    "- FROM: AUTH-001 Old name\n- TO: New name",
  ]) {
    assert.strictEqual(
      parseDeltaSpec(`## RENAMED Requirements\n\n${renamed}\n`, sourcePath)[0].id,
      null,
    );
  }
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

test("handles renamed headings, multiple pairs, and exact unpaired errors", () => {
  const sourcePath = "specs/auth/spec.md";
  const parsed = parseDeltaSpec([
    "## RENAMED Requirements",
    "",
    "### Requirement: AUTH-001 Heading rename",
    "",
    "- FROM: Legacy one",
    "- TO: Current one",
    "- FROM: Legacy two",
    "- TO: Current two",
  ].join("\n"), sourcePath);

  assert.deepStrictEqual(parsed.map((requirement) => requirement.name), [
    "Heading rename",
    "Legacy one -> Current one",
    "Legacy two -> Current two",
  ]);
  const expected = "Incomplete RENAMED Requirement in " + sourcePath;
  assert.throws(
    () => parseDeltaSpec("## RENAMED Requirements\n- FROM: Forgotten\n## Notes", sourcePath),
    (error: unknown) => error instanceof Error && error.message === expected,
  );
  assert.throws(
    () => parseDeltaSpec("## RENAMED Requirements\n- FROM: Forgotten", sourcePath),
    (error: unknown) => error instanceof Error && error.message === expected,
  );
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
      "retire-login",
    ]);
    assert.strictEqual(history.changes[1].directoryName, "2026-01-02-retire-login");
    assert.strictEqual(history.changes[1].archiveDate, "2026-01-02");
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

test("ignores empty archive directory skeletons", () => {
  withProject((root) => {
    fs.mkdirSync(
      path.join(root, "openspec/changes/archive/2026-01-01-empty/specs/capability"),
      { recursive: true },
    );

    const history = collectChangeHistory(root);

    assert.deepStrictEqual(history.changes, []);
    assert.deepStrictEqual(history.diagnostics, []);
  });
});

test("recognizes the native spec-driven schema in change history", () => {
  withProject((root) => {
    write(root, "openspec/changes/add-cache/.openspec.yaml", "schema: spec-driven\n");
    write(root, "openspec/changes/add-cache/proposal.md", "# Proposal\n");

    const history = collectChangeHistory(root);

    assert.strictEqual(history.changes.length, 1);
    assert.strictEqual(history.changes[0].changeId, "add-cache");
    assert.strictEqual(history.changes[0].schema, "spec-driven");
    assert.deepStrictEqual(history.diagnostics, []);
  });
});

test("sorts active and archived discovery, capabilities, and requirements", () => {
  withProject((root) => {
    write(root, "openspec/changes/z-last/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/alpha-first/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/archive/2026-02-01-zeta/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/archive/2026-01-10-gamma/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/archive/2026-01-10-alpha/.openspec.yaml", "schema: product-change\n");
    write(
      root,
      "openspec/changes/z-last/specs/auth/spec.md",
      [
        "## ADDED Requirements",
        "",
        "### Requirement: ZZZ-1 Zulu",
        "### Requirement: Alpha",
        "### Requirement: AAA-9 Alpha",
        "### Requirement: AAA-1 Alpha",
        "",
        "## MODIFIED Requirements",
        "",
        "### Requirement: CCC-1 Alpha",
      ].join("\n"),
    );
    write(root, "openspec/changes/z-last/specs/zeta/spec.md", "");

    const history = collectChangeHistory(root);
    const active = history.changes.filter((change) => change.state === "active");
    const archived = history.changes.filter((change) => change.state === "archived");

    assert.deepStrictEqual(active.map((change) => change.directoryName), ["alpha-first", "z-last"]);
    assert.deepStrictEqual(archived.map((change) => change.directoryName), [
      "2026-01-10-alpha",
      "2026-01-10-gamma",
      "2026-02-01-zeta",
    ]);
    assert.deepStrictEqual(active[1].capabilities.map((capability) => capability.name), ["auth", "zeta"]);
    assert.deepStrictEqual(
      active[1].capabilities[0].requirements.map(
        (requirement) => requirement.name + "|" + requirement.operation + "|" + (requirement.id ?? "null"),
      ),
      ["Alpha|ADDED|null", "Alpha|ADDED|AAA-1", "Alpha|ADDED|AAA-9", "Alpha|MODIFIED|CCC-1", "Zulu|ADDED|ZZZ-1"],
    );
  });
});

test("preserves version 2 seed history when detailed archives are absent", () => {
  withProject((root) => {
    const seed = {
      version: 2,
      changes: [{
        changeId: "add-auth",
        archiveDate: "2026-01-03",
        schema: "product-change",
        capabilities: [{
          name: "auth",
          requirements: [{ operation: "ADDED", id: "AUTH-001", name: "Password login" }],
        }],
      }],
    };
    write(root, "openspec/change-history.json", `${JSON.stringify(seed, null, 2)}\n`);

    const history = collectChangeHistory(root);

    assert.strictEqual(history.changes.length, 1);
    assert.strictEqual(history.changes[0].state, "archived");
    assert.strictEqual(history.changes[0].capabilities[0].deltaSpec, null);
    assert.strictEqual(renderChangeHistory(history), `${JSON.stringify(seed, null, 2)}\n`);
  });
});

test("migrates archived version 1 data and omits active records and paths", () => {
  withProject((root) => {
    write(root, "openspec/change-history.json", `${JSON.stringify({
      version: 1,
      changes: [{
        changeId: "active-only",
        directoryName: "active-only",
        state: "active",
        archiveDate: null,
        schema: "product-change",
        paths: { proposal: "openspec/changes/active-only/proposal.md" },
        capabilities: [],
      }, {
        changeId: "retire-auth",
        directoryName: "2026-02-01-retire-auth",
        state: "archived",
        archiveDate: "2026-02-01",
        schema: "bugfix",
        paths: { proposal: "openspec/changes/archive/2026-02-01-retire-auth/proposal.md" },
        capabilities: [{
          name: "auth",
          canonicalSpec: "openspec/specs/auth/spec.md",
          deltaSpec: "openspec/changes/archive/2026-02-01-retire-auth/specs/auth/spec.md",
          requirements: [{ operation: "REMOVED", id: "AUTH-001", name: "Legacy login" }],
        }],
      }],
    }, null, 2)}\n`);

    const rendered = renderChangeHistory(collectChangeHistory(root));

    assert.match(rendered, /^\{\n  "version": 2,/);
    assert.match(rendered, /"changeId": "retire-auth"/);
    assert.doesNotMatch(rendered, /active-only|directoryName|paths|deltaSpec|canonicalSpec/);
  });
});

test("merges local archives over seeded summaries by stable identity", () => {
  withProject((root) => {
    write(root, "openspec/change-history.json", `${JSON.stringify({
      version: 2,
      changes: [{
        changeId: "add-auth",
        archiveDate: "2026-01-03",
        schema: "product-change",
        capabilities: [{ name: "auth", requirements: [] }],
      }],
    }, null, 2)}\n`);
    write(root, "openspec/changes/archive/2026-01-03-add-auth/.openspec.yaml", "schema: product-change\n");
    write(
      root,
      "openspec/changes/archive/2026-01-03-add-auth/specs/auth/spec.md",
      "## ADDED Requirements\n\n### Requirement: AUTH-001 Password login\n",
    );

    const history = collectChangeHistory(root);
    const rendered = renderChangeHistory(history);

    assert.strictEqual(history.changes.filter((change) => change.state === "archived").length, 1);
    assert.match(rendered, /"id": "AUTH-001"/);
  });
});

test("rejects invalid or unsupported history seeds before regeneration", () => {
  withProject((root) => {
    write(root, "openspec/change-history.json", "{broken\n");
    assert.throws(() => collectChangeHistory(root), /不是有效 JSON/);
  });
  withProject((root) => {
    write(root, "openspec/change-history.json", '{"version":99,"changes":[]}\n');
    assert.throws(() => collectChangeHistory(root), /仅支持 version 1 或 version 2/);
  });
  withProject((root) => {
    write(root, "openspec/change-history.json", `${JSON.stringify({
      version: 2,
      changes: [{
        changeId: "bad-date",
        archiveDate: "yesterday",
        schema: "bugfix",
        capabilities: [],
      }],
    })}\n`);
    assert.throws(() => collectChangeHistory(root), /无效的 archived change 摘要/);
  });
});


test("renders exact deterministic JSON without diagnostics or input mutation", () => {
  const model = {
    version: 2 as const,
    changes: [],
    diagnostics: [{ severity: "error" as const, message: "excluded diagnostic" }],
  };
  const before = structuredClone(model);
  const expected = [
    "{",
    '  "version": 2,',
    '  "changes": []',
    "}",
    "",
  ].join("\n");

  const first = renderChangeHistory(model);
  const second = renderChangeHistory(model);

  assert.strictEqual(first, expected);
  assert.strictEqual(second, expected);
  assert.strictEqual(first.endsWith("\n\n"), false);
  assert.deepStrictEqual(model, before);
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
