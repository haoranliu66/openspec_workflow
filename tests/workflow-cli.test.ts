import assert from "node:assert";
import childProcess from "node:child_process";
import path from "node:path";

import { parseArguments, runWorkflow } from "../bin/workflow";

const root = path.resolve("workflow-cli-target");

assert.deepStrictEqual(
  parseArguments(["validate:close", "add-login", "--target", root]),
  {
    command: "validate:close",
    changeId: "add-login",
    target: root,
    force: false,
    skipSpecs: false,
  },
);

assert.deepStrictEqual(
  parseArguments(["close", "add-login", "--skip-specs", "--target", root]),
  {
    command: "close",
    changeId: "add-login",
    target: root,
    force: false,
    skipSpecs: true,
  },
);

[
  ["index", "--skip-specs"],
  ["close", "add-login", "--force"],
  ["validate:close", "--target", root],
  ["close", "add-login", "extra"],
  ["close", "../outside"],
].forEach((args) => assert.throws(() => parseArguments(args)));

const calls: string[] = [];
runWorkflow(["validate:close", "add-login", "--target", root], {
  install: () => { calls.push("install"); return { copied: [], skipped: [], backedUp: [], conflicts: [] }; },
  index: () => calls.push("index"),
  check: () => { calls.push("check"); return []; },
  validateClose: (_target, changeId) => {
    calls.push(`validate:${changeId}`);
    return { changeId, schema: "bugfix", diagnostics: [] };
  },
  close: (_target, changeId, options) => {
    calls.push(`close:${changeId}:${options.skipSpecs}`);
    return { changeId, archived: true };
  },
});
assert.deepStrictEqual(calls, ["validate:add-login"]);

const help = childProcess.execFileSync(process.execPath, [
  "-e",
  `const workflow = require(${JSON.stringify(path.join(__dirname, "..", "bin", "workflow.js"))}); process.stdout.write(typeof workflow.runWorkflow);`,
], { encoding: "utf8" });
// Break caught: removing the module-entry guard would run the CLI while importing it.
assert.strictEqual(help, "function");

const helpOutput = childProcess.execFileSync(
  process.execPath,
  [path.join(__dirname, "..", "bin", "workflow.js"), "help"],
  { encoding: "utf8" },
);
// Break caught: omitting either close command from operator help makes the guarded entry point undiscoverable.
assert.match(helpOutput, /validate:close/);
assert.match(helpOutput, /workflow close/);

process.stdout.write("PASS parses guarded close CLI commands.\n");
