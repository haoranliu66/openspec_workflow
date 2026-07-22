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

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-schema-alignment-missing-"));
try {
  assert.throws(
    () => checkProductSchemaAlignment(missingRoot),
    /missing schema\.yaml[\s\S]*missing template proposal\.md/,
  );
} finally {
  fs.rmSync(missingRoot, { recursive: true, force: true });
}

const applyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-schema-alignment-apply-"));
try {
  fs.cpSync(productSchemaRoot, applyRoot, { recursive: true });
  const schemaPath = path.join(applyRoot, "schema.yaml");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const movedTracks = schema.replace(
    "  tracks: tasks.md",
    "post_apply:\n  tracks: tasks.md",
  );
  assert.notStrictEqual(movedTracks, schema);
  fs.writeFileSync(schemaPath, movedTracks, "utf8");

  assert.throws(
    () => checkProductSchemaAlignment(applyRoot),
    /apply must track tasks\.md/,
  );
} finally {
  fs.rmSync(applyRoot, { recursive: true, force: true });
}

const templateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-schema-alignment-templates-"));
try {
  fs.cpSync(productSchemaRoot, templateRoot, { recursive: true });
  const proposalPath = path.join(templateRoot, "templates", "proposal.md");
  const designPath = path.join(templateRoot, "templates", "design.md");
  const specPath = path.join(templateRoot, "templates", "spec.md");
  const tasksPath = path.join(templateRoot, "templates", "tasks.md");

  fs.writeFileSync(proposalPath, `# Extra heading\n\n${fs.readFileSync(proposalPath, "utf8")}`, "utf8");
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /proposal\.md must not include an H1/,
  );

  fs.writeFileSync(proposalPath, fs.readFileSync(productSchemaRoot + "/templates/proposal.md", "utf8"), "utf8");
  fs.writeFileSync(designPath, `# Extra heading\n\n${fs.readFileSync(designPath, "utf8")}`, "utf8");
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /design\.md must not include an H1/,
  );

  fs.writeFileSync(designPath, fs.readFileSync(productSchemaRoot + "/templates/design.md", "utf8"), "utf8");
  fs.writeFileSync(
    designPath,
    "## Context\n\n## Goals / Non-Goals\n\n### Goals\n\n### Non-Goals\n\n## Decisions\n\n## Risks / Trade-offs\n",
    "utf8",
  );
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /design\.md must include native Goals and Non-Goals labels/,
  );

  fs.writeFileSync(designPath, fs.readFileSync(productSchemaRoot + "/templates/design.md", "utf8"), "utf8");
  fs.writeFileSync(
    specPath,
    "## MODIFIED Requirements\n\n### Requirement: test\n\n#### Scenario: test\n- **WHEN** test\n- **THEN** test\n",
    "utf8",
  );
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /spec\.md must begin with \"## ADDED Requirements\"/,
  );

  fs.writeFileSync(specPath, fs.readFileSync(productSchemaRoot + "/templates/spec.md", "utf8"), "utf8");
  fs.writeFileSync(specPath, `# Extra heading\n\n${fs.readFileSync(specPath, "utf8")}`, "utf8");
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /spec\.md must not include an H1/,
  );

  fs.writeFileSync(specPath, fs.readFileSync(productSchemaRoot + "/templates/spec.md", "utf8"), "utf8");
  fs.writeFileSync(tasksPath, "## 1. Custom\n\n- [ ] 1.1 Custom\n", "utf8");
  assert.throws(
    () => checkProductSchemaAlignment(templateRoot),
    /tasks\.md must use the native numbered checkbox template/,
  );
} finally {
  fs.rmSync(templateRoot, { recursive: true, force: true });
}

process.stdout.write("PASS validates native product-change schema alignment.\n");
