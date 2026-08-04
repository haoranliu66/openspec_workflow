import assert from "node:assert";
import childProcess from "node:child_process";
import path from "node:path";

import { parseArguments, runWorkflow } from "../bin/workflow";

const root = path.resolve("workflow-cli-target");

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
  ["validate:close", "add-login", "--target", root],
  ["close", "add-login", "extra"],
  ["close", "../outside"],
].forEach((args) => assert.throws(() => parseArguments(args)));

const calls: string[] = [];
runWorkflow(["close", "add-login", "--skip-specs", "--target", root], {
  install: () => ({
    copied: [],
    skipped: [],
    backedUp: [],
    conflicts: [],
    retired: [],
    notices: [],
  }),
  index: () => [],
  check: () => [],
  close: (_target, changeId, options) => {
    calls.push(`close:${changeId}:${options.skipSpecs}`);
    return { changeId, archived: true };
  },
});
// Recovery-only --skip-specs must reach the OpenSpec archive wrapper unchanged.
assert.deepStrictEqual(calls, ["close:add-login:true"]);

let installOutput = "";
const originalWrite = process.stdout.write;
process.stdout.write = ((chunk: string | Uint8Array): boolean => {
  installOutput += chunk.toString();
  return true;
}) as typeof process.stdout.write;
try {
  runWorkflow(["install", "--target", root], {
    install: () => ({
      copied: ["AGENTS.md"],
      skipped: [],
      backedUp: [],
      conflicts: [],
      retired: [],
      notices: ["保留项目自有治理文件。"],
    }),
    index: () => [],
    check: () => [],
    close: (_target, changeId) => ({ changeId, archived: true }),
  });
} finally {
  process.stdout.write = originalWrite;
}
assert.match(installOutput, /提示：保留项目自有治理文件。/);

const imported = childProcess.execFileSync(process.execPath, [
  "-e",
  `const workflow = require(${JSON.stringify(path.join(__dirname, "..", "bin", "workflow.js"))}); process.stdout.write(typeof workflow.runWorkflow);`,
], { encoding: "utf8" });
assert.strictEqual(imported, "function");

const helpOutput = childProcess.execFileSync(
  process.execPath,
  [path.join(__dirname, "..", "bin", "workflow.js"), "help"],
  { encoding: "utf8" },
);
assert.doesNotMatch(helpOutput, /validate:close/);
assert.match(helpOutput, /workflow close/);

process.stdout.write("PASS exposes only the mechanical formal close CLI.\n");
