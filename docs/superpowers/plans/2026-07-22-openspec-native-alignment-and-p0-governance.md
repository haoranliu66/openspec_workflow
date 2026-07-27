# OpenSpec Native Alignment and P0 Governance Implementation Plan

> [!WARNING]
> Both 2026-07-22 plans (JavaScript/CommonJS and TypeScript) are superseded by [the 2026-07-27 final governance-boundary design](../specs/2026-07-27-governance-boundary-language-design.md). Do not execute this file.

**Historical goal (cancelled):** This plan recorded a JavaScript-era proposal to restore the OpenSpec v1.5.0 native planning core, generate deterministic machine-readable change history, and add active-change validation. Its proposed program enforcement of archive immutability is cancelled and must not be implemented; the final boundary is defined by the 2026-07-27 design above.

**Historical architecture (not to implement):** The remaining body records the original CommonJS approach: BR/PRD/FEATURE as outer product artifacts, the native `proposal -> (specs, design) -> tasks -> apply` subgraph, and focused modules for history, alignment, archive integrity, and OpenSpec invocation. The archive-integrity and CI-enforcement portions are cancelled; archived changes are protected by team process, not by a base-ref, full-history, hash, script, or CI proof.

**Tech Stack:** Node.js `>=20.19.0`, CommonJS, OpenSpec CLI `1.5.0`, Git, Markdown, YAML, GitHub Actions, built-in `assert` test runner.

## Global Constraints

- OpenSpec compatibility is fixed to `@fission-ai/openspec@1.5.0`.
- Node.js runtime floor is `>=20.19.0`; CI covers `20.19.x` and `22.x`.
- Runtime code adds no npm dependencies.
- `proposal`, `specs`, `design`, `tasks`, and `apply` preserve the v1.5.0 native dependency graph.
- Existing committed archives are never rewritten.
- Generated `SPEC.md` and `openspec/change-history.json` contain no timestamps and must be byte-deterministic.
- Production code is written only after its focused test has failed for the expected reason.
- Each task commits only its listed files; do not combine unrelated cleanup.

## File and Responsibility Map

| File | Responsibility |
|---|---|
| `lib/schema-alignment.js` | Validate the project-local product schema against the OpenSpec v1.5.0 native core contract. |
| `lib/change-history.js` | Discover active/archive changes and parse delta operations into a deterministic model. |
| `lib/archive-integrity.js` | Compare archive paths against Git baselines and reject mutations of existing archive roots. |
| `lib/openspec-cli.js` | Build safe cross-platform OpenSpec invocations and execute fixed commands. |
| `scripts/openspec-governance.js` | Render/check/write generated navigation and orchestrate governance checks. |
| `scripts/validate-schemas.js` | Validate both custom Schema definitions through the shared OpenSpec runner. |
| `scripts/validate-changes.js` | Strictly validate every active change through OpenSpec CLI. |
| `bin/workflow.js` | Expose `install`, `index`, and `check --archive-base`. |
| `lib/installer.js` | Install all newly managed scripts and generated files safely. |
| `tests/schema-alignment.test.js` | Native core graph/template drift tests. |
| `tests/change-history.test.js` | Delta parsing, active discovery, history JSON, and deterministic ordering tests. |
| `tests/archive-integrity.test.js` | Existing/new archive mutation rules and real Git baseline tests. |
| `tests/openspec-integration.test.js` | Real OpenSpec v1.5.0 readiness and strict-validation fixture. |

---

### Task 1: Restore the OpenSpec v1.5.0 Native Planning Core

**Files:**
- Create: `lib/schema-alignment.js`
- Create: `tests/schema-alignment.test.js`
- Modify: `openspec/schemas/product-change/schema.yaml`
- Modify: `openspec/schemas/product-change/templates/proposal.md`
- Modify: `openspec/schemas/product-change/templates/design.md`
- Modify: `openspec/schemas/product-change/templates/tasks.md`
- Modify: `openspec/schemas/product-change/templates/spec.md`
- Modify: `openspec/config.yaml`
- Modify: `package.json`

**Interfaces:**
- Produces: `checkProductSchemaAlignment(root: string): { warnings: string[] }`; throws with all contract violations joined by newlines.
- Produces: project Schema version `2` with native dependencies `proposal=[]`, `specs=[proposal]`, `design=[proposal]`, `tasks=[specs,design]`, `apply=[tasks]`.
- Consumes: filesystem only; no YAML dependency.

- [ ] **Step 1: Write the failing native-alignment test**

Create `tests/schema-alignment.test.js` with a small local test harness and these assertions:

```js
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkProductSchemaAlignment } = require('../lib/schema-alignment');

function copyFile(root, relativePath, sourceRoot) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, relativePath), target);
}

const sourceRoot = path.resolve(__dirname, '..');
const required = [
  'openspec/schemas/product-change/schema.yaml',
  'openspec/schemas/product-change/templates/proposal.md',
  'openspec/schemas/product-change/templates/design.md',
  'openspec/schemas/product-change/templates/tasks.md',
];

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-alignment-'));
try {
  required.forEach((file) => copyFile(root, file, sourceRoot));
  assert.doesNotThrow(() => checkProductSchemaAlignment(root));

  const schemaPath = path.join(root, 'openspec/schemas/product-change/schema.yaml');
  const broken = fs.readFileSync(schemaPath, 'utf8')
    .replace('    requires:\n      - proposal\n\n  - id: tasks', '    requires:\n      - proposal\n      - specs\n\n  - id: tasks');
  fs.writeFileSync(schemaPath, broken, 'utf8');
  assert.throws(() => checkProductSchemaAlignment(root), /design must require only proposal/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write('PASS product-change preserves the OpenSpec v1.5.0 native core.\n');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node tests/schema-alignment.test.js
```

