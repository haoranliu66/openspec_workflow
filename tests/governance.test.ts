import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { collectChangeHistory, type ChangeHistory } from "../lib/change-history";

import {
  checkGeneratedFiles,
  checkIndex,
  checkProject,
  collectCapabilities,
  renderIndex,
  writeGeneratedFiles,
} from "../scripts/openspec-governance";

const tests: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void): void {
  tests.push({ name, fn });
}

function write(root: string, relativePath: string, content = ""): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function withProject(fn: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-governance-"));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("collects current, first/latest archived, and active capability references", () => {
  withProject((root) => {
    write(root, "openspec/specs/admin-panel/spec.md");
    write(root, "openspec/changes/archive/2026-01-01-create/specs/admin-panel/spec.md");
    write(root, "openspec/changes/archive/2026-02-01-refresh/specs/admin-panel/spec.md");
    write(root, "openspec/changes/add-filter/specs/admin-panel/spec.md");

    const capabilities = collectCapabilities(root);

    assert.strictEqual(capabilities.length, 1);
    assert.strictEqual(capabilities[0].canonical, "openspec/specs/admin-panel/spec.md");
    assert.deepStrictEqual(capabilities[0].archived.map((item) => item.change), [
      "2026-01-01-create",
      "2026-02-01-refresh",
    ]);
    assert.deepStrictEqual(capabilities[0].active.map((item) => item.change), ["add-filter"]);
  });
});

