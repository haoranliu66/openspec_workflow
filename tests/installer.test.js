'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installWorkflow } = require('../lib/installer');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function write(root, relativePath, content = '') {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function makeSource(root) {
  write(root, 'package.json', '{"version":"1.0.0"}\n');
  write(root, 'scripts/openspec-governance.js', 'module.exports = {};\n');
  write(root, 'openspec/config.yaml', 'schema: product-change\n');
  write(root, 'openspec/schemas/bugfix/schema.yaml', 'name: bugfix\n');
  write(root, 'openspec/schemas/product-change/schema.yaml', 'name: product-change\n');
  write(root, 'docs/requirements/_templates/BR.md', '# BR\n');
  write(root, 'docs/requirements/_templates/PRD.md', '# PRD\n');
  write(root, 'docs/requirements/_templates/README.md', '# REQ\n');
  write(root, 'docs/requirements/_templates/FEATURE.md', '# FEATURE\n');
  write(root, 'docs/FULLSTACK_WORKFLOW.md', '# Workflow\n');
  write(root, 'docs/QUALITY_GATES.md', '# Gates\n');
}

function withRoots(fn) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-workflow-installer-'));
  const source = path.join(base, 'source');
  const target = path.join(base, 'target');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(target, { recursive: true });
  makeSource(source);
  try {
    fn({ source, target });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

test('installs versioned assets and required OpenSpec structure', () => {
  withRoots(({ source, target }) => {
    const result = installWorkflow(source, target);

    assert.ok(result.copied.length > 0);
    assert.strictEqual(read(target, 'openspec/config.yaml'), 'schema: product-change\n');
    assert.ok(fs.existsSync(path.join(target, 'openspec/schemas/bugfix/schema.yaml')));
    assert.ok(fs.existsSync(path.join(target, 'openspec/schemas/product-change/schema.yaml')));
    assert.ok(fs.existsSync(path.join(target, 'openspec/specs/.gitkeep')));
    assert.ok(fs.existsSync(path.join(target, 'openspec/changes/archive/.gitkeep')));
    assert.ok(fs.existsSync(path.join(target, '.ai-workflow.json')));
  });
});

test('reinstall is idempotent when managed files are unchanged', () => {
  withRoots(({ source, target }) => {
    installWorkflow(source, target);
    const result = installWorkflow(source, target);

    assert.strictEqual(result.conflicts.length, 0);
    assert.ok(result.skipped.length > 0);
  });
});

test('refuses conflicts before overwriting target content', () => {
  withRoots(({ source, target }) => {
    write(target, 'docs/QUALITY_GATES.md', '# local customization\n');

    assert.throws(() => installWorkflow(source, target), /冲突的工作流文件/);
    assert.strictEqual(read(target, 'docs/QUALITY_GATES.md'), '# local customization\n');
    assert.ok(!fs.existsSync(path.join(target, 'scripts/openspec-governance.js')));
  });
});

test('force mode backs up conflicts before overwrite', () => {
  withRoots(({ source, target }) => {
    write(target, 'docs/QUALITY_GATES.md', '# local customization\n');
    const result = installWorkflow(source, target, { force: true, backupStamp: 'test-backup' });

    assert.strictEqual(read(target, 'docs/QUALITY_GATES.md'), '# Gates\n');
    assert.strictEqual(
      read(target, '.ai-workflow-backup/test-backup/docs/QUALITY_GATES.md'),
      '# local customization\n',
    );
    assert.strictEqual(result.backedUp.length, 1);
  });
});

test('preserves existing OpenSpec config and writes merge example', () => {
  withRoots(({ source, target }) => {
    write(target, 'openspec/config.yaml', 'schema: team-custom\n');
    installWorkflow(source, target);

    assert.strictEqual(read(target, 'openspec/config.yaml'), 'schema: team-custom\n');
    assert.strictEqual(
      read(target, 'openspec/ai-workflow.config.example.yaml'),
      'schema: product-change\n',
    );
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
  process.stdout.write(`All ${tests.length} installer tests passed.\n`);
}
