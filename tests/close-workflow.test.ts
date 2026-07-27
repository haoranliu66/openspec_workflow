import assert from "node:assert";

import { closeChange, CloseWorkflowError } from "../lib/close-workflow";

const root = "/project";

function passingDependencies(calls: string[]) {
  return {
    validate: () => {
      calls.push("validate");
      return { changeId: "add-login", schema: "product-change" as const, diagnostics: [] };
    },
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
  assert.throws(
    () => closeChange(root, "add-login", { skipSpecs: false }, {
      ...passingDependencies(calls),
      validate: () => ({
        changeId: "add-login",
        schema: "product-change" as const,
        diagnostics: [{ code: "TASKS_INVALID", path: "tasks.md", message: "incomplete" }],
      }),
    }),
    (error: unknown) => error instanceof CloseWorkflowError && error.archived === false,
  );
  assert.deepStrictEqual(calls, []);
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
    // Break caught: removing post-archive recovery state would conceal that archive already succeeded.
    (error: unknown) => error instanceof CloseWorkflowError && error.archived === true,
  );
  assert.deepStrictEqual(calls, stage === "index"
    ? ["validate", "archive:archive add-login --yes --json", "index:failed"]
    : ["validate", "archive:archive add-login --yes --json", "index", "check:failed"]);
}

process.stdout.write("PASS closes changes in guarded order.\n");