test("renders a deterministic navigation-only index", () => {
  withProject((root) => {
    write(root, "openspec/specs/auth/spec.md", "### Requirement: AUTH-01\nsecret body");
    const first = renderIndex(root);
    const second = renderIndex(root);

    assert.strictEqual(first, second);
    assert.ok(first.startsWith("# "));
    assert.match(first, /\[auth\]\(openspec\/specs\/auth\/spec\.md\)/);
    assert.doesNotMatch(first, /secret body|### Requirement:/);
  });
});

test("renders active changes before capability specs exist", () => {
  withProject((root) => {
    write(root, "openspec/changes/early-change/.openspec.yaml", "schema: product-change\n");
    write(root, "openspec/changes/early-change/proposal.md", "## Why\n");

    const rendered = renderIndex(root);

    assert.match(rendered, /early-change/);
    assert.match(
      rendered,
      /\[early-change\]\(openspec\/changes\/early-change\/\)/,
    );
    assert.match(rendered, /product-change/);
    assert.match(rendered, /proposal\.md/);
    assert.doesNotMatch(rendered, /\(null\)/);
    assert.match(rendered, /openspec\/change-history\.json/);
  });
});

test("renders active capability navigation from the supplied history snapshot", () => {
  withProject((root) => {
    write(root, "openspec/changes/snapshot-change/.openspec.yaml", "schema: product-change\n");
    write(
      root,
      "openspec/changes/snapshot-change/specs/snapshot-cap/spec.md",
      "## ADDED Requirements\n",
    );
    const model = collectChangeHistory(root);
    fs.rmSync(path.join(root, "openspec/changes/snapshot-change"), {
      recursive: true,
      force: true,
    });

    const rendered = renderIndex(root, model);

    assert.match(
      rendered,
      /\| snapshot-cap \(pending sync\) \| - \| - \| \[snapshot-change\]\(openspec\/changes\/snapshot-change\/specs\/snapshot-cap\/spec\.md\) \|/,
    );
  });
});

test("escapes active change table cells, link labels, and link targets", () => {
  withProject((root) => {
    const model: ChangeHistory = {
      version: 1,
      diagnostics: [],
      changes: [{
        changeId: "change|draft",
        directoryName: "change |[active]",
        state: "active",
        archiveDate: null,
        schema: "product|change",
        paths: {
          br: null,
          prd: null,
          proposal: "openspec/changes/change space/(draft)#proposal.md",
          design: null,
          tasks: null,
          feature: null,
        },
        capabilities: [{
          name: "cap|[label]",
          canonicalSpec: "openspec/specs/cap/spec.md",
          deltaSpec: "openspec/changes/change space/specs/cap (one)#/spec.md",
          requirements: [],
        }],
      }, {
        changeId: "first",
        directoryName: "archive |[first]",
        state: "archived",
        archiveDate: "2026-01-01",
        schema: "product-change",
        paths: {
          br: null,
          prd: null,
          proposal: null,
          design: null,
          tasks: null,
          feature: null,
        },
        capabilities: [{
          name: "cap|[label]",
          canonicalSpec: "openspec/specs/cap/spec.md",
          deltaSpec: "openspec/changes/archive/archive (first)#/specs/cap/spec.md",
          requirements: [],
        }],
      }, {
        changeId: "last",
        directoryName: "archive |[last]",
        state: "archived",
        archiveDate: "2026-02-01",
        schema: "product-change",
        paths: {
          br: null,
          prd: null,
          proposal: null,
          design: null,
          tasks: null,
          feature: null,
        },
        capabilities: [{
          name: "cap|[label]",
          canonicalSpec: "openspec/specs/cap/spec.md",
          deltaSpec: "openspec/changes/archive/archive (last)#/specs/cap/spec.md",
          requirements: [],
        }],
      }],
    };

    const rendered = renderIndex(root, model);
    const safeRow = "| [change\\|draft](openspec/changes/change%20%7C%5Bactive%5D/) | product\\|change | "
      + "[cap\\|\\[label\\]](openspec/changes/change%20space/specs/cap%20%28one%29%23/spec.md) | "
      + "[proposal.md](openspec/changes/change%20space/%28draft%29%23proposal.md) |";
    const safeCapabilityRow = "| cap\\|[label] (pending sync) | "
      + "archive \\|\\[first\\] | "
      + "archive \\|\\[last\\] | "
      + "[change \\|\\[active\\]](openspec/changes/change%20space/specs/cap%20%28one%29%23/spec.md) |";

    const lines = rendered.split("\n");
    assert.ok(lines.includes(safeRow));
    assert.ok(lines.includes(safeCapabilityRow));
  });
});

test("rejects missing and stale generated files separately", () => {
  withProject((root) => {
    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");

    assert.throws(() => checkGeneratedFiles(root), /缺少 SPEC\.md/);

    write(root, "SPEC.md", renderIndex(root));
    assert.throws(() => checkGeneratedFiles(root), /缺少 openspec\/change-history\.json/);

    write(root, "openspec/change-history.json", '{"version":0}\n');
    assert.throws(() => checkGeneratedFiles(root), /仅支持无路径 version 1/);
  });
});

test("accepts CRLF generated files and writes byte-identical output repeatedly", () => {
  withProject((root) => {
    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");

    writeGeneratedFiles(root);
    const firstSpec = read(root, "SPEC.md");
    const firstHistory = read(root, "openspec/change-history.json");
    writeGeneratedFiles(root);

    assert.strictEqual(read(root, "SPEC.md"), firstSpec);
    assert.strictEqual(read(root, "openspec/change-history.json"), firstHistory);
    assert.deepStrictEqual(
      fs.readdirSync(root).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
    assert.deepStrictEqual(
      fs.readdirSync(path.join(root, "openspec")).filter((entry) => entry.endsWith(".tmp")),
      [],
    );

    write(root, "SPEC.md", firstSpec.replace(/\n/g, "\r\n"));
    write(root, "openspec/change-history.json", firstHistory.replace(/\n/g, "\r\n"));
    assert.doesNotThrow(() => checkGeneratedFiles(root));
  });
});

test("rejects active unknown schemas and returns archived unknown schema warnings", () => {
  withProject((root) => {
    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");
    write(root, "openspec/changes/future-change/.openspec.yaml", "schema: future\n");
    writeGeneratedFiles(root);

    assert.throws(
      () => checkProject(root),
      /Active change future-change has unknown schema future/,
    );
  });

  withProject((root) => {
    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");
    write(
      root,
      "openspec/changes/archive/2026-01-01-legacy/.openspec.yaml",
      "schema: legacy\n",
    );
    writeGeneratedFiles(root);

    const warnings = checkProject(root);

    assert.deepStrictEqual(warnings, [{
      severity: "warning",
      message: "Archived change 2026-01-01-legacy has unknown schema legacy",
    }]);
  });
});

test("detects missing structure and stale index", () => {
  withProject((root) => {
    assert.throws(() => checkProject(root), /缺少必要目录/);

    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");
    write(root, "SPEC.md", "# stale\n");
    assert.throws(() => checkIndex(root), /SPEC\.md 已过期/);
  });
});

test("passes project check with current index and unchanged archive", () => {
  withProject((root) => {
    write(root, "openspec/specs/.gitkeep");
    write(root, "openspec/changes/archive/.gitkeep");
    writeGeneratedFiles(root);

    assert.doesNotThrow(() => checkProject(root));
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
  process.stdout.write(`All ${tests.length} governance tests passed.\n`);
}
