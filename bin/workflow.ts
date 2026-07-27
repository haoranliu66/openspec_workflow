#!/usr/bin/env node
import path from "node:path";

import { closeChange } from "../lib/close-workflow";
import { validateCloseChange } from "../lib/closeout-validation";
import { installWorkflow } from "../lib/installer";
import { checkProject, writeIndex } from "../scripts/openspec-governance";

export interface CliOptions {
  command: string | undefined;
  changeId: string | undefined;
  target: string;
  force: boolean;
  skipSpecs: boolean;
}

export interface WorkflowDependencies {
  install: typeof installWorkflow;
  index: typeof writeIndex;
  check: typeof checkProject;
  validateClose: typeof validateCloseChange;
  close: typeof closeChange;
}

const defaultDependencies: WorkflowDependencies = {
  install: installWorkflow,
  index: writeIndex,
  check: checkProject,
  validateClose: validateCloseChange,
  close: closeChange,
};

const CHANGE_ID = /^[a-z0-9][a-z0-9-]*$/;

export function parseArguments(args: string[]): CliOptions {
  const command = args[0];
  const options: CliOptions = {
    command,
    changeId: undefined,
    target: process.cwd(),
    force: false,
    skipSpecs: false,
  };
  const positional: string[] = [];

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--force") {
      if (options.force) throw new Error("--force may be specified only once");
      options.force = true;
    } else if (argument === "--skip-specs") {
      if (options.skipSpecs) throw new Error("--skip-specs may be specified only once");
      options.skipSpecs = true;
    } else if (argument === "--target") {
      index += 1;
      if (index >= args.length || args[index].startsWith("--")) {
        throw new Error("--target 必须提供路径");
      }
      options.target = path.resolve(args[index]);
    } else if (argument.startsWith("--")) {
      throw new Error(`未知参数：${argument}`);
    } else {
      positional.push(argument);
    }
  }

  if (command === "close" || command === "validate:close") {
    if (positional.length !== 1) throw new Error(`${command} requires exactly one change ID`);
    if (!CHANGE_ID.test(positional[0]) || positional[0] === "archive") {
      throw new Error(`${command} requires a valid change ID`);
    }
    options.changeId = positional[0];
  } else if (positional.length > 0) {
    throw new Error(`${command ?? "workflow"} does not accept positional arguments`);
  }
  if (options.skipSpecs && command !== "close") {
    throw new Error("--skip-specs is allowed only with close");
  }
  if (options.force && command !== "install") {
    throw new Error("--force is allowed only with install");
  }
  return options;
}

export function printHelp(): void {
  process.stdout.write([
    "AI 全栈 OpenSpec 工作流",
    "",
    "命令：",
    "  workflow install --target <project> [--force]",
    "  workflow index --target <project>",
    "  workflow check --target <project>",
    "  workflow validate:close <change> --target <project>",
    "  workflow close <change> [--skip-specs] --target <project>",
    "",
  ].join("\n"));
}

export function runWorkflow(
  args: string[],
  dependencies: WorkflowDependencies = defaultDependencies,
): void {
  const options = parseArguments(args);
  const sourceRoot = path.resolve(__dirname, "..", "..");
  if (!options.command || options.command === "help" || options.command === "--help") {
    printHelp();
    return;
  }
  if (options.command === "install") {
    const result = dependencies.install(sourceRoot, options.target, { force: options.force });
    process.stdout.write(`工作流已安装到 ${options.target}\n`);
    process.stdout.write(`已复制：${result.copied.length}；已跳过：${result.skipped.length}；已备份：${result.backedUp.length}\n`);
    return;
  }
  if (options.command === "index") {
    dependencies.index(options.target);
    process.stdout.write(`已更新 ${path.join(options.target, "SPEC.md")}\n`);
    return;
  }
  if (options.command === "check") {
    dependencies.check(options.target);
    process.stdout.write("AI 工作流治理检查通过。\n");
    return;
  }
  if (options.command === "validate:close") {
    const result = dependencies.validateClose(options.target, options.changeId!);
    if (result.diagnostics.length > 0) {
      result.diagnostics.forEach((entry) => {
        process.stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
      });
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Validated closeout for ${result.changeId} (${result.schema}).\n`);
    return;
  }
  if (options.command === "close") {
    const result = dependencies.close(options.target, options.changeId!, { skipSpecs: options.skipSpecs });
    process.stdout.write(`Closed ${result.changeId}.\n`);
    return;
  }
  throw new Error(`未知命令：${options.command}`);
}

function main(): void {
  runWorkflow(process.argv.slice(2));
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
