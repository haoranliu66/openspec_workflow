# P0 Strict Active Change Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-platform, installable CI gate that enumerates every active OpenSpec change directory and runs the exact command `openspec validate <change> --strict` for each one, while leaving archive immutability as a documented policy only.

**Architecture:** Extract project-root discovery and safe OpenSpec process invocation into focused shared libraries, then build a sequential active-change validator on top. Wire the emitted JavaScript into the installer, package scripts, and GitHub Actions; cover directory edge cases, aggregate failure behavior, installed runtime behavior, and real OpenSpec 1.5.0 validation.

**Tech Stack:** TypeScript 7.0.2, Node.js >=20.19.0 built-in `fs`/`path`/`child_process`, OpenSpec CLI 1.5.0, GitHub Actions on Node.js 20.19.x and 22.x.

## Global Constraints

- Execute the exact per-change command `openspec validate <change> --strict`; do not substitute `openspec validate --changes` or add `--type change`.
- Enumerate direct child directories of `openspec/changes/` from the filesystem, excluding only `archive`, dot-prefixed directories, files, symbolic links, and other non-directories.
- Validate change IDs with the approved regular expression `^[a-z0-9][a-z0-9-]*$`; invalid directory names are reported as failures and never reach a shell.
- Sort change names with `localeCompare(name, "en")`, execute valid changes sequentially, continue after per-change failures, and report one stable aggregate failure after all entries are considered.
- A missing or unreadable `openspec/changes/` fails closed; an existing directory with zero active changes succeeds with an explicit message.
- Windows invokes `openspec.cmd` through `cmd.exe /d /s /c` only after every argument passes the shared whitelist; Unix invokes `openspec` with an argument array and no shell.
- Source stays TypeScript-only under `bin/`, `lib/`, `scripts/`, and `tests/`; installed targets receive emitted JavaScript only.
- Keep Node.js `>=20.19.0` and OpenSpec CLI `1.5.0`; GitHub Actions continues to test Node.js `20.19.x` and `22.x`.
- Release version is `2.1.0`.
- Do not add archive hashes, `archive-integrity` modules, Git base refs, merge-base logic, `fetch-depth: 0`, full-history requirements, or new archive mutation/enforcement.
- Do not modify, move, or rewrite any path under `openspec/changes/archive/`.

---

## File Map

### Create

- `lib/project-root.ts` — resolve the project root for source, compiled, installed, and target-directory-named-`dist` layouts.
- `lib/openspec-cli.ts` — validate OpenSpec arguments, construct platform-specific invocations, and execute the CLI.
- `scripts/validate-changes.ts` — enumerate active changes, run strict validation for each valid ID, and aggregate failures.
- `tests/project-root.test.ts` — root-resolution unit coverage.
- `tests/openspec-cli.test.ts` — Unix/Windows invocation and shell-safety unit coverage.
- `tests/validate-changes.test.ts` — enumeration, ordering, invalid-ID, failure-isolation, and output unit coverage.
- `tests/openspec-integration.test.ts` — installed emitted-JavaScript test against real OpenSpec 1.5.0.

### Modify

- `scripts/validate-schemas.ts` — use the shared root and CLI modules while preserving product schema alignment and both schema validations.
- `tests/validate-schemas.test.ts` — assert the refactored runner contract, validation order, and alignment short-circuit.
- `lib/installer.ts` — install the three new emitted JavaScript files.
- `tests/installer.test.ts` — update fake distribution, manifest, exact runtime file list, and installed-script probe.
- `tests/typescript-layout.test.ts` — require all new compiled outputs while retaining the no-source-JavaScript boundary.
- `package.json` — add test and validation commands, include strict validation in `verify`, and set version 2.1.0.
- `package-lock.json` — keep root package metadata at version 2.1.0.
- `.github/workflows/validate.yml` — add the compiled active-change validation gate after schema validation.
- `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/FULLSTACK_WORKFLOW.md`, `docs/QUALITY_GATES.md`, `docs/ADOPTION.md`, `docs/OPERATIONS.md`, `examples/sample-project/README.md` — document the enabled gate and the explicit archive-enforcement non-goal.

### Preserve Unchanged

- `scripts/openspec-governance.ts`, `tests/governance.test.ts`, and `bin/workflow.ts`.
- Every existing file and directory under `openspec/changes/archive/`.

---

### Task 1: Shared Project Root and Safe OpenSpec Invocation

**Files:**

- Create: `lib/project-root.ts`
- Create: `lib/openspec-cli.ts`
- Create: `tests/project-root.test.ts`
- Create: `tests/openspec-cli.test.ts`
- Modify: `scripts/validate-schemas.ts`
- Modify: `tests/validate-schemas.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces:

```ts
export function resolveProjectRoot(scriptDirectory: string): string;

export interface Invocation {
  command: string;
  args: string[];
}

export interface RunOpenSpecOptions {
  cwd: string;
  stdio?: "pipe" | "inherit";
  encoding?: BufferEncoding;
}

export type OpenSpecRunner = (
  args: readonly string[],
  options: RunOpenSpecOptions,
) => string | Buffer | null;

export function buildInvocation(
  platform: NodeJS.Platform,
  args: readonly string[],
  commandShell?: string,
): Invocation;

