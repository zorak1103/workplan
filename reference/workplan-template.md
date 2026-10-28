# Workplan: <Topic>

<Ticket + branch, scope line, and, if applicable, the position in a workplan series: "This document
is **Workplan N** under ticket **<TICKET>** (branch `<branch>`), after Workplan N-1 (<topic N-1>)."
If seeded via `--from-design` or `--from-bug`, also the source document: "Seeded from `<path>`.">

> [!NOTE]
> Line numbers in this document reflect the state at the time of analysis and drift with
> every restructuring. Always navigate by method name / symbol search, never jump blindly to a
> line.

> [!IMPORTANT]
> **The scope of this session is exclusively this planning document.** The phases
> described below are implemented in separate sessions (see `## Phase Overview`).

## Phase Overview

| Phase | Content | Type | Complexity | Status |
|---|---|---|---|---|
| 0 | <Create a safety net (mandatory)> | Implementation | <S/M/L/XL> | Open |
| 1 | <Short description> | Plan | <S/M/L/XL> | Open |

## Commit Cut (Proposal)

| Commit | Phase | Content | Hash |
|---|---|---|---|
| C1 | 0 | <What belongs in this commit> | — |
| C2 | 1 | <What belongs in this commit> | — |

> [!NOTE]
> Proposal. The cut may be revised during execution — changed rows are updated here, not
> silently ignored.

## Current State

<Current state: what is the situation before this workplan, why is it needed.>

## Findings

### <ID> — <Short title>

<Finding, verified in the code, not assumed. File and method references instead of line numbers.>

## Goal

<One or two sentences: what is the state after full implementation.>

## Target Design

<Rough design, where relevant — modules, interfaces, data flow.>

## Approach

### Phase 0 — <Title> (mandatory)

- **Goal:** <one sentence>
- **Requires:** <concrete names/signatures this phase needs from earlier phases — "none" for Phase 0>
- **Delivers:** <concrete names/signatures later phases take over from this phase>
- **Files:** `<file>` (new), `<file>` (modify)
- **Complexity:** <S/M/L/XL> — <justification along Scope/Uncertainty/Blast radius/Verification effort, see reference/complexity-rubric.md>

<Work steps as a list.>

### Phase 1 — <Title>

- **Goal:** <one sentence>
- **Requires:** <see above>
- **Delivers:** <see above>
- **Files:** `<file>` (modify)
- **Complexity:** <S/M/L/XL> — <justification>

<Work steps. If needed, subphases — they run in the same session:>

#### 1.1 — <Subphase>

<Work steps.>

## Out of Scope

<What is explicitly not part of this workplan, with a reference to a follow-up ticket if any.>

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| <Risk> | <low/medium/high> | <Countermeasure> |

## Verification

<How each phase is checked before it counts as Done — depends on the task (tests, manual check,
build). Project rules (e.g. how tests are run) apply as described in the project's own
instructions and are not repeated here.>

## Addenda

<Write-back target for insights that arise outside a running phase — see `execute --amend`.
Empty at creation.>
