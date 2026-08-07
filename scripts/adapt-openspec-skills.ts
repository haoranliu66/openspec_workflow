import fs from "node:fs";
import path from "node:path";

const UPSTREAM_COMMIT = "d57889664cab4f2f061d236ec3ff82a5578701bb";
const CORE_SKILLS = [
  "openspec-apply-change",
  "openspec-explore",
  "openspec-propose",
  "openspec-sync-specs",
  "openspec-update-change",
] as const;

const LOCAL_COMMAND = /\bopenspec (?=(?:archive|config|context|doctor|instructions|list|new|schema|schemas|show|status|store|templates|update|validate|view)\b)/g;
const PROVENANCE = `<!-- Upstream OpenSpec 1.8.0 ${UPSTREAM_COMMIT}; only CLI invocation is adapted to the project-local launcher. -->`;

function adaptNativeSkill(content: string): string {
  const withoutOldProvenance = content.replace(/^<!-- Upstream OpenSpec[^\n]*-->\r?\n/m, "");
  const adapted = withoutOldProvenance
    .replace("allowed-tools: Bash(openspec:*)", "allowed-tools: Bash(node:*)")
    .replace(LOCAL_COMMAND, "node bin/openspec.js ");
  const frontmatterEnd = adapted.indexOf("\n---", 4);
  if (frontmatterEnd === -1) throw new Error("OpenSpec skill 缺少 frontmatter 结束标记。");
  const insertAt = adapted.indexOf("\n", frontmatterEnd + 1) + 1;
  return `${adapted.slice(0, insertAt)}\n${PROVENANCE}\n${adapted.slice(insertAt)}`;
}

function archiveGovernanceSkill(): string {
  return `---
name: openspec-archive-change
description: Finalize one OpenSpec change through this project's close authorization and formal-close governance.
allowed-tools: Bash(node:*)
license: MIT
compatibility: Requires this workflow's bin/openspec.js and bin/workflow.js.
metadata:
  author: ai-fullstack-openspec-workflow
  upstream: OpenSpec 1.8.0 ${UPSTREAM_COMMIT}
---

Finalize exactly one change after implementation verification and team review.

This is the governed replacement for the upstream archive skill. OpenSpec remains
responsible for strict validation, delta application, and the physical archive;
this wrapper adds the independent close-authorization stop and the project's
index/history checks.

## Steps

1. Resolve one explicit active change. If the request is ambiguous, run
   \`node bin/openspec.js list --json\` and ask the user to select one. Always
   announce the selected change.
2. If the current or a prior message has not explicitly authorized closing that
   exact change, show the change ID, delivered and verified scope, Requirement ID
   conclusions, evidence summary, incomplete tasks, limitations, risk decisions,
   and the proposed formal-close action. End the turn and wait for a later
   \`确认关闭 <change>\` or equivalent unambiguous authorization.
3. After exact change-scoped close authorization, run:

   \`node bin/workflow.js close <change> --target .\`

   Do not run the upstream agent-driven sync or move the change directory by
   hand. The command performs strict validation, OpenSpec archive/delta
   application, index/history rebuild, and governance checks.
4. Use \`--skip-specs\` only when the user has identified a recovery case in
   which the same delta was already synced before formal close. Never select it
   merely to bypass a validation or merge failure.
5. Report whether the change was archived. If OpenSpec archive succeeded but a
   later index/check step failed, say that the change is already archived and
   direct the user to repair the cause before running the separate index/check
   commands; do not repeat archive.

## Guardrails

- Implementation authorization is not close authorization.
- Incomplete tasks and verification evidence are reviewed by the team before
  authorization; this skill does not turn them into machine gates.
- Never invoke \`node bin/openspec.js archive\` directly for a normal close.
- Never modify an archived change.
`;
}

export function adaptOpenSpecSkills(root: string): void {
  const skillsRoot = path.join(root, ".agents", "skills");
  CORE_SKILLS.forEach((skill) => {
    const skillFile = path.join(skillsRoot, skill, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      throw new Error(`缺少 OpenSpec 核心 skill：${skillFile}`);
    }
    fs.writeFileSync(skillFile, adaptNativeSkill(fs.readFileSync(skillFile, "utf8")), "utf8");
  });
  const archiveFile = path.join(skillsRoot, "openspec-archive-change", "SKILL.md");
  fs.mkdirSync(path.dirname(archiveFile), { recursive: true });
  fs.writeFileSync(archiveFile, archiveGovernanceSkill(), "utf8");
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  adaptOpenSpecSkills(path.resolve(__dirname, "..", ".."));
}
