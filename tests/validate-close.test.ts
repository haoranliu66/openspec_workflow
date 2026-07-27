import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { main } from "../scripts/validate-close";
import {
  parseValidateCloseArguments as parseArguments,
  validateCloseChange as validateClose,
} from "../lib/closeout-validation";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-close-"));
try {
  const changeRoot = path.join(root, "openspec", "changes", "add-login");
  fs.mkdirSync(changeRoot, { recursive: true });
  fs.writeFileSync(path.join(changeRoot, ".openspec.yaml"), "schema: bugfix\n");
  fs.writeFileSync(path.join(changeRoot, "tasks.md"), "- [x] task\n");
  fs.mkdirSync(path.join(root, "reports"));
  fs.writeFileSync(path.join(root, "reports", "test.json"), "{}\n");
  fs.writeFileSync(path.join(changeRoot, "closeout.json"), JSON.stringify({
    version: 1,
    evidence: [{ id: "EV-TEST-001", type: "test", status: "passed", command: "npm test", artifact: "reports/test.json" }],
    gates: {
      security: { applicable: false, reason: "none", evidenceIds: [] },
      migration: { applicable: false, reason: "none", evidenceIds: [] },
      browser: { applicable: false, reason: "none", evidenceIds: [] },
      rollback: { applicable: false, reason: "none", evidenceIds: [] },
    },
  }));

  // Break caught: strict OpenSpec validation runs once before content validation for the requested change.
  const calls: string[] = [];
  const result = validateClose(root, "add-login", (changeId, cwd) => {
    calls.push(`${changeId}@${cwd}`);
  });
  assert.deepStrictEqual(calls, [`add-login@${root}`]);
  assert.deepStrictEqual(result.diagnostics, []);

  // Break caught: a strict failure stops closeout validation before missing content can obscure it.
  fs.rmSync(path.join(changeRoot, "closeout.json"));
  assert.throws(
    () => validateClose(root, "add-login", () => { throw new Error("strict failure"); }),
    /add-login/,
  );

  // Break caught: CLI argument parsing accepts exactly one safe change ID.
  assert.deepStrictEqual(parseArguments(["add-login"]), { changeId: "add-login" });
  for (const args of [[], ["add-login", "extra"], ["../add-login"], ["ADD-LOGIN"]]) {
    assert.throws(() => parseArguments(args));
  }

  // Break caught: importing the CLI must not execute process logic before its explicit main entry point.
  assert.strictEqual(typeof main, "function");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("PASS validates strict-first close command behavior.\n");
