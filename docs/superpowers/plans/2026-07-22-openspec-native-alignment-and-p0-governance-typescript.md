# OpenSpec Native Alignment, TypeScript Unification, and P0 Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Unify all executable repository source and tests on TypeScript, restore the OpenSpec v1.5.0 native product-change core, generate deterministic change history, and enforce archive immutability plus strict active-change validation.

**Architecture:** Keep TypeScript as the only maintained source language under bin, lib, scripts, and tests. Compile strict TypeScript to an untracked CommonJS dist tree; the package CLI runs from dist, while the installer maps compiled JavaScript into target projects so targets need only Node.js. Keep BR/PRD/FEATURE as outer governance and preserve the native proposal to specs/design to tasks to apply subgraph.

**Tech Stack:** Node.js >=20.19.0, TypeScript 7.0.2, @types/node 20.19.43, CommonJS output targeting ES2022, OpenSpec CLI 1.5.0, Git, Markdown, YAML, and Node assert tests.

## Global Constraints

- OpenSpec compatibility is fixed to @fission-ai/openspec 1.5.0.
- Node.js runtime floor is >=20.19.0; CI covers 20.19.x and 22.x.
- TypeScript 7.0.2 and @types/node 20.19.43 are exact development dependencies.
- All maintained executable files under bin, lib, scripts, and tests use .ts; tracked .js files in those directories are forbidden.
- TypeScript uses strict mode, ES2022, Node16/CommonJS resolution, rootDir ".", and outDir "dist".
- dist is ignored and never committed.
- Target projects receive compiled lib/*.js and scripts/*.js and require no TypeScript, tsx, or third-party runtime package.
- Runtime code adds no npm production dependencies.
- proposal, specs, design, tasks, and apply preserve the OpenSpec v1.5.0 dependency graph exactly.
- Existing committed archives are never rewritten.
- Generated SPEC.md and openspec/change-history.json contain no timestamps and are byte-deterministic.
- Production behavior is written only after the focused test has failed for the expected reason.
- Each task commits only its listed scope.

## File and Responsibility Map

| File | Responsibility |
|---|---|
| tsconfig.json | Strict TypeScript compilation into the mirrored dist tree. |
| bin/workflow.ts | Package CLI, argument parsing, source-root resolution, and install/index/check dispatch. |
| lib/installer.ts | Conflict-safe installation and compiled-runtime-to-target mapping. |
| lib/schema-alignment.ts | OpenSpec v1.5.0 native graph and template drift guard. |
| lib/change-history.ts | Deterministic active/archive discovery and delta Requirement parsing. |
| lib/archive-integrity.ts | Git baseline and working-tree archive immutability checks. |
| lib/openspec-cli.ts | Safe cross-platform OpenSpec command construction and execution. |
| scripts/openspec-governance.ts | Generated navigation plus governance orchestration. |
| scripts/validate-schemas.ts | Validate both custom Schemas through the shared CLI runner. |
| scripts/validate-changes.ts | Strictly validate all active changes. |
| tests/typescript-layout.test.ts | Source-language, package-bin, and compiled-layout contract. |
| tests/schema-alignment.test.ts | Native artifact graph and template drift tests. |
| tests/change-history.test.ts | Delta parsing, discovery, ordering, and deterministic JSON tests. |
| tests/archive-integrity.test.ts | Real Git baseline tests for old/new archive rules. |
| tests/openspec-integration.test.ts | Real OpenSpec readiness and strict-validation fixture. |

---

### Task 1: Establish the TypeScript Build and Migrate Existing Runtime Code

**Files:**
- Create: tsconfig.json
- Create: tests/typescript-layout.test.ts
- Modify: .gitignore
- Modify: package.json
- Create through npm: package-lock.json
- Rename: bin/workflow.js to bin/workflow.ts
- Rename: lib/installer.js to lib/installer.ts
- Rename: scripts/openspec-governance.js to scripts/openspec-governance.ts
- Rename: scripts/validate-schemas.js to scripts/validate-schemas.ts
- Rename: tests/governance.test.js to tests/governance.test.ts
- Rename: tests/installer.test.js to tests/installer.test.ts
- Rename: tests/validate-schemas.test.js to tests/validate-schemas.test.ts
- Modify: README.md
- Modify: SPEC.md

**Interfaces:**
- Produces CliOptions with command, target, force, and archiveBase fields.
- Preserves installWorkflow(sourceRoot, targetRoot, options): InstallResult.
- Preserves renderIndex, writeIndex, checkIndex, and checkProject behavior until later tasks replace selected aliases.
- Produces a mirrored dist/bin, dist/lib, dist/scripts, and dist/tests tree.
- The compiled CLI resolves its package source root with path.resolve(__dirname, "..", "..").

- [ ] **Step 1: Install the exact compiler toolchain and add compilation configuration**

Run before adding prepare:

~~~powershell
npm install --save-dev --save-exact typescript@7.0.2 @types/node@20.19.43
~~~

Create tsconfig.json:

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noEmitOnError": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node"],
    "composite": true,
    "declaration": true,
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": [
    "bin/**/*.ts",
    "lib/**/*.ts",
    "scripts/**/*.ts",
    "tests/**/*.ts"
  ],
  "exclude": ["dist", "node_modules"]
}
~~~

