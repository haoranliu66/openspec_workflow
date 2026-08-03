# change-lifecycle-governance Specification

## Purpose
TBD - created by archiving change simplify-closeout-and-gate-apply. Update Purpose after archive.
## Requirements
### Requirement: WFG-001 Planning package authorization stop

The workflow SHALL require the AI to end the current execution turn after the current Schema's apply-required artifacts and their dependency closure are complete, present the selected change ID and a planning summary, and wait for a later user message before modifying implementation code. For product-change, the planning package SHALL also include generated change-local `br.md` and `prd.md`.

#### Scenario: Product planning package becomes implementation-ready

- **WHEN** a product-change has `br.md`, `prd.md`, `proposal.md`, delta specs, `design.md`, and `tasks.md` generated
- **THEN** the AI SHALL present the change ID, scope, observable behavior, key decisions, risks, and task summary and SHALL end the current execution turn without implementing tasks

#### Scenario: Bugfix planning package becomes implementation-ready

- **WHEN** a bugfix has completed the apply-required artifacts and their Schema-defined dependencies
- **THEN** the AI SHALL apply the same authorization stop without requiring product-only artifacts

### Requirement: WFG-002 Change-scoped explicit authorization

The workflow SHALL treat only a later user message that explicitly authorizes the selected change as implementation authorization. An initial development request, change creation, artifact generation, `/opsx:continue`, or a generic request to continue before the authorization prompt MUST NOT authorize implementation.

#### Scenario: User invokes apply after planning review

- **WHEN** the user sends `/opsx:apply <change>` after the AI has presented that change's completed planning package
- **THEN** the workflow SHALL treat the command as implementation authorization for that change without asking a duplicate confirmation question

#### Scenario: User confirms the only prompted change

- **WHEN** the immediately preceding authorization prompt identifies exactly one change and the user replies with an unambiguous confirmation
- **THEN** the workflow SHALL authorize implementation only for that change

### Requirement: WFG-003 Material planning changes invalidate authorization

The workflow SHALL invalidate implementation authorization when planning changes alter delivery goals, scope, observable behavior, interfaces, data, security, migration, rollback, or task boundaries. Formatting, spelling, link repair, evidence recording, task checkbox updates, and implementation notes that do not change delivery scope MUST NOT invalidate authorization.

#### Scenario: Behavior changes after authorization

- **WHEN** an authorized change's Requirement or scenario is materially modified
- **THEN** the AI SHALL stop before further implementation, present the revised planning summary, and obtain a new authorization

#### Scenario: Task checkbox is updated

- **WHEN** implementation only changes a task checkbox from incomplete to complete
- **THEN** the existing authorization SHALL remain valid

### Requirement: WFG-004 Product artifact extension without local FEATURE

The product-change Schema SHALL retain change-local BR and PRD artifacts while preserving the native OpenSpec `proposal -> {specs, design} -> tasks` dependency subgraph. New product changes MUST NOT define or generate a change-local FEATURE artifact.

#### Scenario: Product change status is evaluated

- **WHEN** OpenSpec evaluates a new product-change using the updated Schema
- **THEN** `br.md` and `prd.md` SHALL remain recognized artifacts, `tasks.md` SHALL remain the apply tracking file, and `feature.md` SHALL not be part of the artifact graph

#### Scenario: Existing archive contains feature file

- **WHEN** the workflow is installed or upgraded in a project whose archive contains historical `feature.md`
- **THEN** the installer and governance commands MUST leave the archived file unchanged

### Requirement: WFG-005 Shared FEATURE is the delivery conclusion source

The workflow SHALL store each delivered product result in the shared requirement `FEATURE.md` as a separate row containing change ID, result ID, non-empty delivered conclusion, evidence IDs, version or date, and status. A result marked `ready` MUST reference at least one passed evidence record from the change closeout.

#### Scenario: Shared result has successful evidence

- **WHEN** a shared FEATURE row for the closing change is marked `ready` and every referenced evidence ID resolves to a passed project-local evidence artifact
- **THEN** the delivery result trace SHALL pass validation

#### Scenario: Shared result lacks evidence

- **WHEN** a shared FEATURE result has no evidence IDs or references missing or unsuccessful evidence
- **THEN** closeout validation SHALL fail with a FEATURE trace diagnostic

### Requirement: WFG-006 Minimal product closeout contract

The single supported product closeout contract SHALL directly replace the previous contract without introducing a parallel v2 format. It SHALL retain the existing `version: 1` format marker and contain only the version, complete delta Requirement-to-PRD acceptance mappings, evidence records, and the security, migration, browser, and rollback applicability matrix. The validator SHALL derive the shared PRD from change-local `prd.md` and the shared FEATURE from the shared requirement directory, and MUST NOT require duplicate PRD, shared FEATURE, or feature result fields in closeout JSON.

