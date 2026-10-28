# workplan — documentation

`workplan` is a Claude Code plugin for changes that take more than one session. It keeps one
git-ignored, phased Markdown document under `.workplans/` that is created, critiqued, executed
phase by phase, and closed in one fixed way, independent of the project.

Four skills carry the lifecycle:

| Skill | Does |
|---|---|
| `/workplan:create` | writes the workplan (or a bug analysis) and checks it mechanically |
| `/workplan:review` | three read-only critics: fact check, phase cut, devil's advocate |
| `/workplan:execute` | runs exactly one phase and writes status back into the document |
| `/workplan:close` | harvests what should survive, appends the closing sentence, deletes on request |

## Where to read what

| Document | Read it when |
|---|---|
| [installation.md](installation.md) | you want to try or install the plugin, or set up a repository for it |
| [workflow.md](workflow.md) | you want to know what happens in each session, step by step |
| [brainstorming-integration.md](brainstorming-integration.md) | you start from an idea and want `brainstorming` and `workplan` to hand over cleanly |
| [document-format.md](document-format.md) | you write or review a workplan by hand and need the format at a glance |
| [configuration-and-safety.md](configuration-and-safety.md) | you want to know what the plugin may do on its own, what asks first, and which project rules to add |
| [migration-from-bars-workplan.md](migration-from-bars-workplan.md) | you have documents or habits from the German predecessor `bars-workplan` |
| [troubleshooting.md](troubleshooting.md) | a script or skill refuses something and you want to know why |
| [development.md](development.md) | you change the plugin: layout, scripts, tests, renaming, open items |
| [decisions.md](decisions.md) | you want to know why it is the way it is, and which calls are still open to change |
| [transfer-checklist.md](transfer-checklist.md) | you move the package to another machine, finish it and publish it, including the acceptance run in a live session |

The authoritative format rules are in `../reference/document-conventions.md`. The plugin's own
short README is `../README.md`.

## Five-minute start

1. Load the plugin for one session: `claude --plugin-dir <plugin-dir>`
   (details and permanent options in [installation.md](installation.md)).
2. In a git repository, ask for a workplan, for example `/workplan:create`. On the first run it
   offers to create `.workplans/` and to git-ignore it.
3. Answer the clarifying questions. `create` verifies every finding in the code, cuts phases of
   one session each, writes the document and validates it.
4. Optionally run `/workplan:review`, then start a fresh session per phase with
   `/workplan:execute`.
5. When every phase is `Done`, run `/workplan:close`.

## Status of this documentation

Everything here is derived from the plugin's skills, scripts and tests. The scripts and the
validator are covered by the test suite (94 tests at the time of writing). The interaction of the
skills inside a live Claude Code session, the marketplace installation path and the hand-over
from `brainstorming` have not been exercised end to end yet. The places where this matters are
marked "not yet verified" in the individual documents.