Add dist/ to .gitignore. Do not add a JavaScript build helper.

- [ ] **Step 2: Write the failing TypeScript layout test**

Create tests/typescript-layout.test.ts:

~~~ts
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..", "..");
const sourceRoots = ["bin", "lib", "scripts", "tests"];

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const trackedLanguageRoots = sourceRoots.flatMap((name) => walk(path.join(repositoryRoot, name)));
const javascriptSources = trackedLanguageRoots
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.relative(repositoryRoot, file).replaceAll("\\", "/"))
  .sort();

assert.deepStrictEqual(javascriptSources, []);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
) as { bin: Record<string, string> };
assert.strictEqual(packageJson.bin["ai-fullstack-workflow"], "dist/bin/workflow.js");

[
  "dist/bin/workflow.js",
  "dist/lib/installer.js",
  "dist/scripts/openspec-governance.js",
  "dist/scripts/validate-schemas.js"
].forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(repositoryRoot, relativePath)), relativePath);
});

process.stdout.write("PASS TypeScript is the only maintained executable source language.\n");
~~~

- [ ] **Step 3: Compile only the new test and verify RED**

Run:

~~~powershell
npx tsc -p tsconfig.json
node dist/tests/typescript-layout.test.js
~~~

Expected: compilation succeeds, then the test fails and lists the seven existing .js source/test files.

- [ ] **Step 4: Rename all existing executable JavaScript source**

Run:

~~~powershell
git mv bin/workflow.js bin/workflow.ts
git mv lib/installer.js lib/installer.ts
git mv scripts/openspec-governance.js scripts/openspec-governance.ts
git mv scripts/validate-schemas.js scripts/validate-schemas.ts
git mv tests/governance.test.js tests/governance.test.ts
git mv tests/installer.test.js tests/installer.test.ts
git mv tests/validate-schemas.test.js tests/validate-schemas.test.ts
~~~

- [ ] **Step 5: Add strict module boundaries without changing behavior**

Use node: imports and named exports. Add these exact public types to lib/installer.ts:

~~~ts
export interface InstallOptions {
  force?: boolean;
  backupStamp?: string;
}

export interface InstallResult {
  copied: string[];
  skipped: string[];
  conflicts: string[];
  backedUp: string[];
}

interface ManagedSource {
  sourcePath: string;
  targetPath: string;
}

interface FileOperation {
  relativePath: string;
  content: Buffer;
}

~~~

Replace the string-only required-file list with source/target mappings:

~~~ts
const REQUIRED_FILES: ManagedSource[] = [
  {
    sourcePath: "dist/scripts/openspec-governance.js",
    targetPath: "scripts/openspec-governance.js",
  },
  { sourcePath: "docs/FULLSTACK_WORKFLOW.md", targetPath: "docs/FULLSTACK_WORKFLOW.md" },
  { sourcePath: "docs/QUALITY_GATES.md", targetPath: "docs/QUALITY_GATES.md" },
];
~~~

buildOperations must read sourcePath and emit targetPath. It must validate every mapped source before installWorkflow writes the target. Update installer fixtures to create dist/scripts/openspec-governance.js.

Add these exact CLI types in bin/workflow.ts:

~~~ts
interface CliOptions {
  command: string | undefined;
  target: string;
  force: boolean;
  archiveBase: string | undefined;
}

function parseArguments(args: string[]): CliOptions;
~~~

Keep archiveBase undefined until Task 5 wires it. Change the compiled CLI source root to:

~~~ts
const sourceRoot = path.resolve(__dirname, "..", "..");
~~~

In every catch block use:

~~~ts
const message = error instanceof Error ? error.message : String(error);
~~~

Type test registries as Array<{ name: string; fn: () => void }>. Compiled tests that need repository assets use path.resolve(__dirname, "..", "..").

- [ ] **Step 6: Replace package commands with build-aware commands**

Set engines.node to >=20.19.0, point bin to dist/bin/workflow.js, and use:

