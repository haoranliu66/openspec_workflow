/* Legacy validator-bound tests retained as historical context during migration.
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
*/

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OpenSpecRunner } from "../lib/openspec-cli";
import { schemas, validateSchemas } from "../scripts/validate-schemas";

const repositoryRoot = path.resolve(__dirname, "..", "..");
assert.deepStrictEqual(schemas, ["bugfix", "product-change"]);

const calls: Array<{ args: readonly string[]; cwd: string; stdio?: string }> = [];
const runner: OpenSpecRunner = (args, options) => {
  calls.push({ args: [...args], cwd: options.cwd, stdio: options.stdio });
  return null;
};

validateSchemas(repositoryRoot, runner);
assert.deepStrictEqual(calls, [
  {
    args: ["schema", "validate", "bugfix"],
    cwd: repositoryRoot,
    stdio: "inherit",
  },
  {
    args: ["schema", "validate", "product-change"],
    cwd: repositoryRoot,
    stdio: "inherit",
  },
]);

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-schema-runner-"));
try {
  const schemaRoot = path.join(base, "openspec", "schemas");
  fs.cpSync(path.join(repositoryRoot, "openspec", "schemas"), schemaRoot, {
    recursive: true,
  });
  const schemaPath = path.join(schemaRoot, "product-change", "schema.yaml");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const nativeDesign = [
    "  - id: design",
    "    generates: design.md",
    "    description: Technical design for the change",
    "    template: design.md",
    "    requires:",
    "      - proposal",
  ].join("\n");
  assert.ok(schema.includes(nativeDesign));
  fs.writeFileSync(
    schemaPath,
    schema.replace(nativeDesign, `${nativeDesign}\n      - specs`),
    "utf8",
  );

  let driftRunnerCalls = 0;
  assert.throws(
    () => validateSchemas(base, () => {
      driftRunnerCalls += 1;
      return null;
    }),
    /design must require only proposal/,
  );
  assert.strictEqual(driftRunnerCalls, 0);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS validates schemas through the shared OpenSpec runner.\n");
