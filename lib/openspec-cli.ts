import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

const OPENSPEC_ENTRY = path.join(
  "node_modules",
  "@fission-ai",
  "openspec",
  "bin",
  "openspec.js",
);

/**
 * Resolve the OpenSpec runtime shipped with this workflow before consulting PATH.
 *
 * Source builds keep the dependency at <repo>/node_modules. Installed targets
 * receive the exact same production dependency closure under the managed
 * .ai-workflow runtime directory.
 */
export function resolveBundledOpenSpecCli(): string | undefined {
  if (process.env.AI_WORKFLOW_OPENSPEC_FORCE_PATH === "1") return undefined;
  const candidates = [
    path.resolve(__dirname, "..", ".ai-workflow", "openspec-runtime", OPENSPEC_ENTRY),
    path.resolve(__dirname, "..", "..", "node_modules", "@fission-ai", "openspec", "bin", "openspec.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

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
  assertSafeArguments(args);
  const bundledCli = resolveBundledOpenSpecCli();
  const invocation = bundledCli === undefined
    ? buildInvocation(process.platform, args)
    : { command: process.execPath, args: [bundledCli, ...args] };
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