Expected: FAIL with `Cannot find module '../lib/schema-alignment'`.

- [ ] **Step 3: Implement the native-core contract checker**

Create `lib/schema-alignment.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

function artifactBlock(schema, id) {
  const marker = `  - id: ${id}`;
  const start = schema.indexOf(marker);
  if (start < 0) return null;
  const nextArtifact = schema.indexOf('\n  - id: ', start + marker.length);
  const apply = schema.indexOf('\napply:', start + marker.length);
  const candidates = [nextArtifact, apply].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : schema.length;
  return schema.slice(start, end);
}

function requiresFromBlock(block) {
  if (!block) return null;
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => /^    requires:/.test(line));
  if (start < 0) return [];
  const inline = lines[start].match(/^    requires:\s*\[([^\]]*)\]\s*$/);
  if (inline) return inline[1].split(',').map((value) => value.trim()).filter(Boolean);
  const dependencies = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const dependency = lines[index].match(/^      -\s+([a-z0-9-]+)\s*$/);
    if (dependency) {
      dependencies.push(dependency[1]);
    } else if (/^    \S/.test(lines[index])) {
      break;
    }
  }
  return dependencies;
}

function assertHeadings(content, headings, label, errors) {
  headings.forEach((heading) => {
    if (!content.includes(`## ${heading}`)) errors.push(`${label} missing native heading: ${heading}`);
  });
}

function checkProductSchemaAlignment(root) {
  const schemaRoot = path.join(root, 'openspec', 'schemas', 'product-change');
  const schema = fs.readFileSync(path.join(schemaRoot, 'schema.yaml'), 'utf8');
  const errors = [];
  const expected = {
    proposal: [],
    specs: ['proposal'],
    design: ['proposal'],
    tasks: ['specs', 'design'],
  };

  Object.entries(expected).forEach(([id, dependencies]) => {
    const actual = requiresFromBlock(artifactBlock(schema, id));
    if (actual === null) {
      errors.push(`missing native artifact: ${id}`);
    } else if (JSON.stringify(actual) !== JSON.stringify(dependencies)) {
      errors.push(`${id} must require only ${dependencies.length ? dependencies.join(', ') : 'nothing'}`);
    }
  });

  const apply = schema.match(/^apply:\s*$([\s\S]*)/m)?.[1] || '';
  if (!/requires:\s*\[tasks\]/.test(apply)) errors.push('apply must require tasks');
  if (!/tracks:\s*tasks\.md/.test(apply)) errors.push('apply must track tasks.md');

  const proposal = fs.readFileSync(path.join(schemaRoot, 'templates', 'proposal.md'), 'utf8');
  const design = fs.readFileSync(path.join(schemaRoot, 'templates', 'design.md'), 'utf8');
  const tasks = fs.readFileSync(path.join(schemaRoot, 'templates', 'tasks.md'), 'utf8');
  assertHeadings(proposal, ['Why', 'What Changes', 'Capabilities', 'Impact'], 'proposal.md', errors);
  assertHeadings(design, ['Context', 'Goals / Non-Goals', 'Decisions', 'Risks / Trade-offs'], 'design.md', errors);
  if (!/- \[ \] 1\.1/.test(tasks)) errors.push('tasks.md missing trackable checkbox format');

  if (errors.length > 0) throw new Error(`product-change native alignment failed:\n${errors.join('\n')}`);
  return { warnings: [] };
}

module.exports = { artifactBlock, requiresFromBlock, checkProductSchemaAlignment };
```

- [ ] **Step 4: Align Schema and templates to the upstream contract**

In `schema.yaml`, keep `br`, `prd`, and `feature`, set `version: 2`, and make the native blocks use these dependencies exactly:

```yaml
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
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.
    Pause if you hit blockers or need clarification.
```

Replace the three core templates with the v1.5.0 headings while keeping Chinese comments:

```markdown
<!-- proposal.md -->
## Why

<!-- 用 1-2 句话说明问题或机会，以及为什么现在处理。产品来源链接写在这里。 -->

## What Changes

<!-- 列出具体变化；破坏性变化使用 **BREAKING** 标记。 -->

## Capabilities

### New Capabilities
- `capability-name`: 能力边界说明

### Modified Capabilities
- `existing-capability`: 发生变化的 Requirement

## Impact

<!-- 受影响代码、API、依赖、系统、角色及 BR/PRD 切片。 -->
```

```markdown
<!-- design.md -->
## Context

## Goals / Non-Goals

**Goals:**

**Non-Goals:**

## Decisions

## Risks / Trade-offs

## Migration Plan

## Open Questions
```

```markdown
<!-- tasks.md -->
## 1. Setup

- [ ] 1.1 Confirm approved scope, affected capabilities, and dependencies.
- [ ] 1.2 Establish reproducible baseline or failing evidence.

## 2. Implementation

- [ ] 2.1 Implement the approved change in dependency order.
- [ ] 2.2 Add automated tests traceable to changed Requirements.

## 3. Verification and Delivery

- [ ] 3.1 Run applicable quality gates and record commands and results.
- [ ] 3.2 Record release, rollback, monitoring, and known-limit evidence.
```

Keep the upstream delta headers in `spec.md`; put project traceability before `## ADDED Requirements` without renaming any delta section. Move product-specific generation guidance into `openspec/config.yaml` rules instead of changing native headings.

- [ ] **Step 5: Run focused and Schema tests and verify GREEN**

Run:

```powershell
node tests/schema-alignment.test.js
npm run validate:schemas
```

Expected: alignment test PASS; both custom Schemas valid under OpenSpec 1.5.0.

