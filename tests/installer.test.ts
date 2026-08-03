import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { installWorkflow } from "../lib/installer";

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

function snapshot(root: string): string[] {
  const entries: string[] = [];
  const visit = (directory: string, relativeDirectory: string): void => {
    fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
      .forEach((entry) => {
        const relativePath = path.posix.join(relativeDirectory, entry.name);
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          entries.push(`D ${relativePath}`);
          visit(absolutePath, relativePath);
        } else {
          entries.push(`F ${relativePath}:${fs.readFileSync(absolutePath).toString("base64")}`);
        }
      });
  };
  visit(root, "");
  return entries;
}

function listRelativeFiles(root: string, relativeDirectory: string): string[] {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        return listRelativeFiles(root, relativePath);
      }
      return [relativePath];
    });
}

const releaseRoot = path.resolve(__dirname, "..", "..");

interface OpenSpecProbeRecord {
  cwd: string;
  args: string[];
  schemaFile: string;
}

function createOpenSpecProbe(base: string): {
  environment: NodeJS.ProcessEnv;
  logPath: string;
} {
  const binRoot = path.join(base, "probe-bin");
  const logPath = path.join(base, "openspec-probe.jsonl");
  const probe = [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    "const args = process.argv.slice(2);",
    "const schema = args[2];",
    'const schemaFile = schema === "spec-driven" ? "builtin:spec-driven" : path.join(process.cwd(), "openspec", "schemas", schema, "schema.yaml");',
    'if (schema === undefined || (schema !== "spec-driven" && !fs.existsSync(schemaFile))) {',
    "  process.stderr.write('missing schema ' + schemaFile + '\\n');",
    "  process.exit(42);",
    "}",
    "fs.appendFileSync(",
    "  process.env.OPENSPEC_TEST_LOG,",
    "  JSON.stringify({ cwd: process.cwd(), args, schemaFile }) + '\\n',",
    ");",
  ].join("\n");
  write(binRoot, "fake-openspec.cjs", `${probe}\n`);
  if (process.platform === "win32") {
    write(
      binRoot,
      "openspec.cmd",
      `@echo off\r\n"${process.execPath}" "%~dp0fake-openspec.cjs" %*\r\n`,
    );
  } else {
    write(binRoot, "openspec", '#!/usr/bin/env node\nrequire("./fake-openspec.cjs");\n');
    fs.chmodSync(path.join(binRoot, "openspec"), 0o755);
  }
  const pathKey = Object.keys(process.env).find((name) => name.toLowerCase() === "path") ?? "PATH";
  return {
    environment: {
      ...process.env,
      [pathKey]: `${binRoot}${path.delimiter}${process.env[pathKey] ?? ""}`,
      OPENSPEC_TEST_LOG: logPath,
    },
    logPath,
  };
}

function makeSource(root: string): void {
  write(root, "package.json", '{"version":"1.0.0"}\n');
  write(root, "dist/scripts/openspec-governance.js", "module.exports = {};\n");
  write(root, "dist/scripts/validate-schemas.js", "module.exports = {};\n");
  write(root, "dist/scripts/validate-changes.js", "module.exports = {};\n");
  write(root, "dist/bin/workflow.js", "module.exports = {};\n");
  write(root, "dist/lib/schema-alignment.js", "exports.schemaAlignment = true;\n");
  write(root, "dist/lib/change-history.js", "exports.changeHistory = true;\n");
  write(root, "dist/lib/openspec-cli.js", "exports.openSpecCli = true;\n");
  write(root, "dist/lib/project-root.js", "exports.projectRoot = true;\n");
  write(root, "dist/lib/close-workflow.js", "exports.closeWorkflow = true;\n");
  write(root, "dist/lib/installer.js", "exports.installer = true;\n");
  write(root, "openspec/config.yaml", "schema: product-change\n");
  write(root, "openspec/change-history.json", '{"version":999}\n');
  write(root, "openspec/schemas/bugfix/schema.yaml", "name: bugfix\n");
  write(root, "openspec/schemas/product-change/schema.yaml", "name: product-change\n");
  write(root, "docs/requirements/_templates/BR.md", "# BR\n");
  write(root, "docs/requirements/_templates/PRD.md", "# PRD\n");
  write(root, "docs/requirements/_templates/README.md", "# REQ\n");
  write(root, "docs/requirements/_templates/FEATURE.md", "# FEATURE\n");
  write(root, "docs/FULLSTACK_WORKFLOW.md", "# Workflow\n");
  write(root, "docs/QUALITY_GATES.md", "# Gates\n");
}