#### Scenario: Minimal closeout is complete

- **WHEN** a product closeout contains valid Requirement mappings, passed project-local evidence, a complete gate matrix, and matching shared PRD and FEATURE records
- **THEN** closeout content validation SHALL succeed without `prd`, `sharedFeature`, or `featureResults` JSON fields

#### Scenario: Applicable gate lacks matching evidence

- **WHEN** any applicable security, migration, browser, or rollback gate lacks passed evidence of the corresponding type
- **THEN** closeout validation SHALL remain blocking

### Requirement: WFG-007 Single required close entry point

The documented normal close flow SHALL require only `workflow close <change>`, which SHALL validate the explicit active change before archive and then rebuild navigation and run governance checks. `validate:close <change>` SHALL remain available as an optional non-mutating preflight.

#### Scenario: User runs formal close

- **WHEN** the user runs `workflow close <change>` for a valid active change
- **THEN** the command SHALL perform strict and closeout validation before archive without requiring a separate preflight command

#### Scenario: User wants a preview

- **WHEN** the user runs `validate:close <change>`
- **THEN** the command SHALL report the same pre-archive validation diagnostics without archiving the change

### Requirement: WFG-008 Three-way workflow selection

The workflow SHALL classify changes as bugfix, system-change, or product-change by the nature of the behavior and required governance rather than primarily by implementation size. Bugfix SHALL restore confirmed behavior without adding a new Requirement. System-change SHALL add or modify bounded system behavior that does not change product goals, user journeys, role permissions, business rules, or public contracts and does not need shared product acceptance. Product-change SHALL cover every change that needs product discovery or shared product acceptance, regardless of code size.

#### Scenario: Bounded system behavior is added

- **WHEN** a change adds a limited observable system capability without changing product goals, user journeys, role permissions, business rules, public contracts, or shared product acceptance
- **THEN** the workflow SHALL select the system-change path

#### Scenario: Small permission rule is changed

- **WHEN** a change has a small implementation diff but changes a role permission or business rule
- **THEN** the workflow SHALL select product-change and MUST NOT downgrade it because of implementation size

#### Scenario: Confirmed behavior is restored

- **WHEN** a bounded defect restores already confirmed behavior without creating a new Requirement
- **THEN** the workflow SHALL select bugfix

### Requirement: WFG-009 Native spec-driven system-change

The system-change governance path SHALL use OpenSpec `1.5.0`'s built-in `spec-driven` Schema directly. Change metadata MUST use `schema: spec-driven`; the repository and installer MUST NOT create or distribute a copied `system-change` Schema. The native proposal, specs, design, tasks, and apply dependency graph SHALL remain unchanged, and the implementation authorization stop SHALL apply after its complete apply-required dependency closure.

#### Scenario: System change is created

- **WHEN** the user creates a change selected as system-change
- **THEN** the change SHALL use `schema: spec-driven` and OpenSpec SHALL expose the native artifact graph without a local alias Schema

#### Scenario: Small system change reaches tasks

- **WHEN** a system-change has limited technical complexity
- **THEN** its design MAY be concise but tasks SHALL still wait for both specs and design as required by the native Schema

#### Scenario: Planning package is complete

- **WHEN** a spec-driven change's proposal, delta specs, design, and tasks are complete or materially changed
- **THEN** the AI SHALL end the current turn, present the exact change and plan summary, and wait for later change-scoped authorization

### Requirement: WFG-010 System-change closeout and archive governance

The workflow SHALL recognize `spec-driven` as a supported non-product closeout Schema. A system-change closeout SHALL require valid tasks input, project-local passed evidence, the complete security/migration/browser/rollback matrix, and stable IDs for every delta Requirement, while it MUST NOT require shared BR, PRD, FEATURE, or Requirement-to-PRD mappings. `workflow close <change>` SHALL strictly validate, archive, rebuild navigation/history, and run governance checks for the explicit spec-driven change.

#### Scenario: Valid system change is formally closed

- **WHEN** a spec-driven change has stable delta Requirement IDs, valid tasks, passed evidence, and a complete gate matrix
- **THEN** formal close SHALL archive it, update canonical specs and generated history, and complete governance checks without product trace artifacts

#### Scenario: System change has an unstable Requirement heading

- **WHEN** any spec-driven delta Requirement lacks the stable project Requirement ID prefix
- **THEN** closeout validation SHALL fail with `REQUIREMENT_INVALID`

#### Scenario: Installed workflow validates supported schemas

- **WHEN** Schema validation runs in the source repository or an installed target with OpenSpec 1.5.0
- **THEN** it SHALL validate bugfix, product-change, and the built-in spec-driven Schema while distributing no copied spec-driven Schema files

