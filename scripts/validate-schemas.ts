// @ts-nocheck
'use strict';

const childProcess = require('child_process');
const path = require('path');

const schemas = ['bugfix', 'product-change'];

function buildInvocation(platform, schema, commandShell = process.env.ComSpec || 'cmd.exe') {
  if (!/^[a-z0-9-]+$/.test(schema)) {
    throw new Error(`Schema 名称无效：${schema}`);
  }
  if (platform === 'win32') {
    return {
      command: commandShell,
      args: ['/d', '/s', '/c', `openspec.cmd schema validate ${schema}`],
    };
  }
  return {
    command: 'openspec',
    args: ['schema', 'validate', schema],
  };
}

function main() {
  schemas.forEach((schema) => {
    const invocation = buildInvocation(process.platform, schema);
    childProcess.execFileSync(invocation.command, invocation.args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
  });
}

if (require.main === module) {
  main();
}

module.exports = { buildInvocation, schemas };