- [ ] **Step 6: Register the test and commit**

Add `node tests/schema-alignment.test.js` to the `test` script before installer tests, then run `npm test`.

Commit:

```powershell
git add lib/schema-alignment.js tests/schema-alignment.test.js openspec/schemas/product-change openspec/config.yaml package.json
git commit -m "feat: align product workflow with native OpenSpec core"
```

---

### Task 2: Build Deterministic Change-History Collection

**Files:**
- Create: `lib/change-history.js`
- Create: `tests/change-history.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseDeltaSpec(content: string, sourcePath: string): RequirementChange[]`.
- Produces: `collectChangeHistory(root: string): { version: 1, changes: ChangeRecord[], diagnostics: Diagnostic[] }`.
- Produces: `renderChangeHistory(model: ReturnType<typeof collectChangeHistory>): string` with two-space JSON and one LF.
- `ChangeRecord.paths` values are repository-relative POSIX paths or `null`.

- [ ] **Step 1: Write failing delta and discovery tests**

Create `tests/change-history.test.js` that writes a temporary project containing:

```markdown
## ADDED Requirements

### Requirement: AUTH-001 Password login
The system SHALL authenticate a valid account.

#### Scenario: Valid password
- **WHEN** valid credentials are submitted
- **THEN** the user is authenticated

## RENAMED Requirements

- FROM: `Legacy login`
- TO: `Password login`
```

Assert:

```js
const parsed = parseDeltaSpec(delta, 'specs/auth/spec.md');
assert.deepStrictEqual(parsed, [
  { operation: 'ADDED', id: 'AUTH-001', name: 'Password login' },
  { operation: 'RENAMED', id: null, name: 'Legacy login -> Password login', from: 'Legacy login', to: 'Password login' },
]);
```

Also create one active change without a `specs/` directory and one dated archive with a delta, then assert both appear, the active schema comes from `.openspec.yaml`, and missing artifact paths are `null`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node tests/change-history.test.js
```

Expected: FAIL with `Cannot find module '../lib/change-history'`.

- [ ] **Step 3: Implement the parser and collector**

Create `lib/change-history.js` with these public functions and exact parsing rules:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const OPERATIONS = new Set(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']);
const ID_PATTERN = /^([A-Z][A-Z0-9]*-\d+)\s+(.+)$/;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listDirectories(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function cleanRenameValue(value) {
  return value.trim().replace(/^`|`$/g, '');
}

function requirementIdentity(title) {
  const match = title.trim().match(ID_PATTERN);
  return match
    ? { id: match[1], name: match[2].trim() }
    : { id: null, name: title.trim() };
}

function parseDeltaSpec(content, sourcePath) {
  const results = [];
  let operation = null;
  let renameFrom = null;
  content.split(/\r?\n/).forEach((line) => {
    const section = line.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/);
    if (section) {
      operation = section[1];
      renameFrom = null;
      return;
    }
    if (/^##\s+/.test(line)) {
      operation = null;
      renameFrom = null;
      return;
    }
    if (!operation || !OPERATIONS.has(operation)) return;
    const requirement = line.match(/^###\s+Requirement:\s*(.+?)\s*$/);
    if (requirement) {
      results.push({ operation, ...requirementIdentity(requirement[1]) });
      return;
    }
    if (operation !== 'RENAMED') return;
    const from = line.match(/^(?:-\s*)?(?:\*\*)?FROM(?:\*\*)?:\s*(.+?)\s*$/i);
    if (from) {
      renameFrom = cleanRenameValue(from[1]);
      return;
    }
    const to = line.match(/^(?:-\s*)?(?:\*\*)?TO(?:\*\*)?:\s*(.+?)\s*$/i);
    if (to && renameFrom) {
      const renameTo = cleanRenameValue(to[1]);
      results.push({
        operation: 'RENAMED',
        id: null,
        name: `${renameFrom} -> ${renameTo}`,
        from: renameFrom,
        to: renameTo,
      });
      renameFrom = null;
    }
  });
  if (operation === 'RENAMED' && renameFrom) {
    throw new Error(`Incomplete RENAMED Requirement in ${sourcePath}`);
  }
  return results;
}

function schemaName(changeRoot) {
  const metadata = path.join(changeRoot, '.openspec.yaml');
  if (!fs.existsSync(metadata)) return 'unknown';
  return fs.readFileSync(metadata, 'utf8').match(/^schema:\s*([a-z0-9-]+)\s*$/m)?.[1] || 'unknown';
}

function artifactPath(root, changeRoot, name) {
  const target = path.join(changeRoot, `${name}.md`);
  return fs.existsSync(target) ? toPosix(path.relative(root, target)) : null;
}

function collectOneChange(root, changeRoot, state, directoryName) {
  const dated = state === 'archived' && /^\d{4}-\d{2}-\d{2}-/.test(directoryName);
  const changeId = dated ? directoryName.slice(11) : directoryName;
  const archiveDate = dated ? directoryName.slice(0, 10) : null;
  const specsRoot = path.join(changeRoot, 'specs');
  const capabilities = listDirectories(specsRoot).flatMap((name) => {
    const delta = path.join(specsRoot, name, 'spec.md');
    if (!fs.existsSync(delta)) return [];
    return [{
      name,
      canonicalSpec: `openspec/specs/${name}/spec.md`,
      deltaSpec: toPosix(path.relative(root, delta)),
      requirements: parseDeltaSpec(
        fs.readFileSync(delta, 'utf8'),
        toPosix(path.relative(root, delta)),
      ).sort((left, right) => (
        left.name.localeCompare(right.name, 'en')
        || left.operation.localeCompare(right.operation, 'en')
        || (left.id || '').localeCompare(right.id || '', 'en')
      )),
    }];
  });
  return {
    changeId,
    directoryName,
    state,
    archiveDate,
    schema: schemaName(changeRoot),
    paths: {
      br: artifactPath(root, changeRoot, 'br'),
      prd: artifactPath(root, changeRoot, 'prd'),
      proposal: artifactPath(root, changeRoot, 'proposal'),
      design: artifactPath(root, changeRoot, 'design'),
      tasks: artifactPath(root, changeRoot, 'tasks'),
      feature: artifactPath(root, changeRoot, 'feature'),
    },
    capabilities,
  };
}

function collectChangeHistory(root) {
  const changesRoot = path.join(root, 'openspec', 'changes');
  const active = listDirectories(changesRoot)
    .filter((name) => name !== 'archive')
    .map((name) => collectOneChange(root, path.join(changesRoot, name), 'active', name));
  const archiveRoot = path.join(changesRoot, 'archive');
  const archived = listDirectories(archiveRoot)
    .map((name) => collectOneChange(root, path.join(archiveRoot, name), 'archived', name));
  const diagnostics = [];
  active.forEach((change) => {
    if (change.schema === 'unknown') diagnostics.push({ severity: 'error', message: `Active change ${change.changeId} has unknown schema` });
  });
  archived.forEach((change) => {
    if (change.schema === 'unknown') diagnostics.push({ severity: 'warning', message: `Archived change ${change.directoryName} has unknown schema` });
  });
  return { version: 1, changes: active.concat(archived), diagnostics };
}

function renderChangeHistory(model) {
  return `${JSON.stringify({ version: model.version, changes: model.changes }, null, 2)}\n`;
}

module.exports = { parseDeltaSpec, collectChangeHistory, renderChangeHistory };
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node tests/change-history.test.js
```

