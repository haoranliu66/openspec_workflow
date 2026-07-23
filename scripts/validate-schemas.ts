import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { OpenSpecRunner, runOpenSpec } from "../lib/openspec-cli";
import { resolveProjectRoot } from "../lib/project-root";
import { checkProductSchemaAlignment } from "../lib/schema-alignment";

interface Invocation {
  command: string;
  args: string[];
}

export const schemas = ["bugfix", "product-change"] as const;

export function validateSchemas(
  root: string,
  run: OpenSpecRunner = runOpenSpec,
): void {
  checkProductSchemaAlignment(
    path.join(root, "openspec", "schemas", "product-change"),
  );

  schemas.forEach((schema) => {
    run(["schema", "validate", schema], {
      cwd: root,
      stdio: "inherit",
    });
  });
}

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

function isProjectRoot(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, "openspec", "schemas"))
    || fs.existsSync(path.join(candidate, ".ai-workflow.json"));
}

export function resolveRepositoryRoot(scriptDirectory: string): string {
  const parent = path.resolve(scriptDirectory, "..");
  if (isProjectRoot(parent)) return parent;

  return path.basename(parent) === "dist" ? path.resolve(parent, "..") : parent;
}

export function main(
  run: OpenSpecRunner = runOpenSpec,
  root = resolveProjectRoot(__dirname),
): void {
  validateSchemas(root, run);
  return;

}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  main();
}
