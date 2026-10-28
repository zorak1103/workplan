# Workflow

## The idea

A workplan is the memory between sessions. Every Claude Code session starts without knowledge of
the previous one, so the document carries everything a fresh session needs: what is planned,
which phase comes next, what each phase requires and delivers, and what turned out differently.

Three rules shape the whole workflow:

1. **One phase is exactly one session.** Work that must happen in the same sitting is a
   subphase of that phase, not a separate phase.
2. **The document is the single place for status.** Status changes go through a script, and
   findings flow back into the document before a session ends.
3. **Planning and implementing are separate.** `create` and `review` never implement; `execute`
   implements one phase and stops.

## Lifecycle

```
              ┌────────────────────────── same session ───────────────────────────┐
 Session 1    │ create ──► validate ──► (optional) review ──► execute --amend      │
              └────────────────────────────────────────────────────────────────────┘
 Session 2    execute  Phase 0   ──►  status Done, commit hash in the document
 Session 3    execute  Phase 1   ──►  ...
 Session n    execute  Phase n   ──►  last phase Done
 Session n+1  close              ──►  harvest, closing sentence, optional delete
```

Each `execute` session starts cold. That is intended: the `Requires` field of the phase then acts
as a real check rather than a formality.

## When to use it, and when not

Use it for work that spans several sessions, touches several modules, or must be reviewable
before anything is built. Do not use it for work that fits one session, a TODO list, or fixing a
bug you can investigate and fix right now. The skill descriptions say so and make the model
decline to start them for ordinary planning.

## `create`

Input: a request, optionally `--genre workplan|bug`, `--from-bug <path>`, `--from-design <path>`.

| Step | What happens |
|---|---|
| 0 | repo root; `ensure-workplan-dir.mjs` checks `.workplans/` exists and is ignored; asks before fixing |
| 1 | genre (`workplan` or `bug`, asked if not given); a seed document switches to the seeding rules |
| 2 | clarifying questions, one at a time, until purpose, constraints and success criterion are clear; with `--from-design` only what the design leaves open |
| 3 | findings: read the code, give every finding a short unique ID, verify each one in the actual code |
| 4 | `new-workplan.mjs` resolves the target path, refuses to overwrite, reports documents of the same ticket (a series) |
| 5 | compose the whole document from the template, then write it once |
| 6 | self-review: coverage of findings, placeholders, name consistency between `Delivers` and `Requires` |
| 7 | `validate-workplan.mjs` as the mechanical gate; errors must be fixed, warnings should be |
| 8 | summary in English, then asks whether to run `review` |

Rules that are not negotiable: the Phase Overview comes first; each phase is one session and is
typed `Plan` or `Implementation`; each phase starts with the five fields `Goal`, `Requires`,
`Delivers`, `Files`, `Complexity`; `Requires` and `Delivers` name concrete identifiers; every
phase has a complexity of `S`, `M`, `L` or `XL` and an `XL` is split rather than labelled; the
Commit Cut is a proposal on its own axis; no placeholders.

`create` writes the document with `Write` as a whole. If the self-review finds something, it
re-emits the entire document instead of patching it. It never commits, builds or runs tests.

Output: `.workplans/<slug>.md`, or `.workplans/<ticket>-<slug>.md` when a ticket is given.

### Bug analysis genre

`--genre bug` writes an investigation document instead: Symptom, Root Cause, Evidence Chain,
Reproduction, Red Reproduction Tests, and a Fix Sketch behind the `<a id="fix-sketch"></a>` anchor. It has
no phases and no status. The root cause and every step of the evidence chain must be verified in
the code. A later `create --from-bug <path>` turns the fix sketch into a workplan; the bug
analysis itself is never modified.

### Seeding from a design document

`create --from-design <path>` starts from an approved design document. See
[brainstorming-integration.md](brainstorming-integration.md).

## `review`

Input: a workplan (picked if several exist). Output: chat only, nothing is written.

Three agents run in parallel in one message, all restricted to `Read`, `Grep` and `Glob`:

| Agent | Question |
|---|---|
| `workplan-fact-checker` | is every finding true in the actual code, and does every phase reference an existing finding? |
| `workplan-cut-critic` | is each phase one session, are `Requires` and `Delivers` concrete and chained, is Phase 0 a real safety net, do the complexity ratings fit, is the commit cut coherent? |
| `workplan-devils-advocate` | is there a better approach? It must propose a concrete alternative or concede after actively searching |

