import assert from "node:assert";

import { parseCloseoutJson } from "../lib/closeout-contract";

const validProduct = {
  version: 1,
  prd: "docs/requirements/REQ-001/PRD-001.md",
  sharedFeature: "docs/requirements/REQ-001/FEATURE.md",
  requirements: [{ id: "AUTH-001", acceptanceIds: ["PA-001"] }],
  featureResults: [{ id: "FR-001", evidenceIds: ["EV-TEST-001"] }],
  evidence: [{
    id: "EV-TEST-001",
    type: "test",
    status: "passed",
    command: "npm test",
    artifact: "artifacts/test.json",
  }],
  gates: {
    security: { applicable: false, reason: "No security boundary change", evidenceIds: [] },
    migration: { applicable: false, reason: "No data change", evidenceIds: [] },
    browser: { applicable: false, reason: "No UI change", evidenceIds: [] },
    rollback: { applicable: false, reason: "No deployable change", evidenceIds: [] },
  },
};

const validBugfix = {
  version: 1,
  evidence: validProduct.evidence,
  gates: validProduct.gates,
};

function parse(value: unknown, schema: "product-change" | "bugfix" = "product-change") {
  return parseCloseoutJson(JSON.stringify(value), schema, "closeout.json");
}

function cloneProduct(): typeof validProduct {
  return JSON.parse(JSON.stringify(validProduct)) as typeof validProduct;
}

function assertInvalid(value: unknown, schema: "product-change" | "bugfix" = "product-change") {
  const result = parse(value, schema);
  assert.ok(result.diagnostics.length > 0);
  assert.ok(result.diagnostics.every(
    (diagnostic: { code: string; path: string }) => diagnostic.code === "CLOSEOUT_INVALID" && diagnostic.path === "closeout.json",
  ));
  assert.strictEqual(result.document, undefined);
}

// Break caught: accepting a well-formed product closeout would regress its public contract.
assert.deepStrictEqual(parse(validProduct).diagnostics, []);
assert.deepStrictEqual(parse(validBugfix, "bugfix").diagnostics, []);

// Break caught: passing malformed JSON through as a valid closeout.
assertInvalidJson();
function assertInvalidJson() {
  const result = parseCloseoutJson("{", "product-change", "closeout.json");
  assert.ok(result.diagnostics.every(
    (diagnostic: { code: string; path: string }) => diagnostic.code === "CLOSEOUT_INVALID" && diagnostic.path === "closeout.json",
  ));
  assert.strictEqual(result.document, undefined);
}

// Break caught: accepting a document version outside the supported contract.
assertInvalid({ ...validProduct, version: 2 });

// Break caught: silently accepting fields the contract does not define at any object level.
assertInvalid({ ...validProduct, unexpected: true });
{
  const value = cloneProduct();
  value.evidence[0] = { ...value.evidence[0], unexpected: true } as typeof value.evidence[0];
  assertInvalid(value);
}

// Break caught: allowing a product change to omit its required product traceability fields.
for (const field of ["prd", "sharedFeature", "requirements", "featureResults"] as const) {
  const value = cloneProduct();
  delete value[field];
  assertInvalid(value);
}

// Break caught: allowing a bugfix to carry product-change-only traceability fields.
assertInvalid({ ...validBugfix, prd: validProduct.prd }, "bugfix");

// Break caught: accepting an incomplete or expanded fixed gate set.
{
  const missingGate = cloneProduct();
  delete (missingGate.gates as Partial<typeof missingGate.gates>).browser;
  assertInvalid(missingGate);
  assertInvalid({ ...validProduct, gates: { ...validProduct.gates, other: validProduct.gates.browser } });
}

// Break caught: accepting whitespace-only required text fields.
{
  const value = cloneProduct();
  value.evidence[0].command = "   ";
  assertInvalid(value);
}

// Break caught: accepting malformed identifiers for traceability records.
{
  const requirement = cloneProduct();
  requirement.requirements[0].id = "auth-001";
  assertInvalid(requirement);
  const featureResult = cloneProduct();
  featureResult.featureResults[0].id = "FR_invalid";
  assertInvalid(featureResult);
  const evidence = cloneProduct();
  evidence.evidence[0].id = "TEST-001";
  assertInvalid(evidence);
}

// Break caught: permitting ambiguous duplicate identities in independent trace collections.
for (const collection of ["requirements", "featureResults", "evidence"] as const) {
  const value = cloneProduct();
  value[collection].push({ ...value[collection][0] } as never);
  assertInvalid(value);
}

// Break caught: permitting repeated links that make a trace or gate ambiguous.
{
  const requirement = cloneProduct();
  requirement.requirements[0].acceptanceIds.push("PA-001");
  assertInvalid(requirement);
  const featureResult = cloneProduct();
  featureResult.featureResults[0].evidenceIds.push("EV-TEST-001");
  assertInvalid(featureResult);
  assertInvalid({
    ...cloneProduct(),
    gates: { ...validProduct.gates, security: { applicable: true, reason: "Security reviewed", evidenceIds: ["EV-TEST-001", "EV-TEST-001"] } },
  });
}

// Break caught: treating unverified evidence as evidence that can close a change.
assertInvalid({ ...validProduct, evidence: [{ ...validProduct.evidence[0], status: "failed" }] });

// Break caught: accepting gates whose evidence cardinality contradicts applicability.
{
  assertInvalid({
    ...cloneProduct(),
    gates: { ...validProduct.gates, security: { applicable: true, reason: "Security reviewed", evidenceIds: [] } },
  });
  assertInvalid({
    ...cloneProduct(),
    gates: { ...validProduct.gates, security: { applicable: false, reason: "No security boundary change", evidenceIds: ["EV-TEST-001"] } },
  });
}

process.stdout.write("PASS validates the strict closeout JSON contract.\n");
