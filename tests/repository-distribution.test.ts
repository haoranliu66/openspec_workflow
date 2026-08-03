import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const tracked = childProcess.execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
  cwd: root,
  encoding: "utf8",
  },
).split("\0").filter(Boolean);

const prohibited = tracked.filter((relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) return false;
  if (relativePath === "openspec/changes/archive/.gitkeep") return false;
  return relativePath.startsWith("openspec/changes/")
    || /^docs\/requirements\/REQ-\d/.test(relativePath)
    || relativePath.startsWith("artifacts/");
});

assert.deepStrictEqual(
  prohibited,
  [],
  `Latest checkout contains tracked upstream development records:\n${prohibited.join("\n")}`,
);

for (const required of [
  "CHANGELOG.md",
  "docs/requirements/_templates/README.md",
  "examples/core-workflow/README.md",
  "openspec/change-history.json",
  "openspec/changes/archive/.gitkeep",
  "openspec/specs/change-lifecycle-governance/spec.md",
]) {
  assert.ok(tracked.includes(required), `Expected public distribution file is not tracked: ${required}`);
}

process.stdout.write("PASS repository distribution excludes upstream process records and retains public history surfaces.\n");
