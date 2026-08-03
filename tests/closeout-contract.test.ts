import assert from "node:assert";

import { parseCloseoutJson } from "../lib/closeout-contract";

const validProduct = {
  version: 1,
  requirements: [{ id: "AUTH-001", acceptanceIds: ["PA-001"] }],
  evidence: [{
    id: "EV-TEST-001",
    type: "test",
    status: "passed",
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

function parse(value: unknown, schema: "product-change" | "bugfix" | "spec-driven" = "product-change") {
  return parseCloseoutJson(JSON.stringify(value), schema, "closeout.json");
}

function cloneProduct(): typeof validProduct {
  return JSON.parse(JSON.stringify(validProduct)) as typeof validProduct;
}

function assertInvalid(value: unknown, schema: "product-change" | "bugfix" | "spec-driven" = "product-change") {
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
assert.deepStrictEqual(parse(validBugfix, "spec-driven").diagnostics, []);

// Break caught: passing malformed JSON through as a valid closeout.
assertInvalidJson();
function assertInvalidJson() {
  const result = parseCloseoutJson("{", "product-change", "closeout.json");
  assert.ok(result.diagnostics.length > 0);
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

// Break caught: allowing a product change to omit its required requirement traceability field.
{
  const value = cloneProduct() as Partial<typeof validProduct>;
  delete value.requirements;
  assertInvalid(value);
}

// Break caught: allowing removed closeout fields or product-only fields in the wrong schema.
for (const field of ["prd", "sharedFeature", "featureResults"] as const) {
  assertInvalid({ ...validProduct, [field]: field === "featureResults" ? [] : "obsolete.md" });
}
assertInvalid({ ...validBugfix, requirements: validProduct.requirements }, "bugfix");
assertInvalid({ ...validBugfix, requirements: validProduct.requirements }, "spec-driven");

// Break caught: accepting an incomplete or expanded fixed gate set.
{
  const missingGate = cloneProduct();
  delete (missingGate.gates as Partial<typeof missingGate.gates>).browser;
  assertInvalid(missingGate);
  assertInvalid({ ...validProduct, gates: { ...validProduct.gates, other: validProduct.gates.browser } });
}

// Break caught: accepting a whitespace-only command when the optional field is present.
{
  const value = cloneProduct();
  value.evidence[0] = { ...value.evidence[0], command: "   " } as typeof value.evidence[0];
  assertInvalid(value);
}

// Break caught: accepting malformed identifiers for traceability records.
{
  const requirement = cloneProduct();
  requirement.requirements[0].id = "auth-001";
  assertInvalid(requirement);
  const evidence = cloneProduct();
  evidence.evidence[0].id = "TEST-001";
  assertInvalid(evidence);
}

// Break caught: allowing a product requirement without at least one valid acceptance ID.
{
  const emptyAcceptanceIds = cloneProduct();
  emptyAcceptanceIds.requirements[0].acceptanceIds = [];
  assertInvalid(emptyAcceptanceIds);
  const invalidAcceptanceId = cloneProduct();
  invalidAcceptanceId.requirements[0].acceptanceIds = ["not-an-id"];
  assertInvalid(invalidAcceptanceId);
}

// Break caught: permitting ambiguous duplicate identities in independent trace collections.
for (const collection of ["requirements", "evidence"] as const) {
  const value = cloneProduct();
  value[collection].push({ ...value[collection][0] } as never);
  assertInvalid(value);
}

// Break caught: permitting repeated links that make a trace or gate ambiguous.
{
  const requirement = cloneProduct();
  requirement.requirements[0].acceptanceIds.push("PA-001");
  assertInvalid(requirement);
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