export function runOpenSpec(
  args: readonly string[],
  options: RunOpenSpecOptions,
): string | Buffer | null;
```

- Refactors `scripts/validate-schemas.ts` to produce:

```ts
export const schemas: readonly ["bugfix", "product-change"];
export function validateSchemas(root: string, run?: OpenSpecRunner): void;
export function main(run?: OpenSpecRunner, root?: string): void;
```

- Later tasks consume `resolveProjectRoot`, `OpenSpecRunner`, and `runOpenSpec` without redefining their behavior.

- [ ] **Step 1: Add failing project-root tests**

Create `tests/project-root.test.ts` with:

```ts
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveProjectRoot } from "../lib/project-root";

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-project-root-"));

try {
  const sourceRoot = path.join(base, "source");
  fs.mkdirSync(path.join(sourceRoot, "dist", "scripts"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(sourceRoot, "dist", "scripts")),
    sourceRoot,
  );

  const installedRoot = path.join(base, "installed");
  fs.mkdirSync(path.join(installedRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(installedRoot, "openspec", "schemas"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(installedRoot, "scripts")),
    installedRoot,
  );

  const manifestRoot = path.join(base, "manifest-target");
  fs.mkdirSync(path.join(manifestRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(manifestRoot, ".ai-workflow.json"), "{}\n", "utf8");
  assert.strictEqual(
    resolveProjectRoot(path.join(manifestRoot, "scripts")),
    manifestRoot,
  );

  const namedDistRoot = path.join(base, "dist");
  fs.mkdirSync(path.join(namedDistRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(namedDistRoot, "openspec", "schemas"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(namedDistRoot, "scripts")),
    namedDistRoot,
  );

  const unmarkedInstalledRoot = path.join(base, "unmarked-target");
  fs.mkdirSync(path.join(unmarkedInstalledRoot, "scripts"), { recursive: true });
  assert.strictEqual(
    resolveProjectRoot(path.join(unmarkedInstalledRoot, "scripts")),
    unmarkedInstalledRoot,
  );
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS resolves source and installed project roots.\n");
```

- [ ] **Step 2: Add failing OpenSpec invocation tests**

Create `tests/openspec-cli.test.ts` with:

```ts
import assert from "node:assert";

import { buildInvocation } from "../lib/openspec-cli";

const windows = buildInvocation(
  "win32",
  ["validate", "add-example", "--strict"],
  "C:\\Windows\\System32\\cmd.exe",
);
assert.deepStrictEqual(windows, {
  command: "C:\\Windows\\System32\\cmd.exe",
  args: [
    "/d",
    "/s",
    "/c",
    "openspec.cmd validate add-example --strict",
  ],
});

const unix = buildInvocation("linux", [
  "schema",
  "validate",
  "product-change",
]);
assert.deepStrictEqual(unix, {
  command: "openspec",
  args: ["schema", "validate", "product-change"],
});

[
  "",
  " ",
  "bad & whoami",
  "bad|whoami",
  "bad<in",
  "bad>out",
  "bad^escape",
  "bad%PATH%",
  "bad!value!",
  "bad\"quote",
  "bad'quote",
  "../bad",
  "bad/name",
  "bad\\name",
  "bad\nname",
].forEach((unsafeArgument) => {
  assert.throws(
    () => buildInvocation("win32", ["validate", unsafeArgument, "--strict"]),
    /Unsafe OpenSpec argument/,
  );
});

process.stdout.write("PASS builds safe platform-specific OpenSpec invocations.\n");
```

- [ ] **Step 3: Rewrite schema-validator tests against the shared runner**

Replace `tests/validate-schemas.test.ts` with:

```ts
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
```

- [ ] **Step 4: Run the new tests to prove the shared modules are absent**

Run:

```powershell
npm run build
```

Expected: `FAIL` with TypeScript `TS2307` errors for `../lib/project-root` and `../lib/openspec-cli`.

- [ ] **Step 5: Implement project-root resolution**

Create `lib/project-root.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

function isProjectRoot(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, "openspec", "schemas"))
    || fs.existsSync(path.join(candidate, ".ai-workflow.json"));
}

export function resolveProjectRoot(scriptDirectory: string): string {
  const parent = path.resolve(scriptDirectory, "..");
  if (isProjectRoot(parent)) return parent;
  return path.basename(parent) === "dist"
    ? path.resolve(parent, "..")
    : parent;
}
```

- [ ] **Step 6: Implement the safe OpenSpec CLI adapter**

Create `lib/openspec-cli.ts`:

```ts
import childProcess from "node:child_process";

export interface Invocation {
  command: string;
  args: string[];
}

export interface RunOpenSpecOptions {
  cwd: string;
  stdio?: "pipe" | "inherit";
  encoding?: BufferEncoding;
}

export type OpenSpecRunner = (
  args: readonly string[],
  options: RunOpenSpecOptions,
) => string | Buffer | null;

const SAFE_ARGUMENT = /^(?:[a-z0-9][a-z0-9-]*|--[a-z0-9-]+)$/;

function assertSafeArguments(args: readonly string[]): void {
  args.forEach((argument) => {
    if (!SAFE_ARGUMENT.test(argument)) {
      throw new Error(`Unsafe OpenSpec argument: ${JSON.stringify(argument)}`);
    }
  });
}

export function buildInvocation(
  platform: NodeJS.Platform,
  args: readonly string[],
  commandShell = process.env.ComSpec || "cmd.exe",
): Invocation {
  assertSafeArguments(args);
  if (platform === "win32") {
    return {
      command: commandShell,
      args: ["/d", "/s", "/c", `openspec.cmd ${args.join(" ")}`],
    };
  }
  return {
    command: "openspec",
    args: [...args],
  };
}

export function runOpenSpec(
  args: readonly string[],
  options: RunOpenSpecOptions,
): string | Buffer | null {
  const invocation = buildInvocation(process.platform, args);
  const commonOptions = {
    cwd: options.cwd,
    stdio: options.stdio ?? "inherit",
  } as const;

  if (options.encoding !== undefined) {
    return childProcess.execFileSync(invocation.command, invocation.args, {
      ...commonOptions,
      encoding: options.encoding,
    });
  }
  return childProcess.execFileSync(
    invocation.command,
    invocation.args,
    commonOptions,
  );
}
```

- [ ] **Step 7: Refactor schema validation without changing its behavior**

Replace `scripts/validate-schemas.ts` with:

```ts
import path from "node:path";

import {
  OpenSpecRunner,
  runOpenSpec,
} from "../lib/openspec-cli";
import { resolveProjectRoot } from "../lib/project-root";
import { checkProductSchemaAlignment } from "../lib/schema-alignment";

export const schemas = ["bugfix", "product-change"] as const;

export function validateSchemas(
  root: string,
  run: OpenSpecRunner = runOpenSpec,
): void {
  checkProductSchemaAlignment(
    path.join(root, "openspec", "schemas", "product-change"),
  );
  schemas.forEach((schema) => {
    run(["schema", "validate", schema], {
      cwd: root,
      stdio: "inherit",
    });
  });
}

export function main(
  run: OpenSpecRunner = runOpenSpec,
  root = resolveProjectRoot(__dirname),
): void {
  validateSchemas(root, run);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  main();
}
```

- [ ] **Step 8: Register the new unit tests in the compiled test command**

In `package.json`, replace `test:compiled` with:

```json
"test:compiled": "node dist/tests/typescript-layout.test.js && node dist/tests/project-root.test.js && node dist/tests/openspec-cli.test.js && node dist/tests/governance.test.js && node dist/tests/installer.test.js && node dist/tests/validate-schemas.test.js && node dist/tests/schema-alignment.test.js && node dist/tests/change-history.test.js"
```

- [ ] **Step 9: Build and run focused verification**

Run:

```powershell
npm run build
node dist/tests/project-root.test.js
node dist/tests/openspec-cli.test.js
node dist/tests/validate-schemas.test.js
npm run validate:schemas:compiled
```

Expected: build exits `0`; all three tests print `PASS`; OpenSpec prints successful validation for `bugfix` and `product-change`.

- [ ] **Step 10: Commit the shared infrastructure**

```powershell
git add lib/project-root.ts lib/openspec-cli.ts scripts/validate-schemas.ts tests/project-root.test.ts tests/openspec-cli.test.ts tests/validate-schemas.test.ts package.json
git commit -m "refactor: share openspec runtime infrastructure"
```

Expected: one commit containing only the listed files.

---

### Task 2: Active Change Enumeration and Aggregate Strict Validation

**Files:**

- Create: `scripts/validate-changes.ts`
- Create: `tests/validate-changes.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes:

```ts
resolveProjectRoot(scriptDirectory: string): string;
runOpenSpec(args: readonly string[], options: RunOpenSpecOptions): string | Buffer | null;
type OpenSpecRunner = (
  args: readonly string[],
  options: RunOpenSpecOptions,
) => string | Buffer | null;
```

- Produces:

```ts
export interface ChangeValidationFailure {
  changeId: string;
  reason: string;
}

export interface ActiveChangeValidationResult {
  changeIds: string[];
  failures: ChangeValidationFailure[];
}

export type LineWriter = (line: string) => void;

export function listActiveChanges(root: string): string[];

export function validateActiveChanges(
  root: string,
  run?: OpenSpecRunner,
  write?: LineWriter,
): ActiveChangeValidationResult;

export function main(
  run?: OpenSpecRunner,
  root?: string,
  write?: LineWriter,
): void;
```

- `listActiveChanges` intentionally returns invalid directory names so that `validateActiveChanges` can report them instead of silently omitting them.

- [ ] **Step 1: Add failing enumeration and aggregation tests**

Create `tests/validate-changes.test.ts`:

```ts
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OpenSpecRunner } from "../lib/openspec-cli";
import {
  listActiveChanges,
  main,
  validateActiveChanges,
} from "../scripts/validate-changes";

function withProject(fn: (root: string, base: string) => void): void {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-changes-"));
  const root = path.join(base, "project");
  fs.mkdirSync(path.join(root, "openspec", "changes"), { recursive: true });
  try {
    fn(root, base);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

withProject((root, base) => {
  const changes = path.join(root, "openspec", "changes");
  ["z-change", "a-change", "bad_name", "archive", ".hidden"].forEach((name) => {
    fs.mkdirSync(path.join(changes, name), { recursive: true });
  });
  fs.mkdirSync(path.join(changes, "z-change", "nested"), { recursive: true });
  fs.writeFileSync(path.join(changes, "ordinary-file"), "not a change\n", "utf8");
  const linkTarget = path.join(base, "link-target");
  fs.mkdirSync(linkTarget);
  fs.symlinkSync(
    linkTarget,
    path.join(changes, "linked-change"),
    process.platform === "win32" ? "junction" : "dir",
  );

  assert.deepStrictEqual(
    listActiveChanges(root),
    ["a-change", "bad_name", "z-change"],
  );
});

withProject((root) => {
  assert.deepStrictEqual(listActiveChanges(root), []);
  const lines: string[] = [];
  main(() => null, root, (line) => lines.push(line));
  assert.deepStrictEqual(lines, [
    "No active OpenSpec changes found; strict validation skipped.",
  ]);
});

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-missing-changes-"));
try {
  assert.throws(
    () => listActiveChanges(missingRoot),
    /Cannot read active changes directory/,
  );
} finally {
  fs.rmSync(missingRoot, { recursive: true, force: true });
}

withProject((root) => {
  const changes = path.join(root, "openspec", "changes");
  fs.rmSync(changes, { recursive: true, force: true });
  fs.writeFileSync(changes, "not a directory\n", "utf8");
  assert.throws(
    () => listActiveChanges(root),
    /Cannot read active changes directory/,
  );
});

withProject((root) => {
  const changes = path.join(root, "openspec", "changes");
  ["a-good", "bad_name", "c-fail", "d-fail", "e-good"].forEach((name) => {
    fs.mkdirSync(path.join(changes, name));
  });

  const calls: string[][] = [];
  const runner: OpenSpecRunner = (args, options) => {
    calls.push([...args]);
    assert.strictEqual(options.cwd, root);
    assert.strictEqual(options.stdio, "inherit");
    if (args[1]?.endsWith("-fail")) {
      throw new Error(`${args[1]} strict validation exited 1`);
    }
    return null;
  };
  const lines: string[] = [];
  const result = validateActiveChanges(root, runner, (line) => lines.push(line));

  assert.deepStrictEqual(calls, [
    ["validate", "a-good", "--strict"],
    ["validate", "c-fail", "--strict"],
    ["validate", "d-fail", "--strict"],
    ["validate", "e-good", "--strict"],
  ]);
  assert.deepStrictEqual(result.changeIds, [
    "a-good",
    "bad_name",
    "c-fail",
    "d-fail",
    "e-good",
  ]);
  assert.deepStrictEqual(result.failures, [
    {
      changeId: "bad_name",
      reason: "invalid change ID; expected ^[a-z0-9][a-z0-9-]*$",
    },
    {
      changeId: "c-fail",
      reason: "c-fail strict validation exited 1",
    },
    {
      changeId: "d-fail",
      reason: "d-fail strict validation exited 1",
    },
  ]);
  assert.deepStrictEqual(lines, [
    "[1/5] validating a-good",
    "[2/5] invalid change ID \"bad_name\"",
    "[3/5] validating c-fail",
    "[4/5] validating d-fail",
    "[5/5] validating e-good",
  ]);

  assert.throws(
    () => main(runner, root, () => undefined),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Strict validation failed for 3 active changes/);
      assert.match(error.message, /- bad_name: invalid change ID/);
      assert.match(error.message, /- c-fail: c-fail strict validation exited 1/);
      assert.match(error.message, /- d-fail: d-fail strict validation exited 1/);
      return true;
    },
  );
});

process.stdout.write("PASS enumerates and strictly validates every active change.\n");
```

- [ ] **Step 2: Run the build to prove the validator does not exist**

Run:

```powershell
npm run build
```

Expected: `FAIL` with `TS2307: Cannot find module '../scripts/validate-changes'`.

- [ ] **Step 3: Implement enumeration, sequential validation, and stable aggregation**

Create `scripts/validate-changes.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

import {
  OpenSpecRunner,
  runOpenSpec,
} from "../lib/openspec-cli";
import { resolveProjectRoot } from "../lib/project-root";

export interface ChangeValidationFailure {
  changeId: string;
  reason: string;
}

export interface ActiveChangeValidationResult {
  changeIds: string[];
  failures: ChangeValidationFailure[];
}

export type LineWriter = (line: string) => void;

const CHANGE_ID = /^[a-z0-9][a-z0-9-]*$/;

function defaultWriter(line: string): void {
  process.stdout.write(`${line}\n`);
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.split(/\r?\n/, 1)[0];
  }
  return String(error);
}

export function listActiveChanges(root: string): string[] {
  const changesRoot = path.join(root, "openspec", "changes");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(changesRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Cannot read active changes directory: ${changesRoot}`,
      { cause: error },
    );
  }

  return entries
    .filter((entry) => (
      entry.isDirectory()
      && entry.name !== "archive"
      && !entry.name.startsWith(".")
    ))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function validateActiveChanges(
  root: string,
  run: OpenSpecRunner = runOpenSpec,
  write: LineWriter = defaultWriter,
): ActiveChangeValidationResult {
  const changeIds = listActiveChanges(root);
  const failures: ChangeValidationFailure[] = [];

  changeIds.forEach((changeId, index) => {
    const progress = `[${index + 1}/${changeIds.length}]`;
    if (!CHANGE_ID.test(changeId)) {
      write(`${progress} invalid change ID ${JSON.stringify(changeId)}`);
      failures.push({
        changeId,
        reason: "invalid change ID; expected ^[a-z0-9][a-z0-9-]*$",
      });
      return;
    }

    write(`${progress} validating ${changeId}`);
    try {
      run(["validate", changeId, "--strict"], {
        cwd: root,
        stdio: "inherit",
      });
    } catch (error) {
      failures.push({ changeId, reason: failureReason(error) });
    }
  });

  return { changeIds, failures };
}