~~~json
{
  "clean": "tsc -b --clean",
  "build": "npm run clean && tsc -b",
  "prepare": "npm run build",
  "prepack": "npm run build",
  "test:compiled": "node dist/tests/typescript-layout.test.js && node dist/tests/governance.test.js && node dist/tests/installer.test.js && node dist/tests/validate-schemas.test.js",
  "test": "npm run build && npm run test:compiled",
  "index:compiled": "node dist/scripts/openspec-governance.js index",
  "index": "npm run build && npm run index:compiled",
  "check:compiled": "node dist/scripts/openspec-governance.js check",
  "check": "npm run build && npm run check:compiled",
  "validate:schemas:compiled": "node dist/scripts/validate-schemas.js",
  "validate:schemas": "npm run build && npm run validate:schemas:compiled",
  "verify": "npm run build && npm run test:compiled && npm run index:compiled && npm run check:compiled && npm run validate:schemas:compiled"
}
~~~

Preserve all unrelated package fields. README source-repository commands use npm run index/check/verify. Change the generated SPEC banner to state that the source repository uses npm run index and installed targets use node scripts/openspec-governance.js index.

- [ ] **Step 7: Verify GREEN**

Run:

~~~powershell
npm test
npm run index
npm run check
git status --short
~~~

Expected: TypeScript build succeeds, four compiled test files pass, no .js remains in source directories, SPEC.md is refreshed, and dist is absent from Git status.

- [ ] **Step 8: Commit**

~~~powershell
git add .gitignore tsconfig.json package.json package-lock.json bin lib scripts tests README.md SPEC.md
git commit -m "refactor: unify workflow source on TypeScript"
~~~

---

### Task 2: Restore the OpenSpec v1.5.0 Native Product-Change Core

**Files:**
- Create: lib/schema-alignment.ts
- Create: tests/schema-alignment.test.ts
- Modify: openspec/schemas/product-change/schema.yaml
- Modify: openspec/schemas/product-change/templates/proposal.md
- Modify: openspec/schemas/product-change/templates/design.md
- Modify: openspec/schemas/product-change/templates/tasks.md
- Modify: openspec/schemas/product-change/templates/spec.md
- Modify: openspec/config.yaml
- Modify: package.json

**Interfaces:**
- Produces checkProductSchemaAlignment(root: string): { warnings: string[] }.
- Enforces proposal=[], specs=[proposal], design=[proposal], tasks=[specs, design], apply=[tasks].
- Uses filesystem text parsing only; it adds no YAML runtime dependency.

- [ ] **Step 1: Write the failing alignment test**

Create tests/schema-alignment.test.ts. Copy schema.yaml plus proposal.md, design.md, and tasks.md to a temporary root. Assert the repository files pass, then mutate design.requires to include specs and assert:

~~~ts
assert.throws(
  () => checkProductSchemaAlignment(root),
  /design must require only proposal/,
);
~~~

The compiled test resolves repositoryRoot with path.resolve(__dirname, "..", "..").

- [ ] **Step 2: Verify RED**

Run:

~~~powershell
npm run build
~~~

Expected: FAIL with TS2307 because ../lib/schema-alignment does not exist.

- [ ] **Step 3: Implement the contract checker**

Create lib/schema-alignment.ts with:

~~~ts
import fs from "node:fs";
import path from "node:path";

type NativeArtifact = "proposal" | "specs" | "design" | "tasks";

const EXPECTED: Record<NativeArtifact, string[]> = {
  proposal: [],
  specs: ["proposal"],
  design: ["proposal"],
  tasks: ["specs", "design"],
};

~~~

artifactBlock ends at the next artifact or apply. requiresFromBlock supports both inline arrays and indented lists. checkProductSchemaAlignment aggregates every violation and verifies:

- all four exact dependency arrays in order;
- apply requires exactly tasks and tracks tasks.md;
- proposal headings Why, What Changes, Capabilities, Impact;
- design headings Context, Goals / Non-Goals, Decisions, Risks / Trade-offs;
- tasks contains a trackable "- [ ] 1.1" item.

Throw one Error beginning with "product-change native alignment failed:" followed by newline-separated violations.

- [ ] **Step 4: Align Schema and templates**

Set project Schema version to 2. Keep br=[], prd=[br], and feature=[tasks]. Use:

~~~yaml
  - id: proposal
    requires: []
  - id: specs
    requires:
      - proposal
  - id: design
    requires:
      - proposal
  - id: tasks
    requires:
      - specs
      - design
  - id: feature
    requires:
      - tasks

apply:
  requires: [tasks]
  tracks: tasks.md
~~~

proposal.md retains Why, What Changes, Capabilities with New/Modified subsections, and Impact. design.md retains Context, Goals / Non-Goals, Decisions, Risks / Trade-offs, Migration Plan, and Open Questions. tasks.md uses numbered checkbox items. Keep OpenSpec delta headers unchanged in spec.md and move project-only guidance to openspec/config.yaml rules.

