import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..", "..");
const sourceRoots = ["bin", "lib", "scripts", "tests"];

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const trackedLanguageRoots = sourceRoots.flatMap((name) => walk(path.join(repositoryRoot, name)));
const javascriptSources = trackedLanguageRoots
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.relative(repositoryRoot, file).replaceAll("\\", "/"))
  .sort();

assert.deepStrictEqual(javascriptSources, []);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
) as { bin: Record<string, string> };
assert.strictEqual(packageJson.bin["ai-fullstack-workflow"], "dist/bin/workflow.js");

[
  "dist/bin/workflow.js",
  "dist/lib/installer.js",
  "dist/lib/openspec-cli.js",
  "dist/lib/project-root.js",
  "dist/scripts/openspec-governance.js",
  "dist/scripts/validate-changes.js",
  "dist/scripts/validate-schemas.js"
].forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(repositoryRoot, relativePath)), relativePath);
});

process.stdout.write("PASS TypeScript is the only maintained executable source language.\n");