function withRoots(fn: (roots: { source: string; target: string }) => void): void {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-installer-"));
  const source = path.join(base, "source");
  const target = path.join(base, "target");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(target, { recursive: true });
  makeSource(source);
  try {
    fn({ source, target });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

function assertInvalidPackageMetadataDoesNotMutateTarget(
  mutateSource: (source: string) => void,
  expectedMessage: RegExp,
): void {
  withRoots(({ source, target }) => {
    write(target, "sentinel.bin", "sentinel\0bytes");
    write(target, "docs/QUALITY_GATES.md", "# Gates\n");
    mutateSource(source);
    const before = snapshot(target);
    let thrown: unknown;

    try {
      installWorkflow(source, target, { force: true, backupStamp: "must-not-exist" });
    } catch (error) {
      thrown = error;
    }

    assert.deepStrictEqual(snapshot(target), before);
    assert.ok(!fs.existsSync(path.join(target, ".ai-workflow-backup")));
    if (!(thrown instanceof Error)) {
      assert.fail("installWorkflow should reject invalid package metadata");
    }
    assert.match(thrown.message, expectedMessage);
  });
}

test("installs versioned assets and required OpenSpec structure", () => {
  withRoots(({ source, target }) => {
    const result = installWorkflow(source, target);

    assert.ok(result.copied.length > 0);
    assert.strictEqual(read(target, "scripts/openspec-governance.js"), "module.exports = {};\n");
    assert.strictEqual(read(target, "scripts/validate-schemas.js"), "module.exports = {};\n");
    assert.ok(!fs.existsSync(path.join(target, "dist/scripts/openspec-governance.js")));
    assert.strictEqual(read(target, "openspec/config.yaml"), "schema: product-change\n");
    assert.ok(fs.existsSync(path.join(target, "openspec/schemas/bugfix/schema.yaml")));
    assert.ok(fs.existsSync(path.join(target, "openspec/schemas/product-change/schema.yaml")));
    assert.ok(!fs.existsSync(path.join(target, "openspec/schemas/spec-driven")));
    assert.ok(!fs.existsSync(path.join(target, "openspec/schemas/product-change/templates/feature.md")));
    assert.ok(fs.existsSync(path.join(target, "openspec/specs/.gitkeep")));
    assert.ok(fs.existsSync(path.join(target, "openspec/changes/archive/.gitkeep")));
    assert.ok(fs.existsSync(path.join(target, ".ai-workflow.json")));
    assert.ok(!fs.existsSync(path.join(target, ".gitignore")));
    assert.strictEqual(read(target, "lib/schema-alignment.js"), "exports.schemaAlignment = true;\n");
    assert.strictEqual(read(target, "lib/change-history.js"), "exports.changeHistory = true;\n");
    assert.strictEqual(read(target, "scripts/validate-changes.js"), "module.exports = {};\n");
    assert.strictEqual(read(target, "lib/openspec-cli.js"), "exports.openSpecCli = true;\n");
    assert.strictEqual(read(target, "lib/project-root.js"), "exports.projectRoot = true;\n");
    assert.match(read(target, "SPEC.md"), /openspec\/change-history\.json/);
    assert.match(read(target, "openspec/change-history.json"), /^\{\n  "version": 2,/);
    assert.doesNotMatch(read(target, "openspec/change-history.json"), /999/);
    const manifest = JSON.parse(read(target, ".ai-workflow.json")) as {
      managedFiles: string[];
    };
    assert.ok(manifest.managedFiles.includes("SPEC.md"));
    assert.ok(manifest.managedFiles.includes("openspec/change-history.json"));
    assert.ok(!manifest.managedFiles.includes(".gitignore"));
    assert.deepStrictEqual(result.retired, []);
  });
});

test("installs the 3.0 release manifest and minimal emitted JavaScript runtime", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-release-install-"));
  const target = path.join(base, "target");
  try {
    const result = installWorkflow(releaseRoot, target);
    const manifest = JSON.parse(read(target, ".ai-workflow.json")) as {
      version: string;
      managedFiles: string[];
    };
    const runtimeFiles = [
      "lib/change-history.js",
      "lib/close-workflow.js",
      "lib/installer.js",
      "lib/openspec-cli.js",
      "lib/project-root.js",
      "lib/schema-alignment.js",
      "bin/workflow.js",
      "scripts/openspec-governance.js",
      "scripts/validate-changes.js",
      "scripts/validate-schemas.js",
    ].sort();

    assert.strictEqual(manifest.version, "3.0.0");
    assert.deepStrictEqual(
      [
        ...listRelativeFiles(target, "bin"),
        ...listRelativeFiles(target, "lib"),
        ...listRelativeFiles(target, "scripts"),
      ],
      runtimeFiles,
    );
    runtimeFiles.forEach((relativePath) => {
      assert.deepStrictEqual(
        fs.readFileSync(path.join(target, relativePath)),
        fs.readFileSync(path.join(releaseRoot, "dist", relativePath)),
      );
      assert.ok(manifest.managedFiles.includes(relativePath));
    });
    assert.ok(manifest.managedFiles.includes("SPEC.md"));
    assert.ok(manifest.managedFiles.includes("openspec/change-history.json"));
    [
      "scripts/validate-close.js",
      "lib/closeout-contract.js",
      "lib/structured-markdown.js",
      "lib/closeout-p0.js",
      "lib/closeout-trace.js",
      "lib/closeout-feature.js",
      "lib/closeout-validation.js",
      "docs/closeout-templates/product-change.json",
      "docs/closeout-templates/bugfix.json",
      "docs/closeout-templates/spec-driven.json",
    ].forEach((relativePath) => {
      assert.ok(!manifest.managedFiles.includes(relativePath), relativePath);
      assert.ok(!fs.existsSync(path.join(target, relativePath)), relativePath);
    });
    assert.ok(result.copied.includes("SPEC.md"));
    assert.ok(result.copied.includes("openspec/change-history.json"));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("runs installed emitted scripts with the target as the project root", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-release-runtime-"));
  const target = path.join(base, "target");
  try {
    installWorkflow(releaseRoot, target);
    const probe = createOpenSpecProbe(base);
    const run = (relativePath: string, args: string[]): void => {
      childProcess.execFileSync(
        process.execPath,
        [path.join(target, relativePath), ...args],
        {
          cwd: target,
          env: probe.environment,
          stdio: "pipe",
        },
      );
    };

    run("scripts/openspec-governance.js", ["index"]);
    run("scripts/openspec-governance.js", ["check"]);
    run("scripts/validate-schemas.js", []);
    run("scripts/validate-changes.js", []);

    const records = fs.readFileSync(probe.logPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as OpenSpecProbeRecord);
    assert.deepStrictEqual(
      records.map((record) => record.args),
      [
        ["schema", "validate", "bugfix"],
        ["schema", "validate", "product-change"],
        ["schema", "validate", "spec-driven"],
      ],
    );
    records.forEach((record) => {
      assert.strictEqual(path.resolve(record.cwd), path.resolve(target));
      if (record.args[2] === "spec-driven") {
        assert.strictEqual(record.schemaFile, "builtin:spec-driven");
      } else {
        assert.ok(record.schemaFile.startsWith(path.join(target, "openspec", "schemas")));
      }
    });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("runs installed schema validation when the target directory is named dist", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-dist-target-runtime-"));
  const target = path.join(base, "dist");
  try {
    installWorkflow(releaseRoot, target);
    const probe = createOpenSpecProbe(base);

    childProcess.execFileSync(
      process.execPath,
      [path.join(target, "scripts/validate-schemas.js")],
      {
        cwd: target,
        env: probe.environment,
        stdio: "pipe",
      },
    );

    const records = fs.readFileSync(probe.logPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as OpenSpecProbeRecord);
    assert.strictEqual(records.length, 3);
    records.forEach((record) => {
      assert.strictEqual(path.resolve(record.cwd), path.resolve(target));
      if (record.args[2] === "spec-driven") {
        assert.strictEqual(record.schemaFile, "builtin:spec-driven");
      } else {
        assert.ok(record.schemaFile.startsWith(path.join(target, "openspec", "schemas")));
      }
    });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("rejects installed product schema drift before invoking OpenSpec", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-schema-drift-runtime-"));
  const target = path.join(base, "target");
  try {
    installWorkflow(releaseRoot, target);
    const probe = createOpenSpecProbe(base);
    const schemaPath = path.join(target, "openspec", "schemas", "product-change", "schema.yaml");
    const schema = fs.readFileSync(schemaPath, "utf8");
    const nativeDesign = [
      "  - id: design",
      "    generates: design.md",
      "    description: Technical design for the change",
      "    template: design.md",
      "    requires:",
      "      - proposal",
    ].join("\n");
    const driftedDesign = `${nativeDesign}\n      - specs`;
    assert.match(schema, new RegExp(nativeDesign.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    fs.writeFileSync(schemaPath, schema.replace(nativeDesign, driftedDesign), "utf8");

    assert.throws(
      () => childProcess.execFileSync(
        process.execPath,
        [path.join(target, "scripts", "validate-schemas.js")],
        {
          cwd: target,
          env: probe.environment,
          stdio: "pipe",
        },
      ),
      /design must require only proposal/,
    );
    assert.ok(!fs.existsSync(probe.logPath), "OpenSpec must not run after native alignment fails");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("rejects a missing source package before mutating the target", () => {
  assertInvalidPackageMetadataDoesNotMutateTarget(
    (source) => fs.rmSync(path.join(source, "package.json")),
    /工作流源 package\.json 缺失/,
  );
});

test("rejects malformed source package JSON before mutating the target", () => {
  assertInvalidPackageMetadataDoesNotMutateTarget(
    (source) => write(source, "package.json", "{not-json\n"),
    /工作流源 package\.json 不是有效 JSON/,
  );
});

test("rejects a blank source package version before mutating the target", () => {
  assertInvalidPackageMetadataDoesNotMutateTarget(
    (source) => write(source, "package.json", '{"version":"   "}\n'),
    /工作流源 package\.json 的 version 必须是非空字符串/,
  );
});

test("validates a missing compiled source before creating the target", () => {
  withRoots(({ source, target }) => {
    fs.rmSync(path.join(source, "dist/scripts/openspec-governance.js"));
    fs.rmSync(target, { recursive: true, force: true });

    assert.throws(
      () => installWorkflow(source, target),
      /工作流源文件缺失：dist\/scripts\/openspec-governance\.js/,
    );
    assert.ok(!fs.existsSync(target));
  });
});

test("reinstall is idempotent when managed files are unchanged", () => {
  withRoots(({ source, target }) => {
    installWorkflow(source, target);
    const result = installWorkflow(source, target);

    assert.strictEqual(result.conflicts.length, 0);
    assert.ok(result.skipped.length > 0);
  });
});

test("install and upgrade preserve historical archived feature and closeout records", () => {
  withRoots(({ source, target }) => {
    const archiveFeature = "openspec/changes/archive/2026-01-01-old-change/feature.md";
    const archiveCloseout = "openspec/changes/archive/2026-01-01-old-change/closeout.json";
    const historicalEvidence = "artifacts/closeout/old-change/result.json";
    write(target, archiveFeature, "# Historical delivery record\n");
    write(target, archiveCloseout, '{"version":1}\n');
    write(target, historicalEvidence, '{"passed":true}\n');

    installWorkflow(source, target);
    installWorkflow(source, target, { force: true, backupStamp: "upgrade" });

    assert.strictEqual(read(target, archiveFeature), "# Historical delivery record\n");
    assert.strictEqual(read(target, archiveCloseout), '{"version":1}\n');
    assert.strictEqual(read(target, historicalEvidence), '{"passed":true}\n');
  });
});

test("force upgrade migrates a valid version 1 seed without a detailed archive", () => {
  withRoots(({ source, target }) => {
    write(target, "openspec/change-history.json", `${JSON.stringify({
      version: 1,
      changes: [{
        changeId: "old-change",
        directoryName: "2026-01-01-old-change",
        state: "archived",
        archiveDate: "2026-01-01",
        schema: "bugfix",
        paths: { proposal: "openspec/changes/archive/2026-01-01-old-change/proposal.md" },
        capabilities: [{
          name: "auth",
          canonicalSpec: "openspec/specs/auth/spec.md",
          deltaSpec: "openspec/changes/archive/2026-01-01-old-change/specs/auth/spec.md",
          requirements: [{ operation: "MODIFIED", id: "AUTH-001", name: "Password login" }],
        }],
      }],
    }, null, 2)}\n`);

    installWorkflow(source, target, { force: true, backupStamp: "v1-migration" });

    const history = read(target, "openspec/change-history.json");
    assert.match(history, /^\{\n  "version": 2,/);
    assert.match(history, /"changeId": "old-change"/);
    assert.doesNotMatch(history, /directoryName|deltaSpec|proposal\.md/);
    assert.ok(!fs.existsSync(path.join(target, "openspec/changes/archive/2026-01-01-old-change")));
  });
});

test("retires only prior-manifest-owned legacy closeout assets with backups", () => {
  withRoots(({ source, target }) => {
    const retiredFiles = [
      "scripts/validate-close.js",
      "lib/closeout-contract.js",
      "lib/structured-markdown.js",
      "lib/closeout-p0.js",
      "lib/closeout-trace.js",
      "lib/closeout-feature.js",
      "lib/closeout-validation.js",
      "docs/closeout-templates/product-change.json",
      "docs/closeout-templates/bugfix.json",
      "docs/closeout-templates/spec-driven.json",
    ];
    retiredFiles.forEach((relativePath) => write(target, relativePath, `legacy:${relativePath}\n`));
    write(target, ".ai-workflow.json", `${JSON.stringify({
      version: "2.1.0",
      managedFiles: retiredFiles,
    }, null, 2)}\n`);
    write(target, "openspec/changes/active/closeout.json", '{"active":true}\n');
    write(target, "openspec/changes/archive/2026-01-01-old/closeout.json", '{"archived":true}\n');
    write(target, "artifacts/closeout/old/evidence.json", '{"passed":true}\n');

    const result = installWorkflow(source, target, { backupStamp: "retire" });

    assert.deepStrictEqual([...result.retired].sort(), [...retiredFiles].sort());
    retiredFiles.forEach((relativePath) => {
      assert.ok(!fs.existsSync(path.join(target, relativePath)), relativePath);
      assert.strictEqual(
        read(target, `.ai-workflow-backup/retire/${relativePath}`),
        `legacy:${relativePath}\n`,
      );
    });
    assert.ok(!fs.existsSync(path.join(target, "docs/closeout-templates")));
    assert.strictEqual(read(target, "openspec/changes/active/closeout.json"), '{"active":true}\n');
    assert.strictEqual(read(target, "openspec/changes/archive/2026-01-01-old/closeout.json"), '{"archived":true}\n');
    assert.strictEqual(read(target, "artifacts/closeout/old/evidence.json"), '{"passed":true}\n');
  });
});

test("preserves unowned legacy-named files", () => {
  withRoots(({ source, target }) => {
    write(target, "lib/closeout-contract.js", "user-owned\n");
    write(target, ".ai-workflow.json", '{"version":"2.1.0","managedFiles":[]}\n');

    const result = installWorkflow(source, target, { backupStamp: "unused" });

    assert.deepStrictEqual(result.retired, []);
    assert.strictEqual(read(target, "lib/closeout-contract.js"), "user-owned\n");
    assert.ok(!fs.existsSync(path.join(target, ".ai-workflow-backup")));
  });
});

test("rejects an invalid previous manifest before mutating the target", () => {
  withRoots(({ source, target }) => {
    write(target, ".ai-workflow.json", "{not-json\n");
    write(target, "sentinel.txt", "unchanged\n");
    const before = snapshot(target);

    assert.throws(
      () => installWorkflow(source, target, { force: true, backupStamp: "must-not-exist" }),
      /现有 \.ai-workflow\.json 不是有效 JSON/,
    );
    assert.deepStrictEqual(snapshot(target), before);
    assert.ok(!fs.existsSync(path.join(target, ".ai-workflow-backup")));
  });
});

test("refuses conflicts before overwriting target content", () => {
  withRoots(({ source, target }) => {
    write(target, "docs/QUALITY_GATES.md", "# local customization\n");

    assert.throws(() => installWorkflow(source, target), /冲突的工作流文件/);
    assert.strictEqual(read(target, "docs/QUALITY_GATES.md"), "# local customization\n");
    assert.ok(!fs.existsSync(path.join(target, "scripts/openspec-governance.js")));
  });
});

test("force mode backs up conflicts before overwrite", () => {
  withRoots(({ source, target }) => {
    write(target, "docs/QUALITY_GATES.md", "# local customization\n");
    const result = installWorkflow(source, target, { force: true, backupStamp: "test-backup" });

    assert.strictEqual(read(target, "docs/QUALITY_GATES.md"), "# Gates\n");
    assert.strictEqual(
      read(target, ".ai-workflow-backup/test-backup/docs/QUALITY_GATES.md"),
      "# local customization\n",
    );
    assert.strictEqual(result.backedUp.length, 1);
  });
});

test("generated files participate in conflict preflight and force backup", () => {
  withRoots(({ source, target }) => {
    write(target, "SPEC.md", "# local spec\n");
    write(target, "openspec/change-history.json", '{"version":2,"changes":[]}\n');

    assert.throws(() => installWorkflow(source, target), /冲突的工作流文件/);
    assert.strictEqual(read(target, "SPEC.md"), "# local spec\n");
    assert.strictEqual(read(target, "openspec/change-history.json"), '{"version":2,"changes":[]}\n');
    assert.ok(!fs.existsSync(path.join(target, "scripts/openspec-governance.js")));

    const result = installWorkflow(source, target, {
      force: true,
      backupStamp: "generated-backup",
    });

    assert.strictEqual(
      read(target, ".ai-workflow-backup/generated-backup/SPEC.md"),
      "# local spec\n",
    );
    assert.strictEqual(
      read(target, ".ai-workflow-backup/generated-backup/openspec/change-history.json"),
      '{"version":2,"changes":[]}\n',
    );
    assert.ok(result.backedUp.includes(".ai-workflow-backup/generated-backup/SPEC.md"));
    assert.ok(result.backedUp.includes(
      ".ai-workflow-backup/generated-backup/openspec/change-history.json",
    ));
    assert.match(read(target, "openspec/change-history.json"), /^\{\n  "version": 2,/);
  });
});

test("rejects an unsupported existing history before force installation mutates files", () => {
  withRoots(({ source, target }) => {
    write(target, "sentinel.txt", "keep\n");
    write(target, "openspec/change-history.json", '{"version":0,"changes":[]}\n');
    const before = snapshot(target);

    assert.throws(
      () => installWorkflow(source, target, { force: true, backupStamp: "must-not-exist" }),
      /仅支持 version 1 或 version 2/,
    );
    assert.deepStrictEqual(snapshot(target), before);
    assert.ok(!fs.existsSync(path.join(target, ".ai-workflow-backup")));
  });
});

test("preserves existing OpenSpec config and writes merge example", () => {
  withRoots(({ source, target }) => {
    write(target, "openspec/config.yaml", "schema: team-custom\n");
    installWorkflow(source, target);

    assert.strictEqual(read(target, "openspec/config.yaml"), "schema: team-custom\n");
    assert.strictEqual(
      read(target, "openspec/ai-workflow.config.example.yaml"),
      "schema: product-change\n",
    );
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
  process.stdout.write(`All ${tests.length} installer tests passed.\n`);
}