Expected: all delta parsing, early active change, archived change, null-path, and deterministic JSON assertions pass.

- [ ] **Step 5: Register the test and commit**

Add `node tests/change-history.test.js` to `npm test`, run `npm test`, then commit:

```powershell
git add lib/change-history.js tests/change-history.test.js package.json
git commit -m "feat: generate deterministic OpenSpec change history"
```

---

### Task 3: Integrate History into SPEC, Index, Check, and Installer

**Files:**
- Modify: `scripts/openspec-governance.js`
- Modify: `tests/governance.test.js`
- Modify: `lib/installer.js`
- Modify: `tests/installer.test.js`
- Create: `openspec/change-history.json`
- Modify: `SPEC.md`

**Interfaces:**
- Produces: `writeGeneratedFiles(root: string): void` atomically writes both generated files.
- Produces: `checkGeneratedFiles(root: string): void` rejects missing/stale SPEC or history JSON.
- `renderIndex(root, historyModel?)` consumes the Task 2 model and includes active changes without delta specs.

- [ ] **Step 1: Extend governance tests first**

Add failing tests to `tests/governance.test.js`:

```js
test('indexes an active change before delta specs exist', () => {
  withProject((root) => {
    write(root, 'openspec/specs/.gitkeep');
    write(root, 'openspec/changes/archive/.gitkeep');
    write(root, 'openspec/changes/early-change/.openspec.yaml', 'schema: product-change\n');
    write(root, 'openspec/changes/early-change/proposal.md', '## Why\n');
    const rendered = renderIndex(root);
    assert.match(rendered, /early-change/);
    assert.match(rendered, /product-change/);
    assert.match(rendered, /proposal\.md/);
  });
});

test('rejects stale change-history.json', () => {
  withProject((root) => {
    write(root, 'openspec/specs/.gitkeep');
    write(root, 'openspec/changes/archive/.gitkeep');
    write(root, 'SPEC.md', renderIndex(root));
    write(root, 'openspec/change-history.json', '{"version":0}\n');
    assert.throws(() => checkGeneratedFiles(root), /change-history\.json 已过期/);
  });
});
```

Add a failing installer assertion that a fresh install contains `openspec/change-history.json` and the Task 1-2 runtime modules.

- [ ] **Step 2: Run governance and installer tests and verify RED**

Run:

```powershell
node tests/governance.test.js
node tests/installer.test.js
```

Expected: governance fails because `checkGeneratedFiles` is missing and the active change table is absent; installer fails on the new managed-file expectation.

- [ ] **Step 3: Refactor governance orchestration**

In `scripts/openspec-governance.js`:

```js
const { collectChangeHistory, renderChangeHistory } = require('../lib/change-history');
const { checkProductSchemaAlignment } = require('../lib/schema-alignment');

const HISTORY_FILE = 'openspec/change-history.json';

function renderArtifactLinks(change) {
  const links = Object.entries(change.paths)
    .filter(([, target]) => target)
    .map(([name, target]) => markdownLink(name, target));
  return links.length > 0 ? links.join('<br>') : '-';
}

function renderActiveRows(model) {
  const active = model.changes.filter((change) => change.state === 'active');
  if (active.length === 0) return ['| _暂无活动 change_ | - | - | - |'];
  return active.map((change) => {
    const capabilities = change.capabilities.length > 0
      ? change.capabilities.map((item) => item.name).join('<br>')
      : '_pending specs_';
    return `| ${change.changeId} | ${change.schema} | ${capabilities} | ${renderArtifactLinks(change)} |`;
  });
}
```

Insert before Capability navigation:

```markdown
## 活动 Change

| Change | Schema | Capabilities | Existing artifacts |
|---|---|---|---|
```

Add a line directing history lookups to `openspec/change-history.json`.

