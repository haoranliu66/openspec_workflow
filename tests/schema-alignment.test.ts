import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkProductSchemaAlignment } from "../lib/schema-alignment";

const repositoryRoot = path.resolve(__dirname, "..", "..");
const productSchemaRoot = path.join(repositoryRoot, "openspec", "schemas", "product-change");

const repositoryResult = checkProductSchemaAlignment(productSchemaRoot);
assert.deepStrictEqual(repositoryResult.warnings, []);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-schema-alignment-"));
try {
  fs.cpSync(productSchemaRoot, temporaryRoot, { recursive: true });

  const schemaPath = path.join(temporaryRoot, "schema.yaml");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const mutated = schema.replace(
    /(  - id: design\r?\n[\s\S]*?    requires:\r?\n)(?:      - .*\r?\n)+/,
    "$1      - proposal\n      - specs\n",
  );
  assert.notStrictEqual(mutated, schema);
  fs.writeFileSync(schemaPath, mutated, "utf8");

  assert.throws(
    () => checkProductSchemaAlignment(temporaryRoot),
    /design must require only proposal/,
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write("PASS validates native product-change schema alignment.\n");
