# Workplan document conventions

Binding rules for both document genres this plugin manages. `scripts/validate-workplan.mjs`
enforces the mechanical parts of this file; the `create`/`execute`/`close` skills enforce the
rest. This file, all skill and agent text, all chat output and all document content are written
in English.

## Genres

Exactly two genres are recognized, by the document's title prefix:

- `# Workplan: <Topic>` — the canonical, phased genre. Template:
  `reference/workplan-template.md`.
- `# Bug Analysis: <Short description>` — an investigation write-up with no phases and no status
  tracking, ending in a `<a id="fix-sketch"></a>` anchor. Template:
  `reference/bug-analysis-template.md`.

Any other title prefix is out of scope for this plugin (ideas/analysis documents, handoffs) —
`validate-workplan.mjs` refuses to validate a document it can't classify rather than guessing.

## Storage

- Directory: `<repo-root>/.workplans/`.
- Extension: `.md`.
- The directory must be git-ignored (`.git/info/exclude` preferred over a tracked `.gitignore`
  entry, since these documents are personal working notes, not project history). `create` checks
  this before writing anything and never creates the entry silently.
- File name: a kebab-case slug derived from the task's subject, optionally ticket-prefixed
  (`PROJ-1234-<slug>.md`) when a ticket is known.
- A `.md` file in `.workplans/` whose first line is not `# Workplan:` or `# Bug Analysis:` (for
  example a design document) is not a workplan and is ignored by the status listing and the
  series scan.

## Workplan genre — required section order

1. `## Phase Overview` — status table, **first content section**, so the current state of the
   work is visible without scrolling.
2. `## Commit Cut (Proposal)` — proposed commit cut, its own axis, independent of the phase cut.
   Always followed by the `> [!NOTE]` stating it is a proposal that may be revised during execution
   — never silently overridden without updating this table.
3. `## Current State`
4. `## Findings` — one `### <ID> — <Short title>` subsection per finding.
5. `## Goal`
6. `## Target Design` (optional)
7. `## Approach` — one `### Phase <n> — <Title>` subsection per phase, in the same order and
   with the same phase identifiers as the Phase Overview table rows. Phases may contain
   `#### <n>.<m> — <Title>` subphases, which are executed within the same session as their
   parent phase.
8. `## Out of Scope`
9. `## Risks` — pipe table, columns `Risk | Severity | Mitigation`.
10. `## Verification`
11. `## Addenda` (optional at creation time, becomes the write-back target for
    `execute --amend`).

## Phase Overview table

Pipe table, columns `Phase | Content | Type | Complexity | Status`.

- **Phase** is the identifier referenced by the matching `### Phase <id> — ...` heading in
  `## Approach`. Every row needs a matching heading and vice versa.
- **Type** is either `Plan` (a planning-only session — no production code) or `Implementation`
  (an implementation session). A phase is exactly one Claude Code session; subphases stay inside
  that same session.
- **Complexity** is one of exactly four values: `S`, `M`, `L`, `XL` — see
  `reference/complexity-rubric.md` for what each level means and which drivers justify it. It
  must be present (a document without this column fails validation) and must agree with the
  phase's `**Complexity:**` field (below). `XL` is a splitting signal, not a level to plan a
  session around.
- **Status** is one of exactly three values: `Open`, `In progress`, `Done`. No checkboxes, no
  other vocabulary (`Finished`, `Completed`, `Closed` etc.).

## Commit Cut table

Pipe table, columns `Commit | Phase | Content | Hash`. A commit's **Phase** cell may name
a single phase (`1`) or a range (`1-2`) when one commit bundles multiple phases. **Hash** is `—`
until the commit exists; `set-phase-status.mjs --commit` fills it in. This table is a proposal —
it is expected to change during execution, and changes must be reflected here, not left stale.

## Phase body — required fields

Every `### Phase <n> — ...` heading's body starts with five bold-marker fields written as bullets (the validator also accepts them without
the leading `- `), in this order, before any prose or subphases:

```
- **Goal:** <one sentence>
- **Requires:** <concrete names/signatures this phase needs from earlier phases, or "none">
- **Delivers:** <concrete names/signatures later phases can rely on>
- **Files:** `<file>` (new|modify), ...
- **Complexity:** <S|M|L|XL> — <justification citing Scope/Uncertainty/Blast radius/Verification effort>
```

`Requires`/`Delivers` exist because a phase runs in a fresh session with no memory of the
previous one — vague prose here defeats the reason phases are cut in the first place. Missing
any of the five fields is a validation failure. `Complexity`'s level must match the phase's cell
in the Phase Overview table — a mismatch is a validation failure too, since the two are meant to
stay in lockstep. The level is a planning-time estimate: if a phase turns out significantly more
or less complex during execution, that goes into `## Addenda`, not into a rewritten cell — the
table keeps showing what was planned, not what happened.

## No placeholders

Once a document is handed off for execution, it must not contain unresolved placeholders such as
"TBD", "TODO", "to be added", "add later", "similar to phase 2", "appropriate error handling",
"details to follow". Angle-bracket placeholders (`<...>`) are fine in the *templates* under
`reference/` — they are not fine in a document `create` has finished writing.
`scripts/lib/workplan.mjs` exports `PLACEHOLDER_PATTERNS` for this check.

## Finding IDs

Every `### <ID> — <Short title>` under `## Findings` gets a short, stable, alphanumeric ID
(`C1`, `H2`, `P1`, `D1`, …) that phases and other findings can reference by name. IDs must be
unique within the document.

## Bug Analysis genre — required section order

1. `## Symptom`
2. `## Root Cause`
3. `## Evidence Chain (Call Chain)`
4. `## Reproduction`
5. `## Red Reproduction Tests`
6. `<a id="fix-sketch"></a>` `## Fix Sketch for the Follow-up Session (not part of this session)`

No status table, no commit table, no phases — this genre is an end document in its own right.
`create --from-bug <path>` reads its `<a id="fix-sketch"></a>` section to seed Phase 0/1 of a new Workplan
document; it does not mutate the bug analysis itself.

## Seeding a workplan from a design document

`create --from-design <path>` reads an approved design or spec document of any shape and seeds a
new Workplan from it; the design document stays read-only. It excludes `--from-bug` and
`--genre bug`. The mapping:

| Design document | Workplan section |
|---|---|
| intent, the why, success criterion | `## Goal` |
| current state, prior work, constraints | `## Current State` |
| non-goals | `## Out of Scope` |
| anti-goals | `## Risks` and `## Verification` |
| decisions the user made | `## Target Design` |
| parts left to the builder | resolved by findings and the phase cut |

Statements about the code are unverified claims until `create` has confirmed them as findings
(see "Workplan genre" above); a contradiction is reported to the user, never resolved silently.
The workplan's preamble names the source document. Assumptions that change during execution are
recorded in `## Addenda`; the design document is not updated by this plugin.
