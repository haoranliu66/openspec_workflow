---
name: openspec-archive-change
description: Finalize one OpenSpec change through this project's close authorization and formal-close governance.
allowed-tools: Bash(node:*)
license: MIT
compatibility: Requires this workflow's bin/openspec.js and bin/workflow.js.
metadata:
  author: ai-fullstack-openspec-workflow
  upstream: OpenSpec 1.8.0 d57889664cab4f2f061d236ec3ff82a5578701bb
---

Finalize exactly one change after implementation verification and team review.

This is the governed replacement for the upstream archive skill. OpenSpec remains
responsible for strict validation, delta application, and the physical archive;
this wrapper adds the independent close-authorization stop and the project's
index/history checks.

## Steps

1. Resolve one explicit active change. If the request is ambiguous, run
   `node bin/openspec.js list --json` and ask the user to select one. Always
   announce the selected change.
2. If the current or a prior message has not explicitly authorized closing that
   exact change, show the change ID, delivered and verified scope, Requirement ID
   conclusions, evidence summary, incomplete tasks, limitations, risk decisions,
   and the proposed formal-close action. End the turn and wait for a later
   `确认关闭 <change>` or equivalent unambiguous authorization.
3. After exact change-scoped close authorization, run:

   `node bin/workflow.js close <change> --target .`

   Do not run the upstream agent-driven sync or move the change directory by
   hand. The command performs strict validation, OpenSpec archive/delta
   application, index/history rebuild, and governance checks.
4. Use `--skip-specs` only when the user has identified a recovery case in
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
- Never invoke `node bin/openspec.js archive` directly for a normal close.
- Never modify an archived change.
