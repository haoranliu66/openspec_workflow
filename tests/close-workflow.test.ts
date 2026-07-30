import assert from "node:assert";

import {
  closeChange,
  type CloseWorkflowDependencies,
  CloseWorkflowError,
} from "../lib/close-workflow";

const root = "/project";

function passingDependencies(calls: string[]): CloseWorkflowDependencies {
  return {
    validate: () => {
      calls.push("validate");
      return {
        changeId: "add-login",
        schema: "product-change" as const,
        diagnostics: [],
        warnings: [],
      };
    },
    warn: (entry: { code: string; path: string }) => calls.push(`warn:${entry.code}:${entry.path}`),
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
  const dependencies = passingDependencies(calls);
  dependencies.validate = () => {
    calls.push("validate");
    return {
      changeId: "add-login",
      schema: "product-change",
      diagnostics: [],
      warnings: [{
        code: "TASKS_INCOMPLETE",
        path: "tasks.md",
        message: "unfinished task at line 1",
      }],
    };
  };

  // Break caught: warning-only closeout must report the warning before attempting archive.
  assert.deepStrictEqual(
    closeChange(root, "add-login", { skipSpecs: false }, dependencies),
    { changeId: "add-login", archived: true },
  );
  assert.deepStrictEqual(calls, [
    "validate",
    "warn:TASKS_INCOMPLETE:tasks.md",
    "archive:archive add-login --yes --json",
    "index",
    "check",
  ]);
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
      validate: () => {
        calls.push("validate");
        return {
          changeId: "add-login",
          schema: "product-change" as const,
          diagnostics: [{
            code: "GATE_INVALID",
            path: "closeout.json",
            message: "invalid evidence for gate: security",
          }],
          warnings: [{
            code: "TASKS_INCOMPLETE",
            path: "tasks.md",
            message: "unfinished task at line 1",
          }],
        };
      },
    }),
    // Break caught: flattening validation failure to a generic close error hides the failed gate from operators.
    (error: unknown) => error instanceof CloseWorkflowError
      && error.archived === false
      && /GATE_INVALID/.test(error.message),
  );
  assert.deepStrictEqual(calls, ["validate", "warn:TASKS_INCOMPLETE:tasks.md"]);
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
