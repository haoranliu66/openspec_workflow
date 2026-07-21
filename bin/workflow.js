#!/usr/bin/env node
'use strict';

const path = require('path');

const { installWorkflow } = require('../lib/installer');
const { writeIndex, checkProject } = require('../scripts/openspec-governance');

function parseArguments(args) {
  const options = { command: args[0], target: process.cwd(), force: false };
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--force') {
      options.force = true;
    } else if (argument === '--target') {
      index += 1;
      if (!args[index]) throw new Error('--target 必须提供路径');
      options.target = path.resolve(args[index]);
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
}

function printHelp() {
  process.stdout.write([
    'AI 全栈 OpenSpec 工作流',
    '',
    '命令：',
    '  workflow install --target <project> [--force]',
    '  workflow index --target <project>',
    '  workflow check --target <project>',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceRoot = path.resolve(__dirname, '..');
  if (!options.command || options.command === 'help' || options.command === '--help') {
    printHelp();
    return;
  }
  if (options.command === 'install') {
    const result = installWorkflow(sourceRoot, options.target, { force: options.force });
    process.stdout.write(`工作流已安装到 ${options.target}\n`);
    process.stdout.write(`已复制：${result.copied.length}；已跳过：${result.skipped.length}；已备份：${result.backedUp.length}\n`);
    return;
  }
  if (options.command === 'index') {
    writeIndex(options.target);
    process.stdout.write(`已更新 ${path.join(options.target, 'SPEC.md')}\n`);
    return;
  }
  if (options.command === 'check') {
    checkProject(options.target);
    process.stdout.write('AI 工作流治理检查通过。\n');
    return;
  }
  throw new Error(`未知命令：${options.command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
