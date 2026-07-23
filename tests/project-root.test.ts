import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveProjectRoot } from "../lib/project-root";

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-project-root-"));

try {
  const sourceRoot = path.join(base, "source");
  fs.mkdirSync(path.join(sourceRoot, "dist", "scripts"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(sourceRoot, "dist", "scripts")),
    sourceRoot,
  );

  const installedRoot = path.join(base, "installed");
  fs.mkdirSync(path.join(installedRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(installedRoot, "openspec", "schemas"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(installedRoot, "scripts")),
    installedRoot,
  );

  const manifestRoot = path.join(base, "manifest-target");
  fs.mkdirSync(path.join(manifestRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(manifestRoot, ".ai-workflow.json"), "{}\n", "utf8");
  assert.strictEqual(
    resolveProjectRoot(path.join(manifestRoot, "scripts")),
    manifestRoot,
  );

  const namedDistRoot = path.join(base, "dist");
  fs.mkdirSync(path.join(namedDistRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(namedDistRoot, "openspec", "schemas"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(namedDistRoot, "scripts")),
    namedDistRoot,
  );

  const unmarkedInstalledRoot = path.join(base, "unmarked-target");
  fs.mkdirSync(path.join(unmarkedInstalledRoot, "scripts"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(unmarkedInstalledRoot, "scripts")),
    unmarkedInstalledRoot,
  );
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS resolves source and installed project roots.\n");
