import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OpenSpecRunner } from "../lib/openspec-cli";
import {
  listActiveChanges,
  main,
  validateActiveChanges,
} from "../scripts/validate-changes";

function withProject(fn: (root: string, base: string) => void): void {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-changes-"));
  const root = path.join(base, "project");
  fs.mkdirSync(path.join(root, "openspec", "changes"), { recursive: true });
  try {
    fn(root, base);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

withProject((root, base) => {
  const changes = path.join(root, "openspec", "changes");
  ["z-change", "a-change", "bad_name", "archive", ".hidden"].forEach((name) => {
    fs.mkdirSync(path.join(changes, name), { recursive: true });
  });
  fs.mkdirSync(path.join(changes, "z-change", "nested"), { recursive: true });
  fs.writeFileSync(path.join(changes, "ordinary-file"), "not a change\n", "utf8");
  const linkTarget = path.join(base, "link-target");
  fs.mkdirSync(linkTarget);
  fs.symlinkSync(
    linkTarget,
    path.join(changes, "linked-change"),
    process.platform === "win32" ? "junction" : "dir",
  );

  assert.deepStrictEqual(
    listActiveChanges(root),
    ["a-change", "bad_name", "z-change"],
  );
});

withProject((root) => {
  assert.deepStrictEqual(listActiveChanges(root), []);
  const lines: string[] = [];
  main(() => null, root, (line) => lines.push(line));
  assert.deepStrictEqual(lines, [
    "No active OpenSpec changes found; strict validation skipped.",
  ]);
});

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-missing-changes-"));
try {
  assert.throws(
    () => listActiveChanges(missingRoot),
    /Cannot read active changes directory/,
  );
} finally {
  fs.rmSync(missingRoot, { recursive: true, force: true });
}

withProject((root) => {
  const changes = path.join(root, "openspec", "changes");
  fs.rmSync(changes, { recursive: true, force: true });
  fs.writeFileSync(changes, "not a directory\n", "utf8");
  assert.throws(
    () => listActiveChanges(root),
    /Cannot read active changes directory/,
  );
});

withProject((root) => {
  const changes = path.join(root, "openspec", "changes");
  ["a-good", "bad_name", "c-fail", "d-fail", "e-good"].forEach((name) => {
    fs.mkdirSync(path.join(changes, name));
  });

  const calls: string[][] = [];
  const runner: OpenSpecRunner = (args, options) => {
    calls.push([...args]);
    assert.strictEqual(options.cwd, root);
    assert.strictEqual(options.stdio, "inherit");
    if (args[1]?.endsWith("-fail")) {
      throw new Error(`${args[1]} strict validation exited 1`);
    }
    return null;
  };
  const lines: string[] = [];
  const result = validateActiveChanges(root, runner, (line) => lines.push(line));

  assert.deepStrictEqual(calls, [
    ["validate", "a-good", "--strict"],
    ["validate", "c-fail", "--strict"],
    ["validate", "d-fail", "--strict"],
    ["validate", "e-good", "--strict"],
  ]);
  assert.deepStrictEqual(result.changeIds, [
    "a-good",
    "bad_name",
    "c-fail",
    "d-fail",
    "e-good",
  ]);
  assert.deepStrictEqual(result.failures, [
    {
      changeId: "bad_name",
      reason: "invalid change ID; expected ^[a-z0-9][a-z0-9-]*$",
    },
    {
      changeId: "c-fail",
      reason: "c-fail strict validation exited 1",
    },
    {
      changeId: "d-fail",
      reason: "d-fail strict validation exited 1",
    },
  ]);
  assert.deepStrictEqual(lines, [
    "[1/5] validating a-good",
    "[2/5] invalid change ID \"bad_name\"",
    "[3/5] validating c-fail",
    "[4/5] validating d-fail",
    "[5/5] validating e-good",
  ]);

  assert.throws(
    () => main(runner, root, () => undefined),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Strict validation failed for 3 active changes/);
      assert.match(error.message, /- bad_name: invalid change ID/);
      assert.match(error.message, /- c-fail: c-fail strict validation exited 1/);
      assert.match(error.message, /- d-fail: d-fail strict validation exited 1/);
      return true;
    },
  );
});

process.stdout.write("PASS enumerates and strictly validates every active change.\n");
