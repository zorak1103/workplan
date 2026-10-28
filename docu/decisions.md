# Decisions

A record of the decisions behind this plugin, so that work can continue on another machine
without the conversation in which they were made. Dates are 2026-10-28.

## Made by the owner

| # | Decision | Alternatives that were offered |
|---|---|---|
| D1 | `workplan` is a standalone plugin outside any company marketplace; its predecessor `bars-workplan` stays unchanged | rename `bars-workplan` in place (a breaking change for its users); a new plugin inside the same marketplace |
| D2 | The document format is fully English: headings, fields, statuses, types | English with the German names accepted as aliases; identifiers configurable per language |
| D3 | Language is fixed to English for skill text, chat output and documents | English text, answer language follows the user |
| D4 | `brainstorming` and `workplan` are connected by `create --from-design <path>` plus a hand-over rule in the user's instructions | rule only; flag only |
| D5 | Repository identity and licence are chosen by the owner: repository-local git identity, MIT licence, holder to be named | keep the existing identity; Apache-2.0; no licence |
| D6 | The package is moved to the other machine as a zip of the tracked files | git bundle; owner transports it |

## Made by the implementer, open to change

| # | Decision | Reason |
|---|---|---|
| I1 | The working name is `workplan`, the author "workplan contributors", the version 1.0.0 | placeholders until a name and an owner are fixed; see [development.md](development.md) for where the name appears |
| I2 | No converter for `bars-workplan` documents | workplans are short-lived and deleted when done; finishing old ones with the old plugin is cheaper than a converter; see [migration-from-bars-workplan.md](migration-from-bars-workplan.md) |
| I3 | The `close` skill no longer pre-approves a GitLab command, `execute` refers to "the project's own forge CLI" | the plugin is project-neutral |
| I4 | The hook matches the plugin name only as a standalone word | a plugin named like a common word would otherwise match `validate-workplan.mjs` and `.workplans/` |
| I5 | Internal design identifiers and references to specific projects, marketplaces and tickets were removed; the rules behind them stayed | they were meaningless outside the original environment |
| I6 | `--from-design` accepts a document of any shape and maps by meaning; the source document stays read-only | the plugin must not depend on one brainstorming tool or version |
| I7 | The hand-over rule is documented, not installed | it points at skills that exist only once the plugin is installed, and it changes the owner's global behaviour |
| I8 | The repository doubles as its own marketplace (`.claude-plugin/marketplace.json`, `"source": "./"`) | one repository to publish; the manifest layout validates |
| I9 | The status vocabulary stays closed: `Open`, `In progress`, `Done` | a closed vocabulary lets scripts and validator reject drift |

## Consequences worth remembering

- Documents written for `bars-workplan` are not recognised. Do not mix the two formats in one
  `.workplans/` directory.
- Everything that depends on a live Claude Code session was not exercised end to end:
  the skill steps, the hook in a real session, the install commands, `--from-design` against a real
  brainstorming document. The acceptance run in [transfer-checklist.md](transfer-checklist.md) is
  the way to close that.
