## ADDED Requirements

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