- [ ] **Step 5: Verify GREEN**

Add the compiled schema-alignment test to test:compiled, then run:

~~~powershell
npm test
npm run validate:schemas
~~~

Expected: alignment and both OpenSpec Schema validations pass.

- [ ] **Step 6: Commit**

~~~powershell
git add lib/schema-alignment.ts tests/schema-alignment.test.ts openspec/schemas/product-change openspec/config.yaml package.json
git commit -m "feat: align product workflow with native OpenSpec core"
~~~

---

### Task 3: Build Deterministic Change-History Collection

**Files:**
- Create: lib/change-history.ts
- Create: tests/change-history.test.ts
- Modify: package.json

**Interfaces:**
- Produces parseDeltaSpec(content: string, sourcePath: string): RequirementChange[].
- Produces collectChangeHistory(root: string): ChangeHistory.
- Produces renderChangeHistory(model: ChangeHistory): string.

- [ ] **Step 1: Write failing parser and discovery tests**

Use this fixture in tests/change-history.test.ts:

~~~markdown
## ADDED Requirements

### Requirement: AUTH-001 Password login
The system SHALL authenticate a valid account.

#### Scenario: Valid password
- **WHEN** valid credentials are submitted
- **THEN** the user is authenticated

## RENAMED Requirements

- FROM: Legacy login
- TO: Password login
~~~

Assert:

~~~ts
assert.deepStrictEqual(parseDeltaSpec(delta, "specs/auth/spec.md"), [
  { operation: "ADDED", id: "AUTH-001", name: "Password login" },
  {
    operation: "RENAMED",
    id: null,
    name: "Legacy login -> Password login",
    from: "Legacy login",
    to: "Password login",
  },
]);
~~~

Also create one active change without specs and one dated archive with a delta. Assert both appear, active schema comes from .openspec.yaml, missing artifact paths are null, archives carry archiveDate, and two renders are byte-identical.

- [ ] **Step 2: Verify RED**

Run npm run build. Expected: TS2307 for ../lib/change-history.

- [ ] **Step 3: Define exact history types**

Create lib/change-history.ts:

~~~ts
import fs from "node:fs";
import path from "node:path";

export type DeltaOperation = "ADDED" | "MODIFIED" | "REMOVED" | "RENAMED";

export interface RequirementChange {
  operation: DeltaOperation;
  id: string | null;
  name: string;
  from?: string;
  to?: string;
}

export interface CapabilityChange {
  name: string;
  canonicalSpec: string;
  deltaSpec: string;
  requirements: RequirementChange[];
}

export interface ChangeRecord {
  changeId: string;
  directoryName: string;
  state: "active" | "archived";
  archiveDate: string | null;
  schema: string;
  paths: Record<"br" | "prd" | "proposal" | "design" | "tasks" | "feature", string | null>;
  capabilities: CapabilityChange[];
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
}

export interface ChangeHistory {
  version: 1;
  changes: ChangeRecord[];
  diagnostics: Diagnostic[];
}
~~~

- [ ] **Step 4: Implement exact parsing and ordering**

Parsing rules:

- Recognize only second-level ADDED, MODIFIED, REMOVED, and RENAMED Requirements sections.
- Parse third-level "Requirement:" headings.
- Extract an ID only when the first token matches ^[A-Z][A-Z0-9]*-\d+$.
- Support RENAMED Requirement headings and FROM/TO pairs with optional list marker, bold marker, or surrounding backticks.
- Throw "Incomplete RENAMED Requirement in <sourcePath>" for unmatched FROM.
- Reset operation at any unrelated second-level heading.

Discovery rules:

- Active changes are direct directories under openspec/changes except archive.
- Archives are direct directories under openspec/changes/archive.
- Read schema only from .openspec.yaml; active unknown is an error diagnostic, archived unknown is a warning.
- Capabilities come only from specs/<capability>/spec.md.
- Active changes sort by English locale change ID.
- Archives sort by dated directory name, which gives date then full-name ordering.
- Capabilities sort by name.
- Requirements sort by name, then operation, then nullable ID using English locale.
- renderChangeHistory omits diagnostics, uses two-space JSON, and ends with one LF.

- [ ] **Step 5: Verify GREEN and commit**

Add the test to test:compiled, run npm test, then:

~~~powershell
git add lib/change-history.ts tests/change-history.test.ts package.json
git commit -m "feat: generate deterministic OpenSpec change history"
~~~

---

### Task 4: Integrate History into SPEC, Governance, and Installation

**Files:**
- Modify: scripts/openspec-governance.ts
- Modify: tests/governance.test.ts
- Modify: lib/installer.ts
- Modify: tests/installer.test.ts
- Create: openspec/change-history.json
- Modify: SPEC.md

