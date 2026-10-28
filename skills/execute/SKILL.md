---
name: execute
description: "Executes exactly one phase of an existing workplan document under .workplans/, then writes that phase's status (and, once a commit exists, its hash) back into the document before the session ends; --amend writes a finding back without touching any status. Use only when a workplan document exists and the user asks for its next or a named phase. Not for ordinary implementation work that has no workplan document."
argument-hint: "[<workplan>] [--phase <id>] [--amend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash
---

# execute

Entry to this skill is gated by the plugin's `PreToolUse` hook
(`scripts/check-skill-entry-confirmation.mjs`): the harness forces one explicit confirmation
before this skill starts, in every permission mode. Do **not** ask a second "shall I start?"
question here — the confirmation has already happened. This is the costliest of the four skills
to accidentally start: a "yes" here pre-approves a full implementation session, including
unrestricted `Bash`.

The one skill in this plugin that pre-approves unrestricted `Bash` — a phase can be an actual
implementation session (building, testing, committing against whatever the target project's own
toolchain is), which this plugin cannot enumerate in advance and does not try to. Project-specific
rules (how to run tests, the commit message format, whether tests go through a sub-agent, …)
come from the target project's own instructions (e.g. its `CLAUDE.md`) — this skill does not
repeat or override them; this plugin is project-neutral.

All chat output and all document content are English.

## `--amend` mode

If `--amend` is passed, skip straight to **Step 4**, using the resolved document from Step 1 —
no phase is read, no status is touched. This is the write-back path for findings that surface
outside a phase's own session: a `/workplan:review` result the user wants applied, a
correction discovered while working on something unrelated, a review round over the plan itself.

## Step 1 — Resolve the document and phase

```
git rev-parse --show-toplevel
```

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/workplan-status.mjs" --repo-root <repoRoot> [--file <path>] --json
```

`candidates` present → `AskUserQuestion` (`header: "Workplan"`) to pick one, then re-run with
`--file`.

With a resolved document: if `--phase <id>` was given, use that phase's row; otherwise use
`nextOpen`. If `nextOpen` is `null` and `allDone` is `true`, say so and stop — there's nothing to
execute; `/workplan:close` is the next step, not this skill. Name the phase's `complexity`
(from `workplan-status.mjs`'s output) to the user before starting — this is the point at which
they can still switch model or approach for the phase, not after work has begun.

## Step 2 — Read only what this phase needs

Read the chosen `### Phase <id> — ...` subsection (including its
`**Requires:**`/`**Delivers:**`/`**Files:**`/`**Complexity:**` fields and any `####` subphases) plus
the document's `## Current State`, `## Goal`, `## Out of Scope`, and any `## Findings` entries the
phase references by ID. **Do not read other phases** — staying scoped to one phase's context is
the entire point of cutting phases in the first place; reading ahead defeats it.

If `**Requires:**` names something that doesn't actually exist in the code as described, stop
and say so rather than guessing at what was probably meant — that's a planning defect, not
something to paper over mid-execution.

## Step 3 — Do the work

- **Type `Plan`**: this is a planning-only session. Deepen the phase's content, resolve open
  questions, write findings back into the document (Step 4) — no production code changes.
- **Type `Implementation`**: implement the phase's `**Files:**` and work steps, including any
  `####` subphases in order, all within this one session.

Verification is whatever the task calls for (tests, a build, manual confirmation) — this plugin
does not prescribe a fixed gate. If something can't be verified in this session (e.g. a manual
check in a running environment), say so explicitly in Step 4's write-back as "still pending" —
never silently drop it.

If the actual work reveals the Commit Cut proposal no longer fits (a phase needed a different
split, a commit turned out unnecessary), that's expected — proposals get revised. Update the
`## Commit Cut (Proposal)` table's row via Step 4's `--commit` option, and note the change
in `## Addenda` if it's non-obvious why.

## Step 4 — Write back (mandatory before the session ends)

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/set-phase-status.mjs" --file <path> --phase <id> --status Done [--commit <commitId> --hash <hash>] --json
```

Use `In progress` instead of `Done` if the phase is genuinely incomplete at session end (e.g.
blocked) — never mark a phase `Done` with known-outstanding work; say what's outstanding in
`## Addenda` instead.

Beyond the status flip:

- **New findings or corrections** go into `## Addenda` via `Edit` — append, don't overwrite.
- **If the phase was significantly more or less complex than its `**Complexity:**` estimate**,
  note that in `## Addenda` too — the table cell and the field stay as the original planning
  estimate, they are never rewritten after the fact (`reference/document-conventions.md`).
- **A statement that turned out wrong** gets a `> [!NOTE]` marking it superseded, immediately above
  or below the original text — the original stays legible, it's marked wrong, not deleted. This
  applies to `--amend` write-backs too (e.g. a `/workplan:review` finding that corrects an
  earlier `## Findings` entry).
- **Commit Cut changes** (see Step 3) go through `set-phase-status.mjs --commit` for the hash
  cell; if the row's *content* changed (not just its hash), edit that cell directly and say why
  in `## Addenda`.

## Step 5 — Never start a second phase

Once Step 4's write-back is done, **stop**. This skill does not chain into the next open phase
automatically — a phase is one session, and a fresh session with no leftover context is exactly
what makes the next phase's `**Requires:**` a meaningful check rather than a formality. Tell the
user the phase is done and name the next open phase (from `workplan-status.mjs`'s output) without
starting it.

## Step 6 — Optional merge request sync

Only if the user asks: read the current description of the merge/pull request for this work
(using the project's own forge CLI) and update the section mirroring this workplan's phase
table. This reaches outside the repo — never do it without being asked.
