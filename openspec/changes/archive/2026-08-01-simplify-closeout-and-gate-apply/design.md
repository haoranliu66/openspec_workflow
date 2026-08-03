## Context

OpenSpec 1.5.0 exposes artifact states and `apply.requires`, but does not model semantic user approval. Its core propose/ff paths stop after planning, while apply proceeds when invoked and required artifacts exist. The current project adds change-local BR/PRD/FEATURE around the native graph and implements a closeout validator that compares local FEATURE results, closeout feature results, and a shared FEATURE ledger.

The accepted direction retains local BR/PRD, removes only local FEATURE, introduces a strict conversational authorization boundary, and reduces closeout duplication without weakening evidence or gate checks.

## Goals / Non-Goals

**Goals:**

- Preserve the native OpenSpec proposal/specs/design/tasks dependency subgraph and task tracking.
- Require a separate, change-scoped user authorization after planning completion.
- Define material versus non-material planning edits so authorization does not loop on routine task progress.
- Make shared FEATURE the only source of delivered conclusions and their evidence references.
- Reduce product closeout JSON to Requirement mappings, evidence, and gates.
- Keep formal close atomic through the existing close workflow.

**Non-Goals:**

- Prove user authorization with Schema, CI, hashes, approval files, or an external service.
- Fork or patch the installed OpenSpec package in `node_modules`.
- Remove change-local BR/PRD or make shared BR/PRD completion a program gate.
- Rewrite archived changes or delete historical local FEATURE records.
- Weaken tasks input validation, Requirement/PRD mapping, evidence existence, or gate applicability checks.

## Decisions

### 1. Treat authorization as an AI governance stop, not a new artifact state

Project governance will define a mandatory turn boundary. The AI will obtain Schema status, confirm the dependency closure and product-only BR/PRD extension, summarize the plan, and stop. A later `/opsx:apply <change>` or contextual explicit confirmation is the authorization. No `approval.md` will be introduced because file existence cannot prove user intent.

The rule will be reflected in root guidance, OpenSpec configuration, both Schema apply instructions, user documentation, and installed workflow guidance. Core OpenSpec skills remain conceptually aligned: propose/ff/continue stop after planning, apply is the authorized implementation action, and onboard must observe the same stop.

### 2. Keep BR/PRD as the product extension branch

The product graph remains two branches: `br -> prd` and the native `proposal -> {specs, design} -> tasks`. `apply.requires` remains `[tasks]` and tracks `tasks.md`; the additional requirement that product BR/PRD exist before asking for authorization is an AI governance rule rather than a program gate.

### 3. Remove local FEATURE and strengthen the shared FEATURE row

The product Schema and template set will no longer contain a `feature` artifact. Shared FEATURE will use one row per result:

`Change | 结果 ID | 已交付结论 | Evidence IDs | 版本 / 日期 | 状态`

The shared row becomes the human-readable delivery claim and the machine-parsed result/evidence binding. Planned rows may exist without evidence but cannot pass closeout or claim `ready`.

### 4. Replace the existing closeout contract in place

The project will keep one contract named `closeout` and directly replace its previous field set. It will not introduce a v2 parser, compatibility branch, filename, or user-facing version name. The existing `version: 1` literal remains only as the format marker for the single supported contract.

Product closeout removes `prd`, `sharedFeature`, and `featureResults`. The validator reads the single shared PRD binding from change-local `prd.md`, resolves it as a project-local file, and derives `FEATURE.md` from the same requirement directory. It validates delta Requirement mappings against shared PRD acceptance IDs and validates shared FEATURE evidence references against closeout evidence.

Evidence `artifact` remains required. `command` becomes optional because acceptance, monitoring, and manually produced evidence may not have a meaningful command; when present it is recorded but never executed.

Bugfix closeout remains product-field-free and uses the same directly replaced evidence/gate record shape where applicable.

### 5. Keep one authoritative formal close command

`workflow close <change>` already validates before archive and performs index/check afterward. Documentation will make it the only required formal close entry point. `validate:close <change>` remains an optional preflight and retains its exact-one-change argument contract.

### 6. Preserve upgrade and archive compatibility

New schemas and templates stop generating local FEATURE. History/index code may continue recognizing a legacy `feature.md` path so archives remain navigable. Installer upgrades will not move, delete, or rewrite archives. Tests will cover a target containing historical FEATURE files.

## Risks / Trade-offs

- AI governance cannot cryptographically prove approval. Mitigation: precise turn-boundary wording, explicit change selection, and conservative re-confirmation when prior authorization cannot be established.
- Deriving shared FEATURE from the shared PRD directory relies on the existing `docs/requirements/REQ-*/` convention. Mitigation: validate that both paths are project-local ordinary files and report a focused diagnostic.
- Shared FEATURE becomes a structured Markdown contract and may see merge conflicts when parallel changes update the same requirement. Mitigation: one result per row, deterministic parsing, stable IDs, and narrow edits.
- Directly replacing closeout is a breaking contract for active downstream changes. Mitigation: document the one-time migration, avoid archive rewrites, and ensure installer conflict/backup behavior remains intact.

## Migration Plan

1. Update schemas, templates, config, governance guidance, and shared requirement templates.
2. Replace the existing closeout parser and validation directly, rejecting obsolete fields without maintaining parallel old/new branches.
3. Update history/index generation without deleting legacy archive paths.
4. Update installer assets, examples, README, operations, adoption, and quality-gate documentation.
5. Migrate test fixtures and add authorization, shared FEATURE, replacement closeout, single-close, and archive-preservation coverage.
6. Build and run the complete verification suite.
7. Record passed evidence in this change's closeout and shared FEATURE before formal close.

Rollback consists of reverting the active implementation change before archive. Already archived content remains untouched.

## Open Questions

- None. The accepted review resolves the artifact, authorization, shared FEATURE, and closeout boundaries.
