import fs from "node:fs";
import path from "node:path";

function isProjectRoot(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, "openspec", "schemas"))
    || fs.existsSync(path.join(candidate, ".ai-workflow.json"));
}

export function resolveProjectRoot(scriptDirectory: string): string {
  const parent = path.resolve(scriptDirectory, "..");
  if (isProjectRoot(parent)) return parent;

  return path.basename(parent) === "dist" ? path.resolve(parent, "..") : parent;
}
