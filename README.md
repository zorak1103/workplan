# workplan

Standardizes the workplan approach for multi-session changes: a git-ignored, phased Markdown
document under `.workplans/` that is created in one fixed way, reviewed, updated and closed —
independent of the project.

## Why

A workplan document survives across several Claude Code sessions, each of which starts with no
memory of the previous one. Without a fixed format this causes variance: different section
orders, status sometimes at the top and sometimes at the bottom, phases without a clear handover
to the next session, results that stay in the chat instead of flowing back into the document.
This plugin makes the format and the flow a convention instead of a verbal agreement.

## Installation

```bash
/plugin install workplan --marketplace zorak1103/workplan
```

To try it for one session without installing: `claude --plugin-dir <path-to-this-repository>`.
All options are in `docu/installation.md`; the full documentation starts at `docu/README.md`.

## Skills

| Skill | Purpose | Arguments | Writes |
|---|---|---|---|
| `create` | Creates a new workplan or bug-analysis document, planning only (no `git commit`, no build or test run — a convention, not technically enforced) | `--genre workplan\|bug`, `--from-bug <path>`, `--from-design <path>` | The new document |
| `review` | Three-role critique: fact check of the findings, critique of the phase cut, devil's advocate | `<workplan>` | Nothing — chat output only |
| `execute` | Implements exactly one phase (or plans it in more depth) and writes status/commit hash back | `<workplan>`, `--phase <id>`, `--amend` | The phase and commit tables, `## Addenda` |
| `close` | Harvests insights, appends the closing sentence, deletes only after confirmation | `<workplan>` | The document (closing sentence), optionally memory/docs/merge request |

All four skills are model-invocable — the model can start them itself when a request matches a
description, just like via `/workplan:<name>`. When the model chooses a skill itself, the start
goes through the plugin's own `PreToolUse` hook gate (see `## Hooks`) and requires one explicit
confirmation, in every permission mode including auto. The explicit slash command does not reach
this gate (verified: it does not trigger a `Skill` tool call) — there the intent is already given
by the deliberate input. A side effect of model invocability: all four descriptions are
permanently in the session context — that is why they are kept short and each carries an explicit
exclusion clause.

## Document format

Two genres, distinguished by the title prefix: `# Workplan: <Topic>` (phased, with a phase
overview and a commit cut) and `# Bug Analysis: <Short description>` (an investigation without
phases, ending in the `<a id="fix-sketch"></a>` anchor). Complete, binding rules:
`reference/document-conventions.md`; templates: `reference/workplan-template.md`,
`reference/bug-analysis-template.md`.

Key points:

- Stored under `.workplans/` in the repo root, `.md` extension, the directory must be
  git-ignored — `create` checks and establishes this, never unasked.
- `## Phase Overview` comes **first**, with exactly three status values: `Open`, `In progress`,
  `Done`, plus a complexity level `S`/`M`/`L`/`XL` per phase
  (`reference/complexity-rubric.md`) — a document without this column is a validation error.
- One phase corresponds to **exactly one Claude Code session**, with type `Plan` or
  `Implementation`. Subphases (`####`) run in the same session as their parent phase.
- `## Commit Cut (Proposal)` is an axis of its own — not "one phase = one commit" — and
  explicitly a proposal that may be revised during implementation.
- Every phase starts with `- **Goal:**`/`- **Requires:**`/`- **Delivers:**`/`- **Files:**`/`- **Complexity:**`
  bullets before any prose. The complexity level is a planning estimate and is not adjusted after
  implementation — deviations go into `## Addenda`, not into the table cell.

## Combining with a design step

A workplan answers *how, in what order, across how many sessions*. It works best when the *what
and why* is already settled, for example by a brainstorming session that ended in an approved
design document. `create --from-design <path>` takes such a document (any shape, no fixed
template) as its starting point:

- Goal, current state, non-goals, anti-goals and the user's decisions are carried into
  `## Goal`, `## Current State`, `## Out of Scope`, `## Risks`/`## Verification` and
  `## Target Design`; `reference/document-conventions.md` has the mapping.
