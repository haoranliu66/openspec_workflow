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
const normalizedTracked = tracked.map((relativePath) => relativePath.replace(/\/$/, ""));

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
  ".gitmodules",
  "vendor/openspec",
  ".agents/skills/openspec-apply-change/SKILL.md",
  ".agents/skills/openspec-archive-change/SKILL.md",
  ".agents/skills/openspec-explore/SKILL.md",
  ".agents/skills/openspec-propose/SKILL.md",
  ".agents/skills/openspec-sync-specs/SKILL.md",
  ".agents/skills/openspec-update-change/SKILL.md",
  "CHANGELOG.md",
  "docs/AGENTS.root.example.md",
  "docs/AI_WORKFLOW_AGENTS.md",
  "docs/requirements/_templates/README.md",
  "examples/core-workflow/README.md",
  "openspec/change-history.json",
  "openspec/changes/archive/.gitkeep",
]) {
  assert.ok(normalizedTracked.includes(required), `Expected public distribution file is not tracked: ${required}`);
}

process.stdout.write("PASS repository distribution excludes upstream process records and retains public history surfaces.\n");