Replace `checkIndex` with `checkGeneratedFiles`, comparing normalized LF content for both files. Collect the history model once per command and pass that same model to both `renderIndex` and `renderChangeHistory`, so a single check/write cannot observe two filesystem snapshots. Call `checkProductSchemaAlignment(root)` and fail on any Task 2 diagnostic with `severity: 'error'`; print or return archive metadata warnings without failing.

Use this atomic writer:

```js
function writeFileAtomic(filePath, content) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function writeGeneratedFiles(root) {
  const model = collectChangeHistory(root);
  writeFileAtomic(path.join(root, INDEX_FILE), renderIndex(root, model));
  writeFileAtomic(path.join(root, HISTORY_FILE), renderChangeHistory(model));
}
```

Keep `writeIndex` as a compatibility alias that calls `writeGeneratedFiles`.

- [ ] **Step 4: Update installer ownership**

Add these files to `REQUIRED_FILES` in `lib/installer.js`:

```js
'lib/schema-alignment.js',
'lib/change-history.js',
```

Do not copy the source repository's generated JSON. After file operations, render the target's empty/current history and write it alongside the target `SPEC.md`. Include both in `.ai-workflow.json.managedFiles`.

- [ ] **Step 5: Generate repository outputs and verify GREEN**

Run:

```powershell
node scripts/openspec-governance.js index
node tests/governance.test.js
node tests/installer.test.js
node scripts/openspec-governance.js check
```

Expected: active-change test passes, stale history is rejected, fresh install contains both generated files, and repository governance passes.

- [ ] **Step 6: Commit**

```powershell
git add lib/installer.js scripts/openspec-governance.js tests/governance.test.js tests/installer.test.js SPEC.md openspec/change-history.json
git commit -m "feat: integrate change history into workflow governance"
```

---

### Task 4: Enforce Archive Immutability Across Commits and Working State

**Files:**
- Create: `lib/archive-integrity.js`
- Create: `tests/archive-integrity.test.js`
- Modify: `scripts/openspec-governance.js`
- Modify: `bin/workflow.js`
- Modify: `tests/governance.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `checkArchiveIntegrity(root: string, options?: { baseRef?: string, git?: Function }): { checkedBase: string | null }`.
- Produces: `parseNameStatus(output: string): FileChange[]`.
- CLI accepts `--archive-base <git-ref>` only for `check`.

- [ ] **Step 1: Write archive-integrity tests first**

Create `tests/archive-integrity.test.js` with a temporary Git repository. Configure a local test identity, commit `openspec/changes/archive/2026-01-01-old/proposal.md`, capture the base SHA, then exercise these cases:

```js
assert.throws(
  () => checkArchiveIntegrity(root, { baseRef }),
  /existing archive.*2026-01-01-old/i,
);
```

Cases that must fail:

- committed modification in the old archive after `baseRef`;
- new untracked file inside the old archive;
- deletion or rename inside the old archive;
- added file inside the old archive.

Case that must pass:

- a new `openspec/changes/archive/2026-02-01-new/` containing only added files.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node tests/archive-integrity.test.js
```

Expected: FAIL with `Cannot find module '../lib/archive-integrity'`.

- [ ] **Step 3: Implement Git archive classification**

Create `lib/archive-integrity.js`:

```js
'use strict';

const childProcess = require('child_process');
const path = require('path');

const ARCHIVE_PATH = 'openspec/changes/archive';
const ARCHIVE_NAME = /^\d{4}-\d{2}-\d{2}-.+/;

function runGit(root, args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function parseNameStatus(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const fields = line.split('\t');
    const status = fields[0];
    return status.startsWith('R') || status.startsWith('C')
      ? { status, oldPath: fields[1].replace(/\\/g, '/'), path: fields[2].replace(/\\/g, '/') }
      : { status, oldPath: null, path: fields[1].replace(/\\/g, '/') };
  });
}

function archiveName(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const prefix = `${ARCHIVE_PATH}/`;
  if (!normalized.startsWith(prefix)) return null;
  return normalized.slice(prefix.length).split('/')[0] || null;
}

function archivesAtRef(root, ref, git) {
  git(root, ['rev-parse', '--verify', `${ref}^{commit}`]);
  try {
    return new Set(git(root, ['ls-tree', '-d', '--name-only', `${ref}:${ARCHIVE_PATH}`])
      .split(/\r?\n/).filter(Boolean));
  } catch (error) {
    if (error.status === 128) return new Set();
    throw error;
  }
}

function violationsFor(changes, existingArchives, label) {
  const violations = [];
  changes.forEach((change) => {
    const targets = [change.oldPath, change.path].filter(Boolean);
    const names = targets.map(archiveName).filter(Boolean);
    const touchesExisting = names.some((name) => existingArchives.has(name));
    const oldName = change.oldPath ? archiveName(change.oldPath) : null;
    const newName = archiveName(change.path);
    const isAddition = ['A', '??'].includes(change.status)
      || ((change.status.startsWith('R') || change.status.startsWith('C')) && !oldName);
    const addsOnlyToNew = !touchesExisting
      && isAddition
      && newName !== null
      && ARCHIVE_NAME.test(newName);
    if (!addsOnlyToNew) violations.push(`${label}: ${change.status}\t${targets.join('\t')}`);
  });
  return violations;
}

function checkArchiveIntegrity(root, options = {}) {
  const git = options.git || runGit;
  git(root, ['rev-parse', '--verify', 'HEAD']);
  const violations = [];

  if (options.baseRef) {
    const baseline = archivesAtRef(root, options.baseRef, git);
    const committed = parseNameStatus(git(root, [
      'diff', '--name-status', '--find-renames', options.baseRef, 'HEAD', '--', ARCHIVE_PATH,
    ]));
    violations.push(...violationsFor(committed, baseline, `committed since ${options.baseRef}`));
  }

  const headArchives = archivesAtRef(root, 'HEAD', git);
  const working = parseNameStatus(git(root, [
    'diff', '--name-status', '--find-renames', 'HEAD', '--', ARCHIVE_PATH,
  ]));
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '--', ARCHIVE_PATH])
    .split(/\r?\n/).filter(Boolean).map((file) => ({ status: '??', oldPath: null, path: file }));
  violations.push(...violationsFor(working.concat(untracked), headArchives, 'working tree'));

  if (violations.length > 0) {
    throw new Error(`Existing OpenSpec archive is immutable:\n${violations.join('\n')}`);
  }
  return { checkedBase: options.baseRef || null };
}

module.exports = { parseNameStatus, checkArchiveIntegrity };
```

