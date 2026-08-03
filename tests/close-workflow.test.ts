import assert from "node:assert";

import {
  closeChange,
  type CloseWorkflowDependencies,
  CloseWorkflowError,
} from "../lib/close-workflow";

const root = "/project";

function passingDependencies(calls: string[]): CloseWorkflowDependencies {
  return {
    validate: () => calls.push("validate"),
    archive: (_root: string, args: readonly string[]) => calls.push(`archive:${args.join(" ")}`),
    index: () => calls.push("index"),
    check: () => calls.push("check"),
  };
}

{
  const calls: string[] = [];
  const result = closeChange(root, "add-login", { skipSpecs: false }, passingDependencies(calls));

  assert.deepStrictEqual(calls, [
    "validate",
    "archive:archive add-login --yes --json",
    "index",
    "check",
  ]);
  assert.deepStrictEqual(result, { changeId: "add-login", archived: true });
}

{
  const calls: string[] = [];
  closeChange(root, "add-login", { skipSpecs: true }, passingDependencies(calls));
  assert.strictEqual(calls[1], "archive:archive add-login --skip-specs --yes --json");
}

{
  const calls: string[] = [];
  const strictFailure = new Error("strict validation failed");
  assert.throws(
    () => closeChange(root, "add-login", { skipSpecs: false }, {
      ...passingDependencies(calls),
      validate: () => {
        calls.push("validate");
        throw strictFailure;
      },
    }),
    (error: unknown) => error === strictFailure,
  );
  // Strict validation is the only pre-archive program gate.
  assert.deepStrictEqual(calls, ["validate"]);
}

{
  const calls: string[] = [];
  const archiveFailure = new Error("archive failed");
  assert.throws(
    () => closeChange(root, "add-login", { skipSpecs: false }, {
      ...passingDependencies(calls),
      archive: () => {
        calls.push("archive");
        throw archiveFailure;
      },
    }),
    (error: unknown) => error === archiveFailure,
  );
  assert.deepStrictEqual(calls, ["validate", "archive"]);
}

for (const stage of ["index", "check"] as const) {
  const calls: string[] = [];
  assert.throws(
    () => closeChange(root, "add-login", { skipSpecs: false }, {
      ...passingDependencies(calls),
      [stage]: () => {
        calls.push(`${stage}:failed`);
        throw new Error(`${stage} failed`);
      },
    }),
    (error: unknown) => error instanceof CloseWorkflowError && error.archived === true,
  );
  assert.deepStrictEqual(calls, stage === "index"
    ? ["validate", "archive:archive add-login --yes --json", "index:failed"]
    : ["validate", "archive:archive add-login --yes --json", "index", "check:failed"]);
}

process.stdout.write("PASS closes changes through strict validation and mechanical finalization.\n");
