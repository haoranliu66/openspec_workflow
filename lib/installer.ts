// @ts-nocheck
'use strict';

const fs = require('fs');
const path = require('path');

const { renderIndex } = require('../scripts/openspec-governance');

const REQUIRED_FILES = [
  'dist/scripts/openspec-governance.js',
  'docs/FULLSTACK_WORKFLOW.md',
  'docs/QUALITY_GATES.md',
];

const REQUIRED_DIRECTORIES = [
  'openspec/schemas/bugfix',
  'openspec/schemas/product-change',
  'docs/requirements/_templates',
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function readFile(filePath) {
  return fs.readFileSync(filePath);
}

function sameContent(filePath, content) {
  return fs.existsSync(filePath) && Buffer.compare(readFile(filePath), content) === 0;
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    });
}

function buildOperations(sourceRoot, targetRoot) {
  const relativeFiles = [...REQUIRED_FILES];
  REQUIRED_DIRECTORIES.forEach((relativeDirectory) => {
    listFiles(path.join(sourceRoot, relativeDirectory)).forEach((sourcePath) => {
      relativeFiles.push(toPosix(path.relative(sourceRoot, sourcePath)));
    });
  });

  const configSource = path.join(sourceRoot, 'openspec', 'config.yaml');
  const configTarget = path.join(targetRoot, 'openspec', 'config.yaml');
  const configRelative = fs.existsSync(configTarget)
    ? 'openspec/ai-workflow.config.example.yaml'
    : 'openspec/config.yaml';
  relativeFiles.push(configRelative);

  const operations = relativeFiles.map((relativePath) => {
    const sourceRelative = relativePath === 'openspec/ai-workflow.config.example.yaml'
      ? 'openspec/config.yaml'
      : relativePath;
    const targetRelative = relativePath === 'dist/scripts/openspec-governance.js'
      ? 'scripts/openspec-governance.js'
      : relativePath;
    const sourcePath = path.join(sourceRoot, sourceRelative);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`工作流源文件缺失：${sourceRelative}`);
    }
    return {
      relativePath: targetRelative,
      content: readFile(sourcePath),
    };
  });

  operations.push(
    { relativePath: 'openspec/specs/.gitkeep', content: Buffer.from('') },
    { relativePath: 'openspec/changes/archive/.gitkeep', content: Buffer.from('') },
  );

  return operations.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));
}

function backupFile(targetRoot, relativePath, backupRoot) {
  const sourcePath = path.join(targetRoot, relativePath);
  const backupPath = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(sourcePath, backupPath);
  return toPosix(path.relative(targetRoot, backupPath));
}

function installWorkflow(sourceRoot, targetRoot, options = {}) {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  if (!fs.existsSync(source)) throw new Error(`源仓库不存在：${source}`);
  fs.mkdirSync(target, { recursive: true });

  const operations = buildOperations(source, target);
  const conflicts = operations
    .filter((operation) => {
      const targetPath = path.join(target, operation.relativePath);
      return fs.existsSync(targetPath) && !sameContent(targetPath, operation.content);
    })
    .map((operation) => operation.relativePath);

  const existingSpec = path.join(target, 'SPEC.md');
  if (fs.existsSync(existingSpec)) {
    const specContent = fs.readFileSync(existingSpec, 'utf8');
    if (!specContent.includes('# AI 全栈规格索引')) {
      conflicts.push('SPEC.md');
    }
  }

  if (conflicts.length > 0 && !options.force) {
    throw new Error(`发现冲突的工作流文件，本次未修改任何文件：\n${conflicts.join('\n')}`);
  }

  const result = {
    copied: [],
    skipped: [],
    conflicts: [],
    backedUp: [],
  };
  const backupStamp = options.backupStamp || new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(target, '.ai-workflow-backup', backupStamp);

  if (options.force) {
    conflicts.forEach((relativePath) => {
      result.backedUp.push(backupFile(target, relativePath, backupRoot));
    });
  }

  operations.forEach((operation) => {
    const targetPath = path.join(target, operation.relativePath);
    if (sameContent(targetPath, operation.content)) {
      result.skipped.push(operation.relativePath);
      return;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, operation.content);
    result.copied.push(operation.relativePath);
  });

  const specContent = Buffer.from(renderIndex(target), 'utf8');
  if (sameContent(existingSpec, specContent)) {
    result.skipped.push('SPEC.md');
  } else {
    fs.writeFileSync(existingSpec, specContent);
    result.copied.push('SPEC.md');
  }

  const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version;
  const manifestPath = path.join(target, '.ai-workflow.json');
  const manifest = `${JSON.stringify({
    version,
    managedFiles: operations.map((operation) => operation.relativePath).concat('SPEC.md').sort(),
  }, null, 2)}\n`;
  if (sameContent(manifestPath, Buffer.from(manifest))) {
    result.skipped.push('.ai-workflow.json');
  } else {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    result.copied.push('.ai-workflow.json');
  }

  return result;
}

module.exports = {
  buildOperations,
  installWorkflow,
};
