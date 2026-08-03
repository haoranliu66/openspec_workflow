## 1. Workflow selection and native Schema boundary

- [x] 1.1 Add the mutually exclusive bugfix/system-change/product-change decision rules to AGENTS, OpenSpec config, README, adoption, full workflow, quality, operations, examples, and changelog.
- [x] 1.2 Define `system-change` as a governance label whose metadata is exactly `schema: spec-driven`; do not create or install a copied Schema or template directory.
- [x] 1.3 Make global proposal BR/PRD rules explicitly product-change-only while retaining stable Requirement ID, authorization, tasks, and evidence rules for all paths.
- [x] 1.4 Render generated lifecycle guidance with separate product shared-FEATURE and non-product evidence branches before the common formal close.

## 2. Closeout, history, and Schema recognition

- [x] 2.1 Extend `CloseoutSchema`, parsing, diagnostics, and validation to support spec-driven with the existing non-product closeout shape.
- [x] 2.2 Require stable delta Requirement IDs for spec-driven without adding product Requirement/PRD or shared FEATURE trace requirements.
- [x] 2.3 Recognize active and archived spec-driven changes in deterministic change history and governance diagnostics.
- [x] 2.4 Validate the OpenSpec 1.5.0 built-in spec-driven Schema alongside the two project schemas without distributing a local copy.

## 3. Installation and end-to-end behavior

- [x] 3.1 Add a discoverable spec-driven closeout template or an unambiguous documented mapping to the shared non-product shape without duplicating parser logic.
- [x] 3.2 Update installer/runtime expectations so installed targets rely on their required OpenSpec 1.5.0 package for spec-driven and never receive a copied Schema directory.
- [x] 3.3 Add a real installed-target scenario that creates a stable-ID spec-driven delta, validates it, formally closes it, updates canonical specs, and enters generated history.
- [x] 3.4 Verify invalid spec-driven closeout inputs fail for unstable IDs, tasks, evidence, or gates and never require product-only artifacts.

## 4. Tests and verification

- [x] 4.1 Update closeout contract, content validation, formal close, Schema runner, change history, governance, installer, and OpenSpec integration tests.
- [x] 4.2 Add decision-boundary behavior tests that prevent small permission/business-rule changes from being downgraded and prevent bounded non-product behavior from requiring BR/PRD.
- [x] 4.3 Run focused red/green tests, `npm run build`, `npm run verify`, and `git diff --check`; retain project-local passed evidence artifacts.

## 5. Closeout evidence

- [x] 5.1 Record the security applicability decision and its required closeout evidence.
- [x] 5.2 Record the migration applicability decision and its required closeout evidence.
- [x] 5.3 Record the browser applicability decision and its required closeout evidence.
- [x] 5.4 Record the rollback applicability decision and its required closeout evidence.
- [x] 5.5 Review incomplete tasks, continue all feasible work, and record any user-confirmed cancellation or deferral with delivery impact before formal close.
- [x] 5.6 Record WFG-008..WFG-010 to PA-001..PA-008 mappings, shared FEATURE result rows, and the minimal product closeout for this governance change.
