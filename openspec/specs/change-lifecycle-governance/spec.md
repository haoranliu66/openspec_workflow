# change-lifecycle-governance Specification

## Purpose

Define the workflow-selection, authorization, verification, formal-close, installation, and history-governance behavior shared by all supported OpenSpec change paths.

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

The workflow SHALL store each delivered product result in the shared requirement `FEATURE.md` as a separate row containing change ID, result ID, non-empty delivered conclusion, evidence references, version or date, and status. A result marked `ready` MUST be supported by verification material reviewed by the team. The shared FEATURE remains the product delivery conclusion source, but Schema, scripts, CLI, and CI MUST NOT claim to prove the semantic correctness or evidence sufficiency of its rows during formal close.

#### Scenario: Shared result is accepted in team review

- **WHEN** the team reviews a product change's verification material and determines that a shared FEATURE result is delivered and supported
- **THEN** the result MAY be marked `ready` with evidence references and formal close SHALL NOT repeat a machine FEATURE/evidence validation

#### Scenario: Shared result is not supported

- **WHEN** team review finds that a planned or ready FEATURE conclusion is not supported by the implementation or verification record
- **THEN** the delivery claim MUST be corrected before close authorization is requested

### Requirement: WFG-007 Single required close entry point

The documented normal close flow SHALL require only `workflow close <change>`. For the explicit active change, the command SHALL execute OpenSpec strict validation before archive, run archive with delta application by default, rebuild navigation/history, and run governance checks. The workflow MUST NOT provide a separate `validate:close` command or execute custom closeout, task, evidence, gate, Requirement/PRD, FEATURE, or stable-ID validation. `--skip-specs` SHALL remain a recovery-only option for a change that was already synced and MUST NOT be documented as the normal path.

#### Scenario: Team-authorized change is formally closed

- **WHEN** the team has reviewed a change, explicitly authorized its close, and runs `workflow close <change>`
- **THEN** the command SHALL strictly validate, archive with delta application, rebuild generated navigation/history, and run governance checks without reading a closeout contract

#### Scenario: Strict validation fails

- **WHEN** `openspec validate <change> --strict` fails for the explicit active change
- **THEN** formal close SHALL stop before archive and report the validation failure

#### Scenario: Change was already synced

- **WHEN** an exceptional recovery case has already applied the change's delta to canonical specs
- **THEN** the user MAY invoke formal close with `--skip-specs`, while normal workflow guidance SHALL continue to apply delta only during archive

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

The workflow SHALL recognize `spec-driven` as the native Schema for the system-change path and apply the same change-local verification, team review, explicit close authorization, and minimal formal archive governance used by other paths. System-change MUST NOT require shared BR, PRD, or FEATURE. Stable delta Requirement IDs remain a team-reviewed governance convention, but the formal close command MUST NOT parse or separately gate them.

#### Scenario: Reviewed system change is formally closed

- **WHEN** a spec-driven change has verification material reviewed by the team and receives explicit close authorization
- **THEN** formal close SHALL strictly validate, archive, rebuild navigation/history, and run governance checks without a non-product closeout contract

#### Scenario: Team review finds an unstable Requirement heading

- **WHEN** team review finds that a spec-driven delta Requirement does not follow the project's stable ID convention
- **THEN** the team SHALL correct or explicitly resolve the traceability issue before authorizing close, without claiming a Schema or CI proof

#### Scenario: Installed workflow validates supported schemas

- **WHEN** Schema validation runs in the source repository or an installed target with OpenSpec 1.5.0
- **THEN** it SHALL validate bugfix, product-change, and the built-in spec-driven Schema while distributing no copied spec-driven Schema or closeout contract

### Requirement: WFG-011 Change-local team verification record

For every workflow path, the team SHALL record delivered scope, test cases and results, evidence references, applicable risk decisions, incomplete work, known limitations, and rollback information under the active change using `verification.md` and optional `evidence/` material. These records SHALL move with the change when OpenSpec archives it. They MUST remain outside the OpenSpec artifact graph and MUST NOT be required, parsed, or semantically judged by Schema, scripts, CLI, or CI.

#### Scenario: Implementation reaches team review

- **WHEN** implementation and verification work is ready for close review
- **THEN** the AI or delivery team SHALL prepare the change-local verification record and disclose every known incomplete or deferred item and its delivery impact

#### Scenario: Verification contains large or sensitive artifacts

- **WHEN** detailed evidence is too large for source control or contains credentials, personal data, or other sensitive content
- **THEN** the change record SHALL store a concise result and safe external reference rather than committing the sensitive or oversized artifact

#### Scenario: Change is archived

- **WHEN** OpenSpec archives a change containing `verification.md` or `evidence/`
- **THEN** those files SHALL be preserved with the archived change without a separate evidence migration step

### Requirement: WFG-012 Explicit team close authorization

After verification is prepared, the AI SHALL present the exact change ID, delivered and tested scope, evidence summary, incomplete tasks, known limitations, risk decisions, and finalization plan, then end the current execution turn and wait for a later explicit close authorization. Implementation authorization, task completion, verification generation, `/opsx:sync`, a generic continuation, or a prior apply confirmation MUST NOT authorize close. Close authorization applies only to the identified change and is team governance that SHALL NOT create an approval artifact or program/CI proof.

#### Scenario: Team explicitly authorizes close

- **WHEN** the immediately preceding close review identifies exactly one change and the user later says `确认关闭 <change>` or gives an unambiguous equivalent instruction
- **THEN** the AI MAY run formal close for that change without asking a duplicate confirmation

#### Scenario: Incomplete task is accepted

- **WHEN** a task is impossible, cancelled, or deferred and the team accepts the stated reason, delivery impact, affected Requirement/FEATURE claims, and follow-up arrangement
- **THEN** the team MAY authorize close after false delivery claims are corrected, without requiring a machine checkbox exception or approval record

#### Scenario: Only implementation was authorized

- **WHEN** a change has implementation authorization but no later explicit close authorization
- **THEN** the AI MUST NOT run formal close on the user's behalf

### Requirement: WFG-013 Safe retirement of legacy closeout assets

The source repository and clean installations MUST NOT distribute the retired closeout validation script, closeout-specific libraries, or closeout JSON templates. During upgrade, the installer SHALL retire only explicitly allowlisted paths owned by the previous workflow manifest, create a recoverable backup before removal, and leave unowned files and all project change, archive, verification, and evidence content unchanged.

#### Scenario: Legacy installed target is upgraded

- **WHEN** an installed target's previous workflow manifest owns a retired closeout implementation file
- **THEN** the installer SHALL back up and remove that managed file and report the retirement

#### Scenario: Similar user file is not workflow-managed

- **WHEN** a target contains a closeout-named file that is not both allowlisted and owned by the previous workflow manifest
- **THEN** the installer MUST leave the file unchanged

#### Scenario: Historical closeout record exists

- **WHEN** an active or archived change contains a historical `closeout.json` or the project contains historical closeout evidence
- **THEN** installation, upgrade, governance, and formal close MUST leave that content unchanged and the new close command SHALL ignore it