The skill merges the results, most severe first: refuted or unverifiable findings and dangling
references are blockers, partially confirmed findings are major, the cut critic's severities are
carried through, and an alternative from the devil's advocate is its own top-level item. Confirmed
findings do not appear as findings. A `conceded` verdict is shown as one confirming line.

Nothing is applied automatically. What you decide to keep goes into the document through
`/workplan:execute --amend`.

## `execute`

Input: a workplan, optionally `--phase <id>`, or `--amend`. It is the only skill with
unrestricted `Bash`, because a phase can be a real implementation session in the project's own
toolchain.

| Step | What happens |
|---|---|
| 1 | `workplan-status.mjs` resolves the document and the phase (the given one, else the first `Open`); if everything is `Done` it stops and points to `close`; it names the phase's complexity before starting |
| 2 | read only this phase, plus Current State, Goal, Out of Scope and the findings the phase references by ID; never read other phases; stop if `Requires` names something that does not exist |
| 3 | do the work: a `Plan` phase deepens the plan and writes findings back, an `Implementation` phase changes the files and runs the project's checks |
| 4 | write back with `set-phase-status.mjs`, plus findings and corrections in `## Addenda` |
| 5 | stop; name the next open phase without starting it |
| 6 | only on request: update the merge request description with the project's own forge CLI |

Write-back rules: use `In progress` rather than `Done` when work is outstanding and say what is
outstanding; append to `## Addenda`, never overwrite; a statement that turned out wrong gets a
`> [!NOTE]` that marks it superseded instead of being deleted; the complexity estimate in the table is
never rewritten, deviations go into the Addenda; changes to the commit cut update the table row.

`--amend` skips straight to step 4 without touching any status. It is the path for findings that
arise outside a phase, for example an accepted review result.

## `close`

Input: a workplan whose phases are all `Done`. Output: optional harvested files, a closing
sentence in the document, and optionally the deletion of the document.

| Step | What happens |
|---|---|
| 1 | checks that every phase is `Done`; otherwise lists the open ones and stops |
| 2 | harvest, one item at a time, each with its own confirmation: a memory entry, a documentation change, a merge request description, a follow-up ticket (drafted, never filed) |
| 3 | `close-workplan.mjs --append-closing-sentence` appends "<topic> is now fully completed." |
| 4 | asks whether to delete; keeping the document is a valid answer; `--delete` only on explicit confirmation |
| 5 | summary of what went where |

`close-workplan.mjs` refuses to append or delete while any phase is not `Done`, independent of the
skill's own check.

## A typical project, concretely

1. Session 1: you describe a refactoring. `create` asks four or five questions, reads the code,
   finds three real problems, writes a workplan with Phase 0 (characterization tests, `S`),
   Phase 1 (core change, `M`), Phase 2 (migration of callers, `L`) and a commit cut of two commits.
   Validation passes. You run `review`; the fact checker refutes one finding, you accept the
   correction and have it written with `execute --amend`.
2. Sessions 2 to 4: each starts with `/workplan:execute`. The skill names the phase and its
   complexity, reads only that phase, works, and writes status and the commit hash back. In
   session 3 the code shows that Phase 2 needs a different split; the commit table is updated and
   the reason goes into the Addenda.
3. Session 5: `/workplan:close`. A memory entry and one convention for the project documentation
   are harvested after confirmation, the closing sentence is appended, and you decide to delete the
   document.

## What the scripts do for the skills

The skills never edit tables by hand. They call the scripts in `scripts/`; see
[CONTRIBUTING.md](../CONTRIBUTING.md) for arguments and exit codes.

| Script | Used by | Purpose |
|---|---|---|
| `ensure-workplan-dir.mjs` | create | check or create `.workplans/` and its ignore entry |
| `new-workplan.mjs` | create | target path, overwrite protection, series detection |
| `validate-workplan.mjs` | create | mechanical gate for structure, vocabulary, consistency |
| `workplan-status.mjs` | execute, review, close | list phases, find the next open phase, list candidate documents |
| `set-phase-status.mjs` | execute | flip one status cell and optionally one commit hash |
| `close-workplan.mjs` | close | closing sentence and deletion, both only when all phases are `Done` |
| `check-skill-entry-confirmation.mjs` | hook | force a confirmation before a model-chosen skill starts |