**Interfaces:**
- Produces writeGeneratedFiles(root: string): void.
- Produces checkGeneratedFiles(root: string): void.
- Keeps writeIndex as a compatibility alias to writeGeneratedFiles.
- renderIndex(root: string, model?: ChangeHistory): string shows active changes before specs exist.

- [ ] **Step 1: Write failing governance tests**

Add tests that:

1. Create openspec/changes/early-change/.openspec.yaml plus proposal.md but no specs and assert renderIndex contains early-change, product-change, and proposal.md.
2. Write current SPEC.md and stale openspec/change-history.json with version 0 and assert checkGeneratedFiles throws "change-history.json 已过期".
3. Run writeGeneratedFiles twice and assert both files are byte-identical after the second run.
4. Assert an active unknown schema causes checkProject to fail and an archived unknown schema is returned as a warning.

Extend installer tests to expect openspec/change-history.json plus target lib/schema-alignment.js and lib/change-history.js.

- [ ] **Step 2: Verify RED**

Run npm test. Expected: compile or assertion failure because the new exports and installed assets are absent.

- [ ] **Step 3: Implement one-snapshot rendering**

In scripts/openspec-governance.ts import ChangeHistory and:

~~~ts
const INDEX_FILE = "SPEC.md";
const HISTORY_FILE = "openspec/change-history.json";

function writeFileAtomic(filePath: string, content: string): void {
  const temporary = filePath + "." + process.pid + ".tmp";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporary, content, "utf8");
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function writeGeneratedFiles(root: string): void {
  const model = collectChangeHistory(root);
  writeFileAtomic(path.join(root, INDEX_FILE), renderIndex(root, model));
  writeFileAtomic(path.join(root, HISTORY_FILE), renderChangeHistory(model));
}
~~~

checkGeneratedFiles collects once, rejects error diagnostics, renders both expected strings from the same model, normalizes CRLF to LF for reading, and rejects missing or stale files separately. renderIndex adds an "活动 Change" table with Change, Schema, Capabilities, Existing artifacts and links only to non-null paths. It directs detailed history lookups to openspec/change-history.json.

- [ ] **Step 4: Install compiled dependencies and generate target history**

Add mappings:

~~~ts
{ sourcePath: "dist/lib/schema-alignment.js", targetPath: "lib/schema-alignment.js" },
{ sourcePath: "dist/lib/change-history.js", targetPath: "lib/change-history.js" }
~~~

Do not copy repository openspec/change-history.json. After conflict preflight, collect the target model once and generate target SPEC.md plus history JSON. Include both in managedFiles and force-mode backup rules.

- [ ] **Step 5: Verify GREEN and commit**

Run:

~~~powershell
npm run index
npm test
npm run check
git diff --check
~~~

Then commit:

~~~powershell
git add scripts/openspec-governance.ts tests/governance.test.ts lib/installer.ts tests/installer.test.ts SPEC.md openspec/change-history.json
git commit -m "feat: integrate change history into workflow governance"
~~~

---

### Task 5: Enforce Archive Immutability Across Commits and Working State

**Files:**
- Create: lib/archive-integrity.ts
- Create: tests/archive-integrity.test.ts
- Modify: scripts/openspec-governance.ts
- Modify: bin/workflow.ts
- Modify: tests/governance.test.ts
- Modify: package.json

**Interfaces:**
- Produces parseNameStatus(output: string): FileChange[].
- Produces checkArchiveIntegrity(root: string, options?: ArchiveIntegrityOptions): { checkedBase: string | null }.
- CLI accepts --archive-base <git-ref> only for check.

- [ ] **Step 1: Write real Git tests first**

Create a temporary Git repository, configure local test identity, commit openspec/changes/archive/2026-01-01-old/proposal.md, and capture that SHA as baseRef.

Fail cases:

- committed modification in the old archive after baseRef;
- staged or unstaged deletion;
- rename or copy touching an old archive;
- newly added tracked file in the old archive;
- untracked file in the old archive;
- invalid base ref.

Pass case: a wholly new openspec/changes/archive/2026-02-01-new directory containing additions only.

- [ ] **Step 2: Verify RED**

Run npm run build. Expected: TS2307 for ../lib/archive-integrity.

- [ ] **Step 3: Implement typed Git classification**

Use:

~~~ts
export interface FileChange {
  status: string;
  oldPath: string | null;
  path: string;
}

export type GitRunner = (root: string, args: string[]) => string;

export interface ArchiveIntegrityOptions {
  baseRef?: string;
  git?: GitRunner;
}
~~~

Implementation rules:

- Validate HEAD with rev-parse --verify HEAD.
- Validate baseRef as a commit when supplied.
- Read top-level archives at a ref with ls-tree.
- Compare baseRef to HEAD with diff --name-status --find-renames.
- Compare HEAD to index/working tree with diff --name-status --find-renames HEAD.
- Add untracked files from ls-files --others --exclude-standard.
- Normalize slash direction.
- Reject A/M/D/R/C/?? that touches any archive present at the comparison baseline.
- Permit additions only when the new top-level name matches YYYY-MM-DD-<change> and that directory did not exist at the baseline.
- A rename/copy from outside archive into a new archive is an addition; a rename/copy with an archive oldPath is not.
- Throw one "Existing OpenSpec archive is immutable:" error with all violations.

- [ ] **Step 4: Wire governance and both CLIs**

scripts/openspec-governance.ts parses command plus one optional --archive-base. checkProject accepts an injectable archiveIntegrity function for temporary-project tests; production defaults to checkArchiveIntegrity. Remove readArchiveStatus and findArchiveViolations after replacement tests are green.

bin/workflow.ts forwards archiveBase for check and rejects it for install/index. Help uses the actual package command ai-fullstack-workflow.

- [ ] **Step 5: Verify GREEN and commit**

Add the test to test:compiled. Run:

~~~powershell
npm test
npm run check
~~~

Commit:

~~~powershell
git add lib/archive-integrity.ts tests/archive-integrity.test.ts scripts/openspec-governance.ts tests/governance.test.ts bin/workflow.ts package.json
git commit -m "fix: enforce archive immutability across Git baselines"
~~~

---

### Task 6: Add Safe OpenSpec CLI Validation and a Real Artifact-Graph Fixture

**Files:**
- Create: lib/openspec-cli.ts
- Create: scripts/validate-changes.ts
- Create: tests/openspec-integration.test.ts
- Modify: scripts/validate-schemas.ts
- Modify: tests/validate-schemas.test.ts
- Modify: package.json

**Interfaces:**
- Produces buildInvocation(platform: NodeJS.Platform, args: string[], commandShell?: string): Invocation.
- Produces runOpenSpec(args: string[], options: RunOptions): string | Buffer | null.
- validate-changes exports injectable main(run?, cwd?).

- [ ] **Step 1: Write failing invocation tests**

In tests/validate-schemas.test.ts keep schemas imported from validate-schemas and import buildInvocation from openspec-cli. Assert Windows yields:

~~~ts
{
  command: "C:\\Windows\\System32\\cmd.exe",
  args: [
    "/d",
    "/s",
    "/c",
    "openspec.cmd validate --changes --strict --json --no-interactive"
  ]
}
~~~

Assert Unix yields command "openspec" with unchanged argument array. Assert shell metacharacters and path-like arguments are rejected.

Import validate-changes main and inject a spy. Assert exact arguments:

~~~ts
["--no-color", "validate", "--changes", "--strict", "--json", "--no-interactive"]
~~~

- [ ] **Step 2: Verify RED**

Run npm run build. Expected: TS2307 for openspec-cli and validate-changes.

- [ ] **Step 3: Implement the shared runner**

Create:

~~~ts
import childProcess from "node:child_process";

const SAFE_ARGUMENT = /^(?:[a-z0-9][a-z0-9-]*|--[a-z0-9-]+)$/;

export interface Invocation {
  command: string;
  args: string[];
}

export interface RunOptions {
  cwd: string;
  stdio?: "pipe" | "inherit";
  encoding?: BufferEncoding;
}

export function buildInvocation(
  platform: NodeJS.Platform,
  args: string[],
  commandShell = process.env.ComSpec || "cmd.exe",
): Invocation {
  args.forEach((argument) => {
    if (!SAFE_ARGUMENT.test(argument)) throw new Error("OpenSpec 参数无效：" + argument);
  });
  if (platform === "win32") {
    return {
      command: commandShell,
      args: ["/d", "/s", "/c", "openspec.cmd " + args.join(" ")],
    };
  }
  return { command: "openspec", args };
}

export function runOpenSpec(
  args: string[],
  options: RunOptions,
): string | Buffer | null {
  const invocation = buildInvocation(process.platform, args);
  return childProcess.execFileSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    stdio: options.stdio || "pipe",
    encoding: options.encoding || "utf8",
  });
}
~~~

Validate every argument before constructing the Windows cmd.exe string. Use execFileSync only.

validate-schemas.ts keeps schemas = ["bugfix", "product-change"], invokes schema validate <schema> --json, and exports main plus schemas.

validate-changes.ts:

~~~ts
export function main(
  run = runOpenSpec,
  cwd = path.resolve(__dirname, "..", ".."),
): string | Buffer | null {
  return run(
    ["--no-color", "validate", "--changes", "--strict", "--json", "--no-interactive"],
    { cwd, stdio: "inherit" },
  );
}
~~~

