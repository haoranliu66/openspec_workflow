// @ts-nocheck
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectCapabilities,
  renderIndex,
  findArchiveViolations,
  checkIndex,
  checkProject,
} = require('../scripts/openspec-governance');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function write(root, relativePath, content = '') {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-workflow-governance-'));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('collects current, first/latest archived, and active capability references', () => {
  withProject((root) => {
    write(root, 'openspec/specs/admin-panel/spec.md');
    write(root, 'openspec/changes/archive/2026-01-01-create/specs/admin-panel/spec.md');
    write(root, 'openspec/changes/archive/2026-02-01-refresh/specs/admin-panel/spec.md');
    write(root, 'openspec/changes/add-filter/specs/admin-panel/spec.md');

    const capabilities = collectCapabilities(root);

    assert.strictEqual(capabilities.length, 1);
    assert.strictEqual(capabilities[0].canonical, 'openspec/specs/admin-panel/spec.md');
    assert.deepStrictEqual(capabilities[0].archived.map((item) => item.change), [
      '2026-01-01-create',
      '2026-02-01-refresh',
    ]);
    assert.deepStrictEqual(capabilities[0].active.map((item) => item.change), ['add-filter']);
  });
});

test('renders a deterministic navigation-only index', () => {
  withProject((root) => {
    write(root, 'openspec/specs/auth/spec.md', '### Requirement: AUTH-01\nsecret body');
    const first = renderIndex(root);
    const second = renderIndex(root);

    assert.strictEqual(first, second);
    assert.match(first, /AI 全栈规格索引/);
    assert.match(first, /\[auth\]\(openspec\/specs\/auth\/spec\.md\)/);
    assert.doesNotMatch(first, /secret body|### Requirement:/);
  });
});

test('allows new archive additions but rejects committed history edits', () => {
  const status = [
    'A\topenspec/changes/archive/2026-03-01-new/proposal.md',
    'M\topenspec/changes/archive/2026-01-01-old/specs/a/spec.md',
    'D\topenspec/changes/archive/2026-01-01-old/tasks.md',
    'R100\topenspec/changes/archive/old/proposal.md\topenspec/changes/archive/new/proposal.md',
  ].join('\n');

  const violations = findArchiveViolations(status);

  assert.strictEqual(violations.length, 3);
});

test('detects missing structure and stale index', () => {
  withProject((root) => {
    assert.throws(() => checkProject(root, { archiveStatus: '' }), /缺少必要目录/);

    write(root, 'openspec/specs/.gitkeep');
    write(root, 'openspec/changes/archive/.gitkeep');
    write(root, 'SPEC.md', '# stale\n');
    assert.throws(() => checkIndex(root), /SPEC\.md 已过期/);
  });
});

test('passes project check with current index and unchanged archive', () => {
  withProject((root) => {
    write(root, 'openspec/specs/.gitkeep');
    write(root, 'openspec/changes/archive/.gitkeep');
    write(root, 'SPEC.md', renderIndex(root));

    assert.doesNotThrow(() => checkProject(root, { archiveStatus: '' }));
  });
});

let failures = 0;
tests.forEach(({ name, fn }) => {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
  }
});

if (failures > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(`All ${tests.length} governance tests passed.\n`);
}