export function main(
  run: OpenSpecRunner = runOpenSpec,
  root = resolveProjectRoot(__dirname),
  write: LineWriter = defaultWriter,
): void {
  const result = validateActiveChanges(root, run, write);
  if (result.changeIds.length === 0) {
    write("No active OpenSpec changes found; strict validation skipped.");
    return;
  }
  if (result.failures.length > 0) {
    throw new Error([
      `Strict validation failed for ${result.failures.length} active changes:`,
      ...result.failures.map(
        ({ changeId, reason }) => `- ${changeId}: ${reason}`,
      ),
    ].join("\n"));
  }
  write(`Validated ${result.changeIds.length} active OpenSpec changes in strict mode.`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Add package commands and the verify gate**

In `package.json`:

1. Insert `node dist/tests/validate-changes.test.js` immediately after `node dist/tests/validate-schemas.test.js` in `test:compiled`.
2. Add:

```json
"validate:changes:compiled": "node dist/scripts/validate-changes.js",
"validate:changes": "npm run build && npm run validate:changes:compiled"
```

3. Replace `verify` with:

```json
"verify": "npm run build && npm run test:compiled && npm run index:compiled && npm run check:compiled && npm run validate:schemas:compiled && npm run validate:changes:compiled"
```

- [ ] **Step 5: Build and run focused validation**

Run:

```powershell
npm run build
node dist/tests/validate-changes.test.js
npm run validate:changes:compiled
```

Expected:

```text
PASS enumerates and strictly validates every active change.
No active OpenSpec changes found; strict validation skipped.
```

Both commands exit `0`.

- [ ] **Step 6: Commit the active-change validator**

```powershell
git add scripts/validate-changes.ts tests/validate-changes.test.ts package.json
git commit -m "feat: validate every active openspec change"
```

Expected: one commit containing only the validator, its tests, and package command wiring.

---

### Task 3: Installed Runtime and Real OpenSpec 1.5.0 Integration

**Files:**

- Create: `tests/openspec-integration.test.ts`
- Modify: `lib/installer.ts`
- Modify: `tests/installer.test.ts`
- Modify: `tests/typescript-layout.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes the emitted files:

```text
dist/lib/project-root.js
dist/lib/openspec-cli.js
dist/scripts/validate-changes.js
```

- Installer maps them exactly to:

```text
lib/project-root.js
lib/openspec-cli.js
scripts/validate-changes.js
```

- The real integration fixture uses change IDs `a-valid`, `b-invalid`, and `c-valid` so English sorting also proves execution order.

- [ ] **Step 1: Extend installer expectations before changing installer production code**

In `tests/installer.test.ts`, add these fake source files inside `makeSource()`:

```ts
write(root, "dist/scripts/validate-changes.js", "module.exports = {};\n");
write(root, "dist/lib/openspec-cli.js", "exports.openSpecCli = true;\n");
write(root, "dist/lib/project-root.js", "exports.projectRoot = true;\n");
```

In the first installation test, add:

```ts
assert.strictEqual(
  read(target, "scripts/validate-changes.js"),
  "module.exports = {};\n",
);
assert.strictEqual(
  read(target, "lib/openspec-cli.js"),
  "exports.openSpecCli = true;\n",
);
assert.strictEqual(
  read(target, "lib/project-root.js"),
  "exports.projectRoot = true;\n",
);
```

Rename the release test to `installs the 2.1 release manifest and emitted JavaScript runtime`, change its version assertion to:

```ts
assert.strictEqual(manifest.version, "2.1.0");
```

Replace its `runtimeFiles` with:

```ts
const runtimeFiles = [
  "lib/change-history.js",
  "lib/openspec-cli.js",
  "lib/project-root.js",
  "lib/schema-alignment.js",
  "scripts/openspec-governance.js",
  "scripts/validate-changes.js",
  "scripts/validate-schemas.js",
];
```

In the installed runtime test, after `run("scripts/validate-schemas.js", []);`, add:

```ts
run("scripts/validate-changes.js", []);
```

The empty installed `openspec/changes/` tree must make that command exit `0` without adding OpenSpec probe records.

- [ ] **Step 2: Require the new compiled artifacts at the TypeScript boundary**

In `tests/typescript-layout.test.ts`, replace the compiled-file array with:

```ts
[
  "dist/bin/workflow.js",
  "dist/lib/installer.js",
  "dist/lib/openspec-cli.js",
  "dist/lib/project-root.js",
  "dist/scripts/openspec-governance.js",
  "dist/scripts/validate-changes.js",
  "dist/scripts/validate-schemas.js",
].forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(repositoryRoot, relativePath)), relativePath);
});
```

- [ ] **Step 3: Add the real installed-runtime test**

Create `tests/openspec-integration.test.ts`:

```ts
import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { installWorkflow } from "../lib/installer";