- `create` does not ask again what the design already answers.
- Claims about the code in the design document count as unverified until `create` has checked
  them; a contradiction becomes a finding and is put to the user instead of being decided
  silently.
- The design document stays read-only. The workplan links back to it in its preamble; changed
  assumptions go into `## Addenda`.

The plugin does not depend on any particular design skill. A project that wants this chain
automatically adds one line to its instructions, for example: "After an approved design for
work that spans several sessions, continue with `/workplan:create --from-design <design
document>`."

## Critique round (`review`)

Three agents, all pinned to `model: opus`, all read-only:

| Agent | Role |
|---|---|
| `workplan-fact-checker` | Checks every `## Findings` entry against the real code |
| `workplan-cut-critic` | Checks session size, the `Requires`/`Delivers` chain, Phase 0 as a safety net, the complexity ratings, the commit cut |
| `workplan-devils-advocate` | Must deliver a counter-proposal or concede after an active search |

Nothing from the critique round lands in the document automatically — adoptions go through
`/workplan:execute --amend`.

## Permissions

`allowed-tools` in the `SKILL.md` files is a **turn-scoped grant**, not a session unlock and
**not a restriction** — every tool remains callable in principle, the list only determines what
is pre-approved for this skill turn without a prompt; everything else goes through the project's
normal permission flow (`.claude/settings.local.json`). That `create` and `review` list no
general `Bash`/`Edit` is therefore not a technical barrier against implementing during planning —
it is a rule these skills follow according to their own instructions ("plans, never implements"),
not one the frontmatter enforces. `execute` is the only skill that pre-approves unrestricted
`Bash`, because an implementation phase needs the target project's build/test/commit tooling,
which this plugin cannot predict.

## Hooks

A `PreToolUse` hook (`hooks/hooks.json`, matcher `Skill`, script
`scripts/check-skill-entry-confirmation.mjs`) forces a harness-side confirmation before the model
itself starts one of the four skills — in every permission mode including auto (unlike
`Edit`/`Write`, a `Skill` call has no default prompt of its own that "ask only in auto mode"
could rely on). The explicit `/workplan:<name>` slash command demonstrably does not reach this
hook — it does not trigger a `Skill` tool call but another, internal mechanism; an additional
prompt would only be friction there anyway, since the intent is already given by the explicit
input. The hook only ever escalates to `ask`, never to `deny`/`allow` — in the worst case a false
detection costs a superfluous prompt, never a blocked call.

Detection runs in two tiers: first the serialized `tool_input` is searched for the plugin name
(the documented schema of the `Skill` tool is not officially fixed, a scan is more robust than
guessing a field name); only if that finds nothing, a fallback on one of the four bare skill
names applies, which backs off immediately as soon as a *foreign* plugin name qualifies the same
name (prevents confusion with e.g. `other-plugin:review`). Fail-open on every parse error — a
hook that can crash the tool-call pipeline is worse than one that occasionally misses its gate.

> [!NOTE]
> Hooks are loaded at session start — a change to `hooks/hooks.json` or the script only
> takes effect after a session restart; a plain `/reload-plugins` is not enough.

## What the plugin does not do

- Never writes project-specific rules (test commands, commit format, sub-agent requirements for
  tests) into a workplan document — those apply according to the target project's own
  instructions (e.g. its `CLAUDE.md`) and are followed there, not duplicated (this plugin is
  project-neutral).
- Never deletes a document without explicit confirmation, even when all phases are `Done`.
- Never adopts a critique-round finding into the document automatically.
- Never creates a `.workplans/` directory or a git-ignore entry without confirmation.
- Never pushes to or comments on a merge request without an explicit request.
- Never starts one of the four skills without prior, explicit confirmation — not even in auto
  mode (see `## Hooks`).

## Development

Dependency-free (no `package.json`) — runs without `npm install` via `--plugin-dir`. Tests via
Node's built-in runner:

```bash
node --test "test/**/*.test.mjs"
```

Validation: `claude plugin validate <plugin-dir> --strict`.

_Keywords: workplan, planning, phases, markdown, claude-code_