- [ ] **Step 4: Wire governance and CLI arguments**

In `scripts/openspec-governance.js`, parse only:

```js
function parseCommandArguments(args) {
  const result = { command: args[0], archiveBase: null };
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] !== '--archive-base' || !args[index + 1]) {
      throw new Error(`未知参数：${args[index]}`);
    }
    result.archiveBase = args[index + 1];
    index += 1;
  }
  return result;
}
```

Call `checkArchiveIntegrity(root, { baseRef: options.archiveBase })` from `checkProject`. Allow tests to inject `options.archiveIntegrity`; production defaults to `checkArchiveIntegrity`. Update existing temporary-project governance tests to pass a no-op injected function instead of depending on a real Git repository. Remove the old `readArchiveStatus` mechanism after the new tests are green.

In `bin/workflow.js`, add `archiveBase` to parsed options, document `workflow check --target <project> [--archive-base <git-ref>]`, and reject `--archive-base` for install/index.

- [ ] **Step 5: Run focused and full tests and verify GREEN**

Run:

```powershell
node tests/archive-integrity.test.js
node tests/governance.test.js
npm test
```

Expected: all existing/new archive rules pass; the previous working-tree-only tests are replaced rather than duplicated.

- [ ] **Step 6: Commit**

```powershell
git add lib/archive-integrity.js tests/archive-integrity.test.js scripts/openspec-governance.js tests/governance.test.js bin/workflow.js package.json
git commit -m "fix: enforce archive immutability across Git baselines"
```

---

### Task 5: Add Safe OpenSpec CLI Validation and a Real Artifact-Graph Fixture

**Files:**
- Create: `lib/openspec-cli.js`
- Create: `scripts/validate-changes.js`
- Create: `tests/openspec-integration.test.js`
- Modify: `scripts/validate-schemas.js`
- Modify: `tests/validate-schemas.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildInvocation(platform: string, args: string[], commandShell?: string): { command: string, args: string[] }`.
- Produces: `runOpenSpec(args: string[], options: { cwd: string, stdio?: string }): Buffer|string|null`.
- `scripts/validate-changes.js` exposes an injectable `main(run?, cwd?)` and runs `validate --changes --strict --json --no-interactive`.

- [ ] **Step 1: Write failing invocation and integration tests**

Keep `schemas` imported from `scripts/validate-schemas.js`, import `buildInvocation` from `../lib/openspec-cli`, preserve the existing schema-list assertion, and then assert:

```js
const windows = buildInvocation('win32', [
  'validate', '--changes', '--strict', '--json', '--no-interactive',
], 'C:\\Windows\\System32\\cmd.exe');
assert.deepStrictEqual(windows.args, [
  '/d', '/s', '/c',
  'openspec.cmd validate --changes --strict --json --no-interactive',
]);

const unix = buildInvocation('linux', ['schema', 'validate', 'product-change', '--json']);
assert.strictEqual(unix.command, 'openspec');
assert.deepStrictEqual(unix.args, ['schema', 'validate', 'product-change', '--json']);
```

Also require the validation entry point and assert its exact fixed command before implementing it:

```js
const { main: validateChanges } = require('../scripts/validate-changes');
let captured;
validateChanges((args, options) => {
  captured = { args, options };
}, 'C:\\repo');
assert.deepStrictEqual(captured, {
  args: ['--no-color', 'validate', '--changes', '--strict', '--json', '--no-interactive'],
  options: { cwd: 'C:\\repo', stdio: 'inherit' },
});
```

Create `tests/openspec-integration.test.js` that installs the source workflow into a temporary project, writes `.openspec.yaml`, BR/PRD, and then checks JSON state after each artifact. Use `childProcess.execFileSync` through `runOpenSpec`; assert proposal completion makes both `design` and `specs` ready, and a valid delta passes strict validation.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node tests/validate-schemas.test.js
node tests/openspec-integration.test.js
```

Expected: FAIL because `lib/openspec-cli.js` and `scripts/validate-changes.js` do not exist.

- [ ] **Step 3: Implement the shared CLI runner**

Create `lib/openspec-cli.js`:

```js
'use strict';

const childProcess = require('child_process');

const SAFE_ARGUMENT = /^(?:[a-z0-9][a-z0-9-]*|--[a-z0-9-]+)$/;

function buildInvocation(platform, args, commandShell = process.env.ComSpec || 'cmd.exe') {
  args.forEach((argument) => {
    if (!SAFE_ARGUMENT.test(argument)) throw new Error(`OpenSpec 参数无效：${argument}`);
  });
  if (platform === 'win32') {
    return {
      command: commandShell,
      args: ['/d', '/s', '/c', `openspec.cmd ${args.join(' ')}`],
    };
  }
  return { command: 'openspec', args };
}

function runOpenSpec(args, options) {
  const invocation = buildInvocation(process.platform, args);
  return childProcess.execFileSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    stdio: options.stdio || 'pipe',
    encoding: options.encoding || 'utf8',
  });
}