const releaseRoot = path.resolve(__dirname, "..", "..");

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

const proposal = `# Change: Strict validation probe

## Why

Prove the installed validator uses real OpenSpec strict validation.

## What Changes

- Add a disposable validation fixture.

## Capabilities

### New Capabilities

- \`probe-capability\`: Demonstrate strict validation.

### Modified Capabilities

- None.

## Impact

- Test fixture only.
`;

const validDelta = `## ADDED Requirements

### Requirement: Validate every active change

The workflow SHALL validate each active change independently.

#### Scenario: Valid strict change

- **WHEN** CI validates active changes
- **THEN** this change passes strict validation
`;

const invalidDelta = `## ADDED Requirements

### Requirement: Validate every active change

The workflow SHALL fail strict validation without a scenario.
`;

function writeChange(
  root: string,
  changeId: string,
  delta: string,
): void {
  const changeRoot = path.join(root, "openspec", "changes", changeId);
  write(
    changeRoot,
    ".openspec.yaml",
    "schema: product-change\n",
  );
  write(changeRoot, "proposal.md", proposal);
  write(changeRoot, "specs/probe-capability/spec.md", delta);
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-real-openspec-"));
const target = path.join(base, "target");

try {
  installWorkflow(releaseRoot, target);
  writeChange(target, "a-valid", validDelta);
  writeChange(target, "b-invalid", invalidDelta);
  writeChange(target, "c-valid", validDelta);

  const archiveRoot = path.join(target, "openspec", "changes", "archive");
  const archiveBefore = fs.readdirSync(archiveRoot).sort();
  const result = childProcess.spawnSync(
    process.execPath,
    [path.join(target, "scripts", "validate-changes.js")],
    {
      cwd: target,
      encoding: "utf8",
    },
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.strictEqual(result.status, 1, output);
  assert.match(output, /\[1\/3\] validating a-valid/);
  assert.match(output, /\[2\/3\] validating b-invalid/);
  assert.match(output, /\[3\/3\] validating c-valid/);
  assert.match(output, /Change 'a-valid' is valid/);
  assert.match(output, /Change 'c-valid' is valid/);
  assert.match(output, /must include at least one scenario/);
  assert.match(output, /Strict validation failed for 1 active changes/);
  assert.match(output, /- b-invalid:/);
  assert.ok(
    output.indexOf("validating b-invalid") < output.indexOf("validating c-valid"),
    output,
  );
  assert.deepStrictEqual(fs.readdirSync(archiveRoot).sort(), archiveBefore);

  const installedRuntime = [
    ...fs.readdirSync(path.join(target, "lib")),
    ...fs.readdirSync(path.join(target, "scripts")),
  ];
  assert.ok(installedRuntime.every((file) => file.endsWith(".js")));
  assert.ok(installedRuntime.every((file) => !file.endsWith(".ts")));
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

process.stdout.write("PASS installed runtime validates real OpenSpec changes.\n");
```

- [ ] **Step 4: Register the integration test and prove installer wiring is missing**

Append `node dist/tests/openspec-integration.test.js` to `test:compiled` in `package.json`, then run:

```powershell
npm run build
node dist/tests/installer.test.js
node dist/tests/openspec-integration.test.js
```

Expected: installer assertions fail because the new emitted runtime files are not yet managed/copied; the integration test fails because `scripts/validate-changes.js` is absent from the installed target.

- [ ] **Step 5: Add the exact installer mappings**

In `lib/installer.ts`, add these entries to `REQUIRED_FILES` next to the existing emitted runtime mappings:

```ts
{
  sourcePath: "dist/scripts/validate-changes.js",
  targetPath: "scripts/validate-changes.js",
},
{
  sourcePath: "dist/lib/openspec-cli.js",
  targetPath: "lib/openspec-cli.js",
},
{
  sourcePath: "dist/lib/project-root.js",
  targetPath: "lib/project-root.js",
},
```

Do not add any archive-related file mapping.

- [ ] **Step 6: Bump package metadata to 2.1.0**

Run:

```powershell
npm version 2.1.0 --no-git-tag-version
```

Expected: `package.json` and the root package records in `package-lock.json` change from `2.0.0` to `2.1.0`; no Git tag is created.

- [ ] **Step 7: Build and run distribution/integration verification**

First confirm the required CLI:

```powershell
openspec --version
```

Expected: `1.5.0`.

Then run:

```powershell
npm run build
node dist/tests/typescript-layout.test.js
node dist/tests/installer.test.js
node dist/tests/openspec-integration.test.js
```

Expected: all three tests print `PASS`; installer summary reports all installer tests passed; the integration test itself exits `0` after asserting the installed validator's intentional inner exit code `1`.

- [ ] **Step 8: Commit the installed runtime and release metadata**

```powershell
git add lib/installer.ts tests/installer.test.ts tests/typescript-layout.test.ts tests/openspec-integration.test.ts package.json package-lock.json
git commit -m "feat: distribute strict change validation"
```

Expected: one commit with installer/runtime integration and version metadata only.

---

### Task 4: CI Gate, Documentation, and Release Acceptance

**Files:**

- Modify: `.github/workflows/validate.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/FULLSTACK_WORKFLOW.md`
- Modify: `docs/QUALITY_GATES.md`
- Modify: `docs/ADOPTION.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `examples/sample-project/README.md`

**Interfaces:**

- Consumes:

```text
npm run validate:changes
npm run validate:changes:compiled
node scripts/validate-changes.js
```

- Produces one explicit CI step on both existing Node matrix entries and user-facing instructions that distinguish the enabled strict gate from the intentionally unenforced archive policy.

- [ ] **Step 1: Add the explicit GitHub Actions gate**

In `.github/workflows/validate.yml`, insert this step immediately after `npm run validate:schemas:compiled`:

```yaml
      - run: npm run validate:changes:compiled
```

Keep `actions/checkout@v4` unchanged, including its default history depth. Do not add any archive, base-ref, hash, or Git-history step.

- [ ] **Step 2: Add the 2.1.0 changelog entry**

Insert this section above 2.0.0 in `CHANGELOG.md`:

```markdown
## 2.1.0 - 2026-07-23

- 新增活动 change 文件系统枚举器，按英文名称稳定排序，并逐项执行精确命令 `openspec validate <change> --strict`。
- 单个 change 校验失败后继续处理其余 change，最终稳定汇总非法名称与全部 OpenSpec strict validation 失败项。
- 新增跨平台安全 OpenSpec 调用层与共享项目根识别；源码仓库和安装后的 JavaScript 运行时使用同一逻辑。
- CI 在 Node.js 20.19 与 22 上启用活动 change 严格校验，安装器同步分发所需脚本和共享库。
- 归档不可变仍是工作流政策；本版本不新增 base ref、full-history、hash 或其他程序化强制。

```

- [ ] **Step 3: Update README and agent instructions with exact commands**

Make these exact content changes:

1. In `README.md`, change the opening version from `2.0.0` to `2.1.0`.
2. In the source-repository command block, add:

```powershell
npm run validate:changes
```

3. In the installed-target command block, add:

```powershell
node scripts/validate-changes.js
```

4. Replace the deferred-P0 bullet with:

```markdown
- CI 与 `npm run verify` 会枚举 `openspec/changes/` 下除 `archive`、隐藏目录和非目录项之外的所有一级目录，并逐项执行 `openspec validate <change> --strict`；任一失败都会使门禁失败。
- 归档不可变仍是流程政策；2.1.0 不增加 base ref、full-history、hash 或其他额外程序强制。
```

5. In `AGENTS.md`, replace the final deferred-P0 rule with:

```markdown
- 提交前运行 `npm run validate:changes`；安装目标运行 `node scripts/validate-changes.js`。该命令从文件系统枚举全部活动 change，并逐项执行 `openspec validate <change> --strict`。
- 归档不可变仍是流程约束；2.1.0 不提供 base-ref、hash 或 full-history 程序化强制，不得宣称已经提供。
```

- [ ] **Step 4: Update workflow, quality-gate, adoption, and operations guides**

Apply the following exact statements:

1. In `docs/FULLSTACK_WORKFLOW.md`, change `2.0 工作流` to `2.1 工作流`, replace the deferred-P0 line with:

```markdown
- CI 和本地 `verify` 从文件系统枚举所有活动 change，并逐项执行 `openspec validate <change> --strict`；损坏或非法命名的目录不能被静默遗漏。
- 归档不可变继续作为流程政策；本版本不增加基于 base ref、hash 或 full-history 的程序化强制。
```

2. In `docs/QUALITY_GATES.md`, replace the final sentence of the “所有变更” OpenSpec bullet so the full bullet reads:

```markdown
- 按当前 change 执行 OpenSpec 校验并记录结果；工作流 CI 还会枚举全部活动 changes 并逐项执行 `openspec validate <change> --strict`。
```

Replace the CI summary paragraph with:

```markdown
CI 在 Node.js 20.19 和 22 上检查 TypeScript 源边界、测试、两个确定性生成文件、两个 schema、全部活动 changes 的逐项 strict validation 以及当前治理命令。`dist/` 可以在构建时生成，但 `bin/`、`lib/`、`scripts/`、`tests/` 下不得出现 `.js`。
```

Replace its final deferred-P0 paragraph with:

```markdown
活动 change strict validation 已是 2.1.0 门禁。归档不可变仍是流程政策，本版本不新增跨 base ref、full-history、hash 或其他程序化强制。
```

3. In `docs/ADOPTION.md`, add this line after `node scripts/validate-schemas.js` in the CI block:

```powershell
node scripts/validate-changes.js
```

Replace its deferred-P0 paragraph with:

```markdown
`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细机器历史；活动 change 在尚无 specs 时也会出现在历史中。`node scripts/validate-changes.js` 从文件系统枚举所有活动 change 目录并逐项执行 `openspec validate <change> --strict`。归档不可变仍是流程政策，2.1.0 不要求 full-history checkout、baseRef 配置或 hash 校验。
```

4. In `docs/OPERATIONS.md`, replace the literal text **维护版本 2.0.0** with **维护版本 2.1.0**. Replace the governance paragraph with the exact paragraph below, then insert the strict-validation section after it.

```markdown
当前治理检查验证必要目录、两份生成文件是否过期、历史解析诊断，并对工作区相对当前 HEAD 的 archive 修改/删除提供局部保护。它不是跨分支 base ref 的归档不可变性证明；本版本不新增 full-history、baseRef 或 hash 强制。
```

Then insert this section after “治理检查”:

````markdown
## 活动 change 严格校验

```powershell
node scripts/validate-changes.js
```

该命令读取 `openspec/changes/` 的一级目录，排除 `archive`、隐藏目录和非目录项，按英文名称排序，并逐项执行 `openspec validate <change> --strict`。单项失败不会阻止后续诊断，全部处理后统一失败。归档不可变没有新增 base ref、full-history 或 hash 强制。
````

In the upgrade checklist, change step 5 to:

```markdown
5. 合并 config 示例，验证两个 schemas、两份生成文件、严格校验项目全部活动 changes，并确认项目已有 CI 调用 `node scripts/validate-changes.js`。
```

- [ ] **Step 5: Update the sample installed layout**

In `examples/sample-project/README.md`, replace the runtime portion of the tree with:

```text
  lib/
    change-history.js
    openspec-cli.js
    project-root.js
    schema-alignment.js
  scripts/
    openspec-governance.js
    validate-changes.js
    validate-schemas.js
```

Append this paragraph:

```markdown
安装目标在 CI 中运行 `node scripts/validate-changes.js`，按文件系统一级目录逐项执行 `openspec validate <change> --strict`。归档不可变仍由流程政策约束，2.1.0 没有新增 base ref、full-history 或 hash 程序。
```

- [ ] **Step 6: Build and run the complete acceptance sequence**

Run each command separately so a failure identifies its gate:

```powershell
npm run build
npm run test:compiled
npm run index:compiled
git diff --exit-code -- SPEC.md openspec/change-history.json
npm run validate:schemas:compiled
npm run validate:changes:compiled
npm run check:compiled
npm run verify
git diff --check
```

Expected:

- Every command exits `0`.
- `test:compiled` includes the new unit and real OpenSpec integration tests.
- Repository-level strict validation prints `No active OpenSpec changes found; strict validation skipped.` because the repository currently contains only `archive`.
- `SPEC.md` and `openspec/change-history.json` remain byte-for-byte current.
- No command creates or changes an archive file.

- [ ] **Step 7: Audit the non-goals and packaging**

Run:

```powershell
git diff --name-only 59a71938945005703b9b57a35f1c1b2147bfa868...HEAD -- openspec/changes/archive
rg -n "fetch-depth|archive-base|merge-base|archive-integrity" .github lib scripts package.json
npm pack --dry-run --ignore-scripts --json
git status --short
```

Expected:

- The archive diff command prints nothing.
- The `rg` command finds no new CI/runtime enforcement reference; if it exits `1` because there are no matches, that is the expected result.
- The package dry run lists `dist/scripts/validate-changes.js`, `dist/lib/openspec-cli.js`, and `dist/lib/project-root.js`.
- Git status contains only the intended Task 4 documentation/CI changes before the commit.

- [ ] **Step 8: Commit CI and release documentation**

```powershell
git add .github/workflows/validate.yml README.md AGENTS.md CHANGELOG.md docs/FULLSTACK_WORKFLOW.md docs/QUALITY_GATES.md docs/ADOPTION.md docs/OPERATIONS.md examples/sample-project/README.md
git commit -m "docs: release strict active change validation"
```

Expected: one final implementation commit with CI and documentation only.

- [ ] **Step 9: Perform the final clean-tree verification**

Run:

```powershell
npm run verify
git diff --check
git status --short --branch
```

Expected: verification exits `0`, diff check exits `0`, and the branch has no uncommitted changes.

---

## Acceptance Traceability

| Approved requirement | Implemented and verified by |
|---|---|
| Filesystem enumeration of every direct active change directory | Task 2 unit tests and `listActiveChanges` |
| Exclude `archive`, hidden directories, files, and symlinks | Task 2 filtering fixture |
| Stable English sort | Task 2 expected order and Task 3 `a/b/c` fixture |
| Invalid names fail without reaching Windows shell | Task 1 whitelist tests and Task 2 injected-runner assertions |
| Exact `openspec validate <change> --strict` per valid change | Task 2 exact argument arrays and Task 3 real CLI output |
| Continue after failures and aggregate at the end | Task 2 two-failure unit path and Task 3 invalid-middle fixture |
| Missing directory fails; empty set passes explicitly | Task 2 filesystem tests and repository command |
| Source, compiled, installed, Windows, and Unix layouts | Tasks 1 and 3 |
| Installer and manifest contain emitted JavaScript only | Task 3 installer and layout assertions |
| CI Node 20.19/22 gate | Task 4 workflow step |
| Version and operational docs are 2.1.0 | Tasks 3 and 4 |
| No archive immutability program or archive mutation | Global constraints, Task 3 archive snapshot, and Task 4 scope audit |
