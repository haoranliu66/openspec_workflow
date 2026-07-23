import assert from "node:assert";
import path from "node:path";

import { buildInvocation, resolveRepositoryRoot, schemas } from "../scripts/validate-schemas";

const repositoryRoot = path.resolve(__dirname, "..", "..");
assert.strictEqual(resolveRepositoryRoot(path.join(repositoryRoot, "dist", "scripts")), repositoryRoot);
assert.strictEqual(
  resolveRepositoryRoot(path.join(repositoryRoot, "installed-project", "scripts")),
  path.join(repositoryRoot, "installed-project"),
);

assert.deepStrictEqual(schemas, ["bugfix", "product-change"]);

const windows = buildInvocation("win32", "bugfix", "C:\\Windows\\System32\\cmd.exe");
assert.strictEqual(windows.command, "C:\\Windows\\System32\\cmd.exe");
assert.deepStrictEqual(windows.args, [
  "/d",
  "/s",
  "/c",
  "openspec.cmd schema validate bugfix",
]);
assert.throws(
  () => buildInvocation("win32", "bugfix & whoami"),
  /Schema 名称无效/,
);

const unix = buildInvocation("linux", "product-change");
assert.strictEqual(unix.command, "openspec");
assert.deepStrictEqual(unix.args, ["schema", "validate", "product-change"]);

process.stdout.write("PASS builds platform-correct OpenSpec invocations.\n");
