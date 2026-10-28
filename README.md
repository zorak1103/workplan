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

## How it differs from superpowers

[`superpowers`](https://github.com/obra/superpowers) has a planning component of its own:
`brainstorming` produces a design, `writing-plans` turns it into an implementation plan, and
`executing-plans` or `subagent-driven-development` carries the plan out. The two do not compete;
they plan at different grain and for different lifetimes.

| | `superpowers:writing-plans` | `workplan` |
|---|---|---|
| Unit of work | a task with test-first steps: exact files, signatures, test code, commit step | a phase: one whole Claude Code session, described by goal, requires, delivers, files, complexity |
| Written for | an implementer who has not seen the code and builds it in one run | a fresh session that starts cold, possibly days later |
| Execution | all tasks in one go without pausing between them, inline or with a subagent per task | exactly one phase per session; `execute` stops and names the next phase |
| State across sessions | a progress ledger for that run | a status table in the document, written by script after every phase |
| Review of the plan | the plan is checked by the author; the reviews run on the finished code | `review` critiques the plan before anything is built: fact check, phase cut, devil's advocate |
| Commits | each task ends with a commit step | the commit cut is a separate, revisable proposal; the planning skills never commit |
| Where it lives | `docs/superpowers/plans/` | `.workplans/`, git-ignored, closed and deleted when done |

**Rule of thumb.** If the work fits one session, or can run start to finish while you watch,
use `writing-plans` (or just build it): a phased document is more ceremony than it is worth. If
the work spans several sessions, touches several modules, or someone should be able to challenge
the plan before any code is written, use `workplan`.

**They also combine.** `brainstorming` is the natural front end, see "Combining with a design
step" below. A phase of a workplan is session-sized, so one phase can itself be big enough to
deserve a fine-grained `writing-plans` task list; the workplan keeps the long-range state, the
superpowers plan does the minute-by-minute work inside that one session. That nesting has not
been exercised end to end yet, see `CONTRIBUTING.md` (acceptance run).

## Installation

```bash
/plugin install workplan --marketplace zorak1103/workplan
```

To try it for one session without installing: `claude --plugin-dir <path-to-this-repository>`.
All options are in `docs/installation.md`; the full documentation starts at `docs/README.md`.

## Skills

| Skill | Purpose | Arguments | Writes |
|---|---|---|---|
| `create` | Creates a new workplan or bug-analysis document, planning only (no `git commit`, no build or test run — a convention, not technically enforced) | `--genre workplan\|bug`, `--from-bug <path>`, `--from-design <path>` | The new document |
| `review` | Three-role critique: fact check of the findings, critique of the phase cut, devil's advocate | `<workplan>` | Nothing — chat output only |
| `execute` | Implements exactly one phase (or plans it in more depth) and writes status/commit hash back | `<workplan>`, `--phase <id>`, `--amend` | The phase and commit tables, `## Addenda` |
| `close` | Harvests insights, appends the closing sentence, deletes only after confirmation | `<workplan>` | The document (closing sentence), optionally memory/docs/merge request |

All four skills are model-invocable — the model can start them itself when a request matches a
description, just like via `/workplan:<name>`. When the model chooses a skill itself, the start
goes through the plugin's own `PreToolUse` hook gate (see "Permissions and hooks") and requires one explicit
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

### Example: with `superpowers:brainstorming`

[`superpowers`](https://github.com/obra/superpowers) ships a `brainstorming` skill that fits this
step well. It interviews you about intent, goals, non-goals and anti-goals, sizes the work, and
for a project writes a design document to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
(you can tell it to use another location). Nothing is built until you approve that document.
The chain then looks like this:

1. Describe your idea to Claude Code and let `brainstorming` run: it asks open questions, plays
   its understanding back, and sizes the work. If it sizes the work as a project that spans several
   sessions, it writes the design document and asks for your approval.
2. Instead of letting `brainstorming` continue with `superpowers:writing-plans` (its default next
   step), start the workplan from the approved design, for example:
   `/workplan:create --from-design docs/superpowers/specs/2026-10-28-client-migration-design.md`
3. `create` maps the design onto the workplan (see the list above), asks only what the design
   leaves open (typically the session budget and how to cut the phases), and verifies the design's
   statements about the code. A statement that does not hold becomes a finding.
4. Continue as usual: optionally `/workplan:review`, then one `/workplan:execute` per session, and
   `/workplan:close`.

`brainstorming` tells Claude to invoke `writing-plans` and no other skill after approval. Your own
instructions take precedence over skills, so state the exception once in your `CLAUDE.md`:

```markdown
After `superpowers:brainstorming` has produced an approved design document for work that spans
several sessions, continue with `/workplan:create --from-design <design document>` instead of
`superpowers:writing-plans`. Work that fits one session still goes to `superpowers:writing-plans`
or is built directly.
```

Typing the `create` command yourself also avoids the confirmation prompt the plugin's hook shows
when the model starts a skill on its own. This hand-over has not been run end to end in a live
session yet; `docs/brainstorming-integration.md` describes the friction points and
`CONTRIBUTING.md` has the acceptance run.

## Critique round (`review`)

Three agents, all pinned to `model: opus`, all read-only:

| Agent | Role |
|---|---|
| `workplan-fact-checker` | Checks every `## Findings` entry against the real code |
| `workplan-cut-critic` | Checks session size, the `Requires`/`Delivers` chain, Phase 0 as a safety net, the complexity ratings, the commit cut |
| `workplan-devils-advocate` | Must deliver a counter-proposal or concede after an active search |

Nothing from the critique round lands in the document automatically — adoptions go through
`/workplan:execute --amend`.

## Permissions and hooks

`allowed-tools` in the `SKILL.md` files pre-approves tools for a skill's turn; it is not a
restriction. "Plans, never implements" in `create` and `review` is a rule in the skill text, not
something the frontmatter enforces. `execute` is the only skill with unrestricted `Bash`, because
an implementation phase needs the target project's own tooling.

A `PreToolUse` hook (`hooks/hooks.json`) forces one confirmation before the model itself starts
one of the four skills, in every permission mode including auto. The explicit
`/workplan:<name>` slash command does not reach the hook. The hook only ever escalates to `ask`
and fails open. Hooks are loaded at session start, so a change needs a session restart.
Details: [docs/configuration-and-safety.md](docs/configuration-and-safety.md).

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
  mode (see "Permissions and hooks").

## Development

Dependency-free (no `package.json`) — runs without `npm install` via `--plugin-dir`. Tests via
Node's built-in runner:

```bash
node --test "test/**/*.test.mjs"
```

Validation: `claude plugin validate <plugin-dir> --strict`.

_Keywords: workplan, planning, phases, markdown, claude-code_
