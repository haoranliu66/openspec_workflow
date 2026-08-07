#!/usr/bin/env node
import childProcess from "node:child_process";

import { resolveBundledOpenSpecCli } from "../lib/openspec-cli";

function main(): void {
  const cli = resolveBundledOpenSpecCli();
  if (cli === undefined) {
    throw new Error(
      "未找到本工作流固定的 OpenSpec 运行时。请重新执行 npm ci、npm run build 和 workflow install。",
    );
  }

  const result = childProcess.spawnSync(
    process.execPath,
    [cli, ...process.argv.slice(2)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.signal !== null) {
    throw new Error(`OpenSpec 进程被信号 ${result.signal} 终止。`);
  }
  process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
