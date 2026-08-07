import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const packageMetadata = JSON.parse(
  fs.readFileSync(path.join(root, "node_modules", "@fission-ai", "openspec", "package.json"), "utf8"),
) as { version: string };
assert.strictEqual(packageMetadata.version, "1.8.0");

const upstreamCommit = "d57889664cab4f2f061d236ec3ff82a5578701bb";
for (const skill of [
  "openspec-apply-change",
  "openspec-explore",
  "openspec-propose",
  "openspec-sync-specs",
  "openspec-update-change",
]) {
  const content = fs.readFileSync(
    path.join(root, ".agents", "skills", skill, "SKILL.md"),
    "utf8",
  );
  assert.match(content, new RegExp(`Upstream OpenSpec 1\\.8\\.0 ${upstreamCommit}`));
  assert.match(content, /node bin\/openspec\.js/);
  assert.doesNotMatch(
    content,
    /\bopenspec (?=(?:archive|context|instructions|list|new|schema|schemas|status|store|validate)\b)/,
  );
  const restoredUpstream = content
    .replace(/\r?\n<!-- Upstream OpenSpec[^\n]*-->\r?\n/m, "")
    .replace(/^  generatedBy: "1\.8\.0"\r?\n/m, "")
    .replace("allowed-tools: Bash(node:*)", "allowed-tools: Bash(openspec:*)")
    .replace(/node bin\/openspec\.js /g, "openspec ");
  const upstreamSkill = fs.readFileSync(
    path.join(root, "vendor", "openspec", "skills", skill, "SKILL.md"),
    "utf8",
  );
  assert.strictEqual(restoredUpstream, upstreamSkill, `${skill} drifted from pinned upstream`);
}

const archiveSkill = fs.readFileSync(
  path.join(root, ".agents", "skills", "openspec-archive-change", "SKILL.md"),
  "utf8",
);
assert.match(archiveSkill, /governed replacement for the upstream archive skill/);
assert.match(archiveSkill, /node bin\/workflow\.js close <change> --target \./);
assert.match(archiveSkill, /Never invoke `node bin\/openspec\.js archive` directly/);

function copyDirectory(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-core-paths-"));
try {
  fs.mkdirSync(path.join(temporary, "openspec", "schemas"), { recursive: true });
  copyDirectory(
    path.join(root, "openspec", "schemas", "product-change"),
    path.join(temporary, "openspec", "schemas", "product-change"),
  );
  fs.writeFileSync(path.join(temporary, "openspec", "config.yaml"), "schema: product-change\n", "utf8");

  const cli = path.join(root, "dist", "bin", "openspec.js");
  const run = (args: string[]): string => childProcess.execFileSync(
    process.execPath,
    [cli, ...args],
    { cwd: temporary, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  run(["new", "change", "system-core-path", "--schema", "spec-driven"]);
  const systemStatus = JSON.parse(run([
    "status", "--change", "system-core-path", "--json",
  ])) as { schemaName: string; artifacts: Array<{ id: string }> };
  assert.strictEqual(systemStatus.schemaName, "spec-driven");
  assert.deepStrictEqual(systemStatus.artifacts.map(({ id }) => id), [
    "proposal", "specs", "design", "tasks",
  ]);
  const systemProposal = JSON.parse(run([
    "instructions", "proposal", "--change", "system-core-path", "--json",
  ])) as { artifactId: string };
  assert.strictEqual(systemProposal.artifactId, "proposal");

  run(["new", "change", "product-core-path", "--schema", "product-change"]);
  const productStatus = JSON.parse(run([
    "status", "--change", "product-core-path", "--json",
  ])) as { schemaName: string; artifacts: Array<{ id: string }> };
  assert.strictEqual(productStatus.schemaName, "product-change");
  assert.deepStrictEqual(productStatus.artifacts.map(({ id }) => id), [
    "br", "prd", "proposal", "specs", "design", "tasks",
  ]);
  const productProposal = JSON.parse(run([
    "instructions", "proposal", "--change", "product-core-path", "--json",
  ])) as { artifactId: string };
  assert.strictEqual(productProposal.artifactId, "proposal");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

process.stdout.write("PASS fixed OpenSpec core skills and both governed schemas use the native artifact engine.\n");