module.exports = { buildInvocation, runOpenSpec };
```

Refactor `scripts/validate-schemas.js` to call the shared runner while retaining `const schemas = ['bugfix', 'product-change']` and exporting `{ main, schemas }`:

```js
runOpenSpec(['schema', 'validate', schema, '--json'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});
```

Create `scripts/validate-changes.js`:

```js
'use strict';

const path = require('path');
const { runOpenSpec } = require('../lib/openspec-cli');

function main(run = runOpenSpec, cwd = path.resolve(__dirname, '..')) {
  return run(['--no-color', 'validate', '--changes', '--strict', '--json', '--no-interactive'], {
    cwd,
    stdio: 'inherit',
  });
}

if (require.main === module) main();

module.exports = { main };
```

Extend `SAFE_ARGUMENT` to accept `--no-color` as already covered; do not permit filesystem paths or shell metacharacters.

- [ ] **Step 4: Finish the real fixture assertions**

Use a concrete change ID `native-fixture` and valid files. Parse `openspec status --change native-fixture --json`; check artifact statuses by ID rather than array position because v1.5.0 topological ordering places `design` before `specs` alphabetically.

After writing proposal only:

```js
assert.strictEqual(byId.design.status, 'ready');
assert.strictEqual(byId.specs.status, 'ready');
assert.strictEqual(byId.tasks.status, 'blocked');
```

After specs and design:

```js
assert.strictEqual(byId.tasks.status, 'ready');
```

After tasks, parse `instructions apply --change native-fixture --json` and assert `state === 'ready'` or `state === 'all_done'`.

- [ ] **Step 5: Register commands and verify GREEN**

Add scripts:

```json
"validate:changes": "node scripts/validate-changes.js",
"verify": "npm test && npm run index && npm run check && npm run validate:schemas && npm run validate:changes"
```

Keep the updated CLI unit test in its existing `npm test` slot and add `tests/openspec-integration.test.js`. Run:

```powershell
node tests/validate-schemas.test.js
node tests/openspec-integration.test.js
npm run validate:schemas
npm run validate:changes
npm test
```

Expected: both Schemas validate, the repository with no active changes reports no validation failures, and the real fixture passes all readiness assertions.

- [ ] **Step 6: Commit**

```powershell
git add lib/openspec-cli.js scripts/validate-schemas.js scripts/validate-changes.js tests/validate-schemas.test.js tests/openspec-integration.test.js package.json
git commit -m "feat: strictly validate active OpenSpec changes"
```

---

### Task 6: Upgrade Installer, CI, Versioning, and Operational Documentation

**Files:**
- Modify: `lib/installer.js`
- Modify: `tests/installer.test.js`
- Modify: `.github/workflows/validate.yml`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/FULLSTACK_WORKFLOW.md`
- Modify: `docs/QUALITY_GATES.md`
- Modify: `docs/ADOPTION.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `examples/sample-project/README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Installer manages all four runtime modules and both generated outputs.
- CI supplies an archive base for every PR/push and runs Schema, strict change, governance, format, and full test checks.
- Package version becomes `2.0.0`; engine becomes `>=20.19.0`.

- [ ] **Step 1: Write installer/version assertions before changing production files**

Extend `tests/installer.test.js` so a source fixture includes the new modules and a fresh target must contain:

```js
[
  'lib/schema-alignment.js',
  'lib/change-history.js',
  'lib/archive-integrity.js',
  'lib/openspec-cli.js',
  'scripts/validate-changes.js',
  'openspec/change-history.json',
].forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(target, relativePath)), relativePath);
});
```

Assert `.ai-workflow.json.version === '2.0.0'` and both generated outputs are in `managedFiles`.

- [ ] **Step 2: Run installer tests and verify RED**

Run:

```powershell
node tests/installer.test.js
```

Expected: FAIL because the new runtime modules/history output are not all installed and the version is still 1.0.0.

- [ ] **Step 3: Update installer and package metadata**

Set in `package.json`:

```json
"version": "2.0.0",
"engines": {
  "node": ">=20.19.0"
}
```

Add Task 2, 4, and 5 runtime files to `REQUIRED_FILES`. Continue generating target history from one `collectChangeHistory(target)` model through `renderChangeHistory(model)` rather than copying the source JSON. Keep conflict preflight before any managed-file write and include the history file in force-mode backup behavior.

- [ ] **Step 4: Replace CI with the supported matrix and base-aware checks**

Use this structure in `.github/workflows/validate.yml`:

```yaml
jobs:
  validate:
    strategy:
      matrix:
        node: [20.19.x, 22.x]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm install --global @fission-ai/openspec@1.5.0
      - run: npm test
      - run: npm run index
      - run: git diff --exit-code -- SPEC.md openspec/change-history.json
      - run: npm run validate:schemas
      - run: npm run validate:changes
      - name: Resolve archive base
        id: archive-base
        shell: bash
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            base="${{ github.event.pull_request.base.sha }}"
          elif [ "${{ github.event.before }}" != "0000000000000000000000000000000000000000" ]; then
            base="${{ github.event.before }}"
          else
            git fetch origin "${{ github.event.repository.default_branch }}"
            base="$(git merge-base HEAD "origin/${{ github.event.repository.default_branch }}" || true)"
            if [ -z "$base" ]; then base="4b825dc642cb6eb9a060e54bf8d69288fbee4904"; fi
          fi
          echo "sha=$base" >> "$GITHUB_OUTPUT"
      - run: node scripts/openspec-governance.js check --archive-base "${{ steps.archive-base.outputs.sha }}"
      - run: git diff --check
```

- [ ] **Step 5: Update documentation with exact operational semantics**

Make these explicit edits:

- all prerequisites say Node.js `>=20.19.0` and OpenSpec `1.5.0`;
- product flow shows BR/PRD as outer governance and native proposal/specs/design/tasks as an iterative subgraph;
- design and specs are parallel after proposal;
- FEATURE ready is not delivery-final;
- normal closeout uses `openspec archive change-id --yes --json` without a prior sync;
- if `/opsx:sync` was already used, archive uses `--skip-specs`;
- `SPEC.md` is minimal navigation and `openspec/change-history.json` is detailed machine history;
- CI setup includes full-history checkout, archive base, strict changes, and generated-history drift;
- migration notes say existing archives remain untouched and active product changes must migrate native headings.

Add a `2.0.0` CHANGELOG entry that labels the product Schema graph and Node floor as breaking changes.

- [ ] **Step 6: Verify installer, CI YAML shape, and docs references**

Run:

```powershell
node tests/installer.test.js
rg -n "Node.js 18|Node 18" README.md docs AGENTS.md
rg -n "20.19|change-history.json|validate:changes|archive-base" README.md docs AGENTS.md .github/workflows/validate.yml
npm test
```

Expected: installer tests pass; the first search returns no obsolete runtime/lifecycle claim; the second search finds the new contract in all relevant guides.

- [ ] **Step 7: Commit**

```powershell
git add lib/installer.js tests/installer.test.js .github/workflows/validate.yml package.json README.md AGENTS.md docs/FULLSTACK_WORKFLOW.md docs/QUALITY_GATES.md docs/ADOPTION.md docs/OPERATIONS.md examples/sample-project/README.md CHANGELOG.md
git commit -m "docs: publish OpenSpec workflow 2.0 operating contract"
```

---

### Task 7: Full Verification and Release Baseline

**Files:**
- Modify only if generated output changes: `SPEC.md`, `openspec/change-history.json`
- Modify only if verification exposes an in-scope defect: the owning Task 1-6 file and its focused test

**Interfaces:**
- Consumes every interface and command from Tasks 1-6.
- Produces a clean Git worktree with all acceptance commands passing.

- [ ] **Step 1: Rebuild deterministic outputs twice**

Run:

```powershell
npm run index
git diff -- SPEC.md openspec/change-history.json
npm run index
git diff -- SPEC.md openspec/change-history.json
```

Expected: the second run introduces no additional diff. Review the first diff and commit generated files only if they changed because of the new format.

- [ ] **Step 2: Run the complete repository verification**

Run:

```powershell
npm run verify
git diff --check
```

Expected: all unit/integration tests pass; both Schemas are valid; active changes strict validation passes; generated-file and archive governance pass; no whitespace errors.

- [ ] **Step 3: Exercise the P0 regression against a real temporary Git history**

Run the focused integration test directly:

```powershell
node tests/archive-integrity.test.js
```

Expected: its committed old-archive mutation case fails inside the fixture as asserted, while its new archive case passes; the test process exits 0.

- [ ] **Step 4: Verify the real OpenSpec graph fixture**

Run:

```powershell
node tests/openspec-integration.test.js
```

Expected: proposal unlocks design and specs, tasks waits for both, apply becomes ready after tasks, and strict delta validation succeeds.

- [ ] **Step 5: Inspect final scope**

Run:

```powershell
git status --short
git diff --stat 935ac16..HEAD
git log -7 --oneline --decorate
```

Expected: no temporary files; changes are limited to the approved design/plan, workflow Schema/templates, focused runtime modules/tests, generated navigation, installer, CI, version, and documentation.

- [ ] **Step 6: Commit generated release outputs if needed**

If Step 1 produced tracked generated-file changes, commit only those files:

```powershell
git add SPEC.md openspec/change-history.json
git commit -m "chore: refresh OpenSpec workflow indexes"
```

If Step 1 produced no tracked changes, do not create an empty commit.

## Design Acceptance Mapping

| Design criterion | Planned proof |
|---|---|
| 1. Native product-change graph matches OpenSpec v1.5.0 | Task 1 static alignment test, Task 5 real CLI fixture, Task 7 Step 4. |
| 2. Proposal/design/tasks retain native sections and tracking semantics | Task 1 template tests and Schema update. |
| 3. Every active delta change receives strict validation in CI | Task 5 validation wrapper, Task 6 CI wiring, Task 7 `npm run verify`. |
| 4. Any mutation of an existing archive fails for PR and push histories | Task 4 committed-range and working-tree tests, Task 6 event-aware base selection. |
| 5. A wholly new top-level archive directory remains allowed | Task 4 new-directory and rename/copy coverage. |
| 6. SPEC discovers active changes before delta specs exist | Task 2 active discovery and Task 3 governance regression test. |
| 7. Machine history records changes, capabilities, operations, and requirements | Task 2 parser/model tests and Task 3 generated-file integration. |
| 8. Repeated index/check output is byte-deterministic | Tasks 2-3 ordering/atomic-render tests and Task 7 Step 1. |
| 9. Node/OpenSpec versions and archive/sync guidance match runtime behavior | Task 5 pinned CLI behavior and Task 6 CI/version/documentation upgrade. |
| 10. Unit, integration, Schema, strict validation, and Git-diff gates all pass | Focused RED/GREEN steps in Tasks 1-6 and the complete Task 7 verification. |

## Plan Self-Review Checklist

- [x] Every design acceptance criterion maps to at least one Task 1-7 step.
- [x] Every production module has a focused failing test before implementation.
- [x] Function names and signatures are consistent across producer and consumer tasks.
- [x] Product Schema, history, archive integrity, strict validation, installer, CI, migration, and full verification are all covered.
- [x] No archive rewrite, third-party runtime dependency, or unrelated refactor is included.