- [ ] **Step 4: Build the real installed fixture**

Create tests/openspec-integration.test.ts. It must:

1. Build/install the workflow into a temporary target.
2. Write openspec/changes/native-fixture/.openspec.yaml with schema product-change, plus br.md and prd.md in that same change directory.
3. Write only proposal.md and parse status --change native-fixture --json by artifact ID.
4. Assert design and specs are ready and tasks is blocked.
5. Write specs only and assert tasks remains blocked.
6. Write design and assert tasks is ready.
7. Write tasks and assert instructions apply --change native-fixture --json reports ready or all_done.
8. Write a valid ADDED Requirement with a WHEN/THEN Scenario and run strict validation successfully.

Call runOpenSpec with cwd set to the temporary target. Do not assert array positions.

- [ ] **Step 5: Verify GREEN and commit**

Add validate:changes:compiled, validate:changes, the real fixture, and updated CLI test to package scripts. Extend verify to run strict validation.

Run:

~~~powershell
npm test
npm run validate:schemas
npm run validate:changes
~~~

Commit:

~~~powershell
git add lib/openspec-cli.ts scripts/validate-schemas.ts scripts/validate-changes.ts tests/validate-schemas.test.ts tests/openspec-integration.test.ts package.json
git commit -m "feat: strictly validate active OpenSpec changes"
~~~

---

### Task 7: Complete Installer, CI, Versioning, and Operational Documentation

**Files:**
- Modify: lib/installer.ts
- Modify: tests/installer.test.ts
- Modify: .github/workflows/validate.yml
- Modify: package.json
- Modify: README.md
- Modify: AGENTS.md
- Modify: docs/FULLSTACK_WORKFLOW.md
- Modify: docs/QUALITY_GATES.md
- Modify: docs/ADOPTION.md
- Modify: docs/OPERATIONS.md
- Modify: examples/sample-project/README.md
- Modify: CHANGELOG.md

**Interfaces:**
- Installer manages all compiled runtime dependencies and both generated outputs.
- CI builds TypeScript before tests and supplies an archive base for every PR/push.
- Package and install manifest version become 2.0.0.

- [ ] **Step 1: Write failing installer/version assertions**

Assert a fresh target contains:

~~~ts
[
  "lib/schema-alignment.js",
  "lib/change-history.js",
  "lib/archive-integrity.js",
  "lib/openspec-cli.js",
  "scripts/openspec-governance.js",
  "scripts/validate-schemas.js",
  "scripts/validate-changes.js",
  "openspec/change-history.json"
].forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(target, relativePath)), relativePath);
});
~~~

Assert target contains no .ts file under lib or scripts, .ai-workflow.json.version is 2.0.0, both generated files are managed, and installed scripts execute under plain Node.js in the fixture.

- [ ] **Step 2: Verify RED**

Run npm test. Expected: installer assertions fail on missing mappings and version 1.0.0.

- [ ] **Step 3: Complete installer mappings and metadata**

Add mappings from every required dist/lib and dist/scripts JavaScript file to the target paths listed in Step 1. Validate all source mappings before conflict preflight writes anything. Preserve config merge-example, idempotence, conflict refusal, and force backup.

Set:

~~~json
{
  "version": "2.0.0",
  "engines": {
    "node": ">=20.19.0"
  }
}
~~~

- [ ] **Step 4: Upgrade CI**

The workflow must:

- checkout with fetch-depth 0;
- use a Node matrix of 20.19.x and 22.x;
- run npm ci;
- install @fission-ai/openspec@1.5.0 globally;
- run npm run build and reject tracked .js source under bin/lib/scripts/tests;
- run npm test, npm run index, generated-file diff, Schema validation, strict change validation, base-aware governance, and git diff --check;
- use pull_request.base.sha for PRs;
- use github.event.before for normal pushes;
- on an all-zero push base, use merge-base with origin/default-branch, then the Git empty-tree SHA 4b825dc642cb6eb9a060e54bf8d69288fbee4904.

Use this source-language guard:

~~~bash
tracked_js="$(git ls-files -- ':(glob)bin/**/*.js' ':(glob)lib/**/*.js' ':(glob)scripts/**/*.js' ':(glob)tests/**/*.js')"
test -z "$tracked_js"
~~~

- [ ] **Step 5: Update all operational documentation**

Document these exact facts:

- prerequisites are Node.js >=20.19.0 and OpenSpec 1.5.0;
- repository contributors run npm ci, npm run build, and npm run verify;
- repository source is TypeScript; dist is generated and untracked;
- installed targets receive JavaScript and need no TypeScript runtime;
- BR/PRD are outer governance; proposal unlocks specs and design in parallel; tasks waits for both;
- FEATURE ready is not delivery-final;
- normal closeout uses openspec archive <change> --yes --json without prior sync;
- after /opsx:sync, archive uses --skip-specs;
- SPEC.md is minimal navigation and change-history.json is detailed machine history;
- CI uses full history, strict changes, generated drift, and archive base;
- existing archives remain untouched and active product changes migrate native headings.

