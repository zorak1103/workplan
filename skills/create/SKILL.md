---
name: create
description: "Creates a persistent workplan document under .workplans/ -- phase overview first, proposed commit cut, findings, one section per phase with Goal/Requires/Delivers/Files/Complexity -- or, with --genre bug, a bug-analysis document (Symptom/Root Cause/Evidence Chain/Reproduction/Fix Sketch, no phases). Use only when the user asks for such a document for a multi-session task. Not for ordinary planning, a TODO list, or simply investigating or fixing a bug in this session."
argument-hint: "[--genre workplan|bug] [--from-bug <path>] [--from-design <path>]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git rev-parse --show-toplevel)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*" *)
---

# create

Entry to this skill is gated by the plugin's `PreToolUse` hook
(`scripts/check-skill-entry-confirmation.mjs`): the harness forces one explicit confirmation
before this skill starts, in every permission mode. Do **not** ask a second "shall I start?"
question here — the confirmation has already happened.

Plans, never implements. Omitting `Edit` and general `Bash` from `allowed-tools` above means
they are simply not pre-approved for this skill's turn — such a call still runs into the normal
permission flow, it is not blocked outright (`allowed-tools` is a turn-scoped grant, not a
restriction). The actual discipline is a rule this skill follows, not one the frontmatter
enforces: plans, never implements — no `git commit`, no build or test runner, no
`Edit` call, here. If the task genuinely needs code changed before a plan can even be written
(e.g. a quick spike to confirm a fact), do that in a separate, ordinary session first, then run
this skill.

All chat output and all document content are English.

## Step 0 — Repo root and start check

```
git rev-parse --show-toplevel
```

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ensure-workplan-dir.mjs" --repo-root <repoRoot> --json
```

If `ok` is `false` in the result: tell the user what's missing (`.workplans/` doesn't exist,
or exists but isn't git-ignored), then `AskUserQuestion` (`header: "Setup"`) whether to create/
fix it now. Only on confirmation:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ensure-workplan-dir.mjs" --repo-root <repoRoot> --create --json
```

Never call `--create` without that confirmation — this plugin never writes into a repo's git
configuration silently.

## Step 1 — Genre

From `--genre`, or ask (`AskUserQuestion`, `header: "Genre"`, options "Workplan" /
"Bug analysis"). See `${CLAUDE_PLUGIN_ROOT}/reference/document-conventions.md` for what
distinguishes the two.

**With `--from-bug <path>`:** `Read` the bug-analysis document, extract its `<a id="fix-sketch"></a>`
section (`## Fix Sketch for the Follow-up Session`). This becomes the seed for the new workplan's
`## Current State`/Phase 0/Phase 1 — genre is `workplan` regardless of the `--genre` flag in this
case. Note the source document's path in the new workplan's preamble as a back-reference. The
bug-analysis document itself is read-only here — this skill never mutates it.

**With `--from-design <path>`:** `Read` an approved design or spec document (any shape — for
example the result of a brainstorming session; it is not required to follow a fixed template).
Genre is `workplan`. The document answers the *what and why*; this skill adds the *how, in what
order, across how many sessions*. Seed the new workplan from it like this:

| Design document | Workplan |
|---|---|
| intent, the why, success criterion | `## Goal` |
| current state, prior work, constraints | `## Current State` |
| non-goals | `## Out of Scope` |
| anti-goals (what would make it a failure even if it works) | `## Risks` and `## Verification` |
| decisions the user made | `## Target Design`, as decided |
| parts left to the builder | resolved by Step 3 (research) and the phase cut |

Rules:

- Combining `--from-design` with `--from-bug`, or with `--genre bug`, is contradictory — a bug
  analysis has no phases to seed. Stop and ask (`AskUserQuestion`, `header: "Source"`) which of
  the two the user means.
- Statements in the design document about the current state of the code are **unverified
  claims** until Step 3 has checked them. If the code contradicts the document, make that a
  finding and ask the user how to proceed — never silently pick one side.
- Calls the design document marks as the author's own (not the user's decision) stay marked as
  such in `## Target Design`.
- Note the source document's path in the new workplan's preamble as a back-reference. The design
  document itself is read-only here — this skill never mutates it, so the workplan and the design
  can drift apart; record changed assumptions in `## Addenda`, not in the design document.

## Step 2 — Clarify before writing

One question at a time until purpose, constraints, and a success criterion are clear enough to
write `## Goal` and cut phases. Prefer multiple-choice `AskUserQuestion` where the options are
genuinely distinct; open text otherwise.

With `--from-design`, skip every question the design document already answers; ask only about
what the phase cut still needs and the document leaves open (session budget, ordering
preferences, which risks are acceptable). Do not re-ask intent, goals or constraints.

## Step 3 — Findings (workplan genre only)

Gather findings freely — reading code, existing docs, and existing test files, whatever the task
calls for (read-only by convention — do not run tests or builds here). Two hard rules, not
negotiable:

- Every finding gets a short, stable, unique ID (`C1`, `H1`, `P1`, …).
- Every finding must be **verified in the actual code**, not assumed from a description or a
  ticket. A finding you can't point to a file/method for doesn't belong in `## Findings` yet.

