import childProcess from "node:child_process";
import path from "node:path";

interface Invocation {
  command: string;
  args: string[];
}

export const schemas = ["bugfix", "product-change"];

export function buildInvocation(
  platform: NodeJS.Platform,
  schema: string,
  commandShell = process.env.ComSpec || "cmd.exe",
): Invocation {
  if (!/^[a-z0-9-]+$/.test(schema)) {
    throw new Error(`Schema 名称无效：${schema}`);
  }
  if (platform === "win32") {
    return {
      command: commandShell,
      args: ["/d", "/s", "/c", `openspec.cmd schema validate ${schema}`],
    };
  }
  return {
    command: "openspec",
    args: ["schema", "validate", schema],
  };
}

export function resolveRepositoryRoot(scriptDirectory: string): string {
  const parent = path.resolve(scriptDirectory, "..");
  return path.basename(parent) === "dist" ? path.resolve(parent, "..") : parent;
}

function main(): void {
  const repositoryRoot = resolveRepositoryRoot(__dirname);
  schemas.forEach((schema) => {
    const invocation = buildInvocation(process.platform, schema);
    childProcess.execFileSync(invocation.command, invocation.args, {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
  });
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  main();
}