Add a 2.0.0 CHANGELOG entry calling the graph, Node floor, and TypeScript source migration breaking changes.

- [ ] **Step 6: Verify GREEN and commit**

Run:

~~~powershell
npm test
npm run verify
git diff --check
~~~

Commit:

~~~powershell
git add lib/installer.ts tests/installer.test.ts .github/workflows/validate.yml package.json README.md AGENTS.md docs/FULLSTACK_WORKFLOW.md docs/QUALITY_GATES.md docs/ADOPTION.md docs/OPERATIONS.md examples/sample-project/README.md CHANGELOG.md
git commit -m "docs: publish TypeScript OpenSpec workflow 2.0 contract"
~~~

---

### Task 8: Full Verification and Release Baseline

**Files:**
- Modify only if deterministic output changes: SPEC.md, openspec/change-history.json
- Modify only if verification exposes an in-scope defect: the owning Task 1-7 TypeScript file and its focused test

**Interfaces:**
- Consumes every interface and command from Tasks 1-7.
- Produces a clean branch whose source, compiled tests, real OpenSpec fixture, and Git-history checks pass.

- [ ] **Step 1: Rebuild deterministic outputs twice**

Run:

~~~powershell
npm run index
git diff -- SPEC.md openspec/change-history.json
npm run index
git diff -- SPEC.md openspec/change-history.json
~~~

Expected: the second run adds no diff.

- [ ] **Step 2: Run complete verification**

Run:

~~~powershell
npm run verify
git diff --check
~~~

Expected: strict TypeScript build, all compiled tests, both Schemas, active changes, generated-file checks, and archive governance pass.

- [ ] **Step 3: Run P0 regressions directly**

~~~powershell
node dist/tests/archive-integrity.test.js
node dist/tests/openspec-integration.test.js
~~~

Expected: both processes exit 0; the archive fixture internally proves old-history mutation rejection and the OpenSpec fixture proves native readiness.

- [ ] **Step 4: Prove source/runtime language boundaries**

Run:

~~~powershell
git ls-files bin lib scripts tests
git status --short --ignored dist
node dist/tests/typescript-layout.test.js
node dist/tests/installer.test.js
~~~

Expected: tracked executable source uses .ts only; dist is ignored; installed target assertions prove JavaScript-only runtime.

- [ ] **Step 5: Inspect final scope**

Run:

~~~powershell
git status --short
git diff --stat e641693..HEAD
git log -10 --oneline --decorate
~~~

Expected: no temporary files; scope is limited to the approved TypeScript toolchain, native Schema/templates, history/governance modules, tests, generated navigation, installer, CI, version, and documentation.

- [ ] **Step 6: Commit generated outputs only if changed**

~~~powershell
git add SPEC.md openspec/change-history.json
git commit -m "chore: refresh OpenSpec workflow indexes"
~~~

Do not create an empty commit.

## Design Acceptance Mapping

| Design criterion | Planned proof |
|---|---|
| 1. Native graph matches OpenSpec v1.5.0 | Task 2 static guard, Task 6 real fixture, Task 8 direct integration run. |
| 2. Native proposal/design/tasks semantics remain | Task 2 templates and checker. |
| 3. Active delta changes receive strict CI validation | Tasks 6-7 and Task 8 verify. |
| 4. Existing archives are immutable across PR/push histories | Task 5 real Git tests and Task 7 base selection. |
| 5. A wholly new archive directory is allowed | Task 5 pass fixture. |
| 6. SPEC discovers active changes before specs exist | Tasks 3-4 governance test. |
| 7. Machine history records changes, capabilities, operations, Requirements | Task 3 parser/model and Task 4 output. |
| 8. Repeated index/check is byte-deterministic | Task 4 regression and Task 8 double run. |
| 9. Version and archive/sync docs match runtime | Tasks 6-7. |
| 10. Unit, integration, Schema, strict validation, and Git gates pass | Task 8 full verification. |
| 11. Source/tests are TypeScript and targets run compiled JavaScript without TS runtime | Tasks 1, 7, and 8 boundary tests. |

## Plan Self-Review Checklist

- [x] All 11 design acceptance criteria map to a task and verification command.
- [x] Every new production module has a focused RED/GREEN test cycle.
- [x] Type names and function signatures are consistent across producer and consumer tasks.
- [x] Source repository and installed-target command paths are distinct and executable.
- [x] No tracked JavaScript source, archive rewrite, runtime dependency, or unrelated refactor is included.