## Step 4 — Resolve the target path and series

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/new-workplan.mjs" --repo-root <repoRoot> --slug <kebab-case-slug> --genre <genre> [--ticket <id>] --json
```

Refuses to overwrite an existing document (exit 2) — pick a different slug rather than force
anything. If `existingSeries` is non-empty, the new document is part of a series: note the
series number and a one-line back-reference to the prior document(s) in the preamble (see
the preamble placeholder in `${CLAUDE_PLUGIN_ROOT}/reference/workplan-template.md`) — the script only
*finds* the candidates, composing the actual "Workplan N, after Workplan N-1" prose is this
skill's job.

## Step 5 — Write the document

Fill `${CLAUDE_PLUGIN_ROOT}/reference/workplan-template.md` (workplan genre) or
`${CLAUDE_PLUGIN_ROOT}/reference/bug-analysis-template.md` (bug genre) for the target path from
Step 4. **Compose the whole document now, before writing it** — Step 6's self-review reads it
back and, if it finds something to fix, the fix happens by re-emitting the *entire* document via
another `Write` call (this skill does not use `Edit`, by convention — see the intro), not a
partial patch.

**Workplan genre — non-negotiable:**

- **Phase Overview stays first**, not last: status belongs at the top of the document.
- **Cut phases so each is exactly one Claude Code session.** Mark each `Plan` (a
  planning-only session, no production code) or `Implementation`. Anything that must happen in
  the same sitting as a phase is a `####` subphase of it, not a separate phase.
- Every `### Phase <n> — ...` starts with
  `**Goal:**`/`**Requires:**`/`**Delivers:**`/`**Files:**`/`**Complexity:**`, in that order, before any
  prose. `**Requires:**`/`**Delivers:**` name concrete identifiers (`ClassName.methodName()`, a
  field, a file) — a phase starts cold in a fresh session with no memory of the one before it, so
  vague prose here defeats the entire reason phases are cut.
- **Estimate each phase's complexity as `S`/`M`/`L`/`XL`** per
  `${CLAUDE_PLUGIN_ROOT}/reference/complexity-rubric.md`, in both the Phase Overview table cell
  and the phase's `**Complexity:**` field (the two must agree) — do this in the same step as the
  file map below, since the file list is exactly what the estimate is grounded in. The
  justification names which driver (Scope/Uncertainty/Blast radius/Verification effort) pushed
  the level, never a model or effort setting — that decision belongs to whoever executes the
  phase. `XL` means: reconsider the cut and split before finalizing, don't just label it and move
  on.
- **The Commit Cut is a proposal on its own axis**, not "one phase = one commit" — bundle or
  split commits however makes sense, and say so via the table's `> [!NOTE]`.
- File a file map per phase (the `**Files:**` field) before finalizing the cut — deciding
  which files each phase touches is where the phase boundaries actually get locked in.

**Bug genre — non-negotiable:**

- `## Root Cause` must be verified in the actual code, not assumed from the reported symptom —
  same evidentiary bar as a workplan finding.
- Every step in `## Evidence Chain (Call Chain)` traces to a concrete file/method — no step that
  just asserts "and then X happens" without showing where.
- `## Reproduction` and `## Red Reproduction Tests` are concrete (actual steps/inputs, actual
  test file + test name) — never a placeholder like "can be reproduced by...".

**Both genres — no placeholders.** "TBD", "to be added", "similar to Phase 2", "appropriate error
handling" are plan failures, not acceptable shorthand — write the actual content or (workplan
genre only) leave the question open explicitly in `## Addenda` instead of papering over it.

## Step 6 — Self-review

Before validating mechanically, read the whole document fresh and check, yourself, not via a
subagent:

**Workplan genre:**

1. **Coverage** — does every `## Findings` finding map to a phase that addresses it, or an
   explicit `## Out of Scope` reason it doesn't? With `--from-design`, the same question for every
   goal of the design document.
2. **Placeholders** — scan for the patterns above yourself in addition to the mechanical check
   in Step 7 (the mechanical check only catches a fixed phrase list).
3. **Name consistency** — does a `**Delivers:**` in Phase N use the exact same name a later phase's
   `**Requires:**` expects? A mismatch here is a bug in the plan.

**Bug genre:**

1. Does every `## Evidence Chain` step actually connect to the next (no unexplained jump from one
   file/method to a completely unrelated one)?
2. Is `## Root Cause` the same claim `## Evidence Chain` arrives at, not a subtly different one?

If Step 6 finds something to fix, go back to Step 5 and `Write` the corrected document in full,
then continue — no need to re-review after a fix.

## Step 7 — Mechanical gate

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-workplan.mjs" --file <targetPath> --json
```

Exit 2 means at least one `error`-severity finding — fix and re-run until clean. `warning`
findings (e.g. a placeholder phrase the mechanical scan caught) should also be fixed, but don't
block.

## Step 8 — Summary and next step

Report in English: file path, phase count with type (`Plan`/`Implementation`), the proposed commit
cut. Then `AskUserQuestion` (`header: "Review"`): run the three-role critique now via
`/workplan:review`, or skip it? Never start the review automatically — this skill only
points at it.
