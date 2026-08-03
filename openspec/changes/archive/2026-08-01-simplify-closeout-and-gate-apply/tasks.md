## 1. Schema and authorization governance

- [x] 1.1 Remove the product-change `feature` artifact and template, retain `br -> prd`, preserve the native proposal/specs/design/tasks subgraph, and update Schema alignment checks.
- [x] 1.2 Add the Schema-aware planning authorization stop, explicit change-scoped authorization, and material-change invalidation rules to repository and installed-target guidance.
- [x] 1.3 Add apply instructions for product-change and bugfix without adding an approval artifact or claiming Schema/CI proof.
- [x] 1.4 Update propose/continue/ff/apply/onboard usage documentation so a post-planning `/opsx:apply <change>` counts as authorization and no implementation occurs in the planning turn.

## 2. Shared FEATURE and closeout

- [x] 2.1 Replace the shared FEATURE ledger with one row per result containing change ID, result ID, delivered conclusion, evidence IDs, version/date, and status.
- [x] 2.2 Replace local FEATURE parsing with shared FEATURE result parsing and validate every ready result against passed closeout evidence.
- [x] 2.3 Directly replace the existing closeout contract without a parallel v2 format, retain the `version: 1` marker, remove product `prd`, `sharedFeature`, and `featureResults` JSON fields, and make evidence `command` optional while keeping `artifact` required.
- [x] 2.4 Derive the shared PRD from change-local `prd.md`, derive sibling `FEATURE.md`, and retain complete delta Requirement-to-PRD acceptance validation.
- [x] 2.5 Preserve tasks input validation and the complete security, migration, browser, and rollback matrix with matching evidence for applicable gates.

## 3. Close workflow, history, and installation

- [x] 3.1 Keep `validate:close <change>` as an exact-one-change optional preflight and document `workflow close <change>` as the only required formal close entry point.
- [x] 3.2 Update generated lifecycle/index wording to remove the local feature phase while preserving legacy archive navigation.
- [x] 3.3 Update installer assets and upgrade behavior without deleting, moving, or rewriting archived `feature.md` files.

## 4. Documentation and verification

- [x] 4.1 Update README, AGENTS, adoption, full workflow, operations, quality gates, examples, templates, and changelog with one consistent governance boundary.
- [x] 4.2 Update contract, shared FEATURE, trace, closeout integration, Schema alignment, history, installer, CLI, and governance tests.
- [x] 4.3 Run `npm run build`, the focused compiled tests, and `npm run verify`; retain project-local passed evidence artifacts.

## 5. Closeout evidence

- [x] 5.1 Record the security applicability decision and its required closeout evidence.
- [x] 5.2 Record the migration applicability decision and its required closeout evidence.
- [x] 5.3 Record the browser applicability decision and its required closeout evidence.
- [x] 5.4 Record the rollback applicability decision and its required closeout evidence.
- [x] 5.5 Review incomplete tasks, continue all feasible work, and record any user-confirmed cancellation or deferral together with its delivery impact before closeout.
- [x] 5.6 Record stable delta Requirement IDs, PRD acceptance mappings, shared FEATURE result/evidence rows, and the minimal replacement closeout document required for formal close.
