import childProcess from "node:child_process";

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
  const invocation = buildInvocation(process.platform, args);
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
