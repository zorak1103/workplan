# Installation

## Prerequisites

| Requirement | Why | Checked with |
|---|---|---|
| Claude Code with plugin support | hosts the skills, agents and the hook | developed against 2.1.312 |
| Node.js | every script is a standalone `node` script, built-in modules only, no `npm install` | developed with 24; the scripts need nothing newer than Node 16; the quoted glob in `node --test "test/**/*.test.mjs"` needs Node 21 or later |
| git | `ensure-workplan-dir.mjs` runs `git check-ignore`; skills call `git rev-parse` | any recent version |

A workplan is stored per repository, so the plugin is only useful inside a git repository.

## Install from GitHub

The repository is its own marketplace (`.claude-plugin/marketplace.json`, plugin source `./`):

```bash
claude plugin marketplace add zorak1103/workplan
claude plugin install workplan@workplan-marketplace
claude plugin list
```

`marketplace add` writes to your Claude Code configuration (scope `user` by default; `--scope
project` or `--scope local` narrow it). Plugins and hooks are read at session start, so start a
new session or run `/reload-plugins` afterwards.

Update and removal:

```bash
claude plugin update workplan@workplan-marketplace
claude plugin uninstall workplan
```

Auto-update is off by default for third-party marketplaces. A new version is only offered when
`version` in `.claude-plugin/plugin.json` changes, see [CONTRIBUTING.md](../CONTRIBUTING.md#releasing).

## Try it for one session without installing

```bash
claude --plugin-dir <plugin-dir>
```

`<plugin-dir>` is the directory that holds `.claude-plugin/plugin.json`, for example a clone of
this repository. `--plugin-dir` loads the plugin for this session only; nothing is installed or
written to your configuration. Use it to try the plugin and to work on it.

## Verify the installation

1. `/workplan:create`, `/workplan:review`, `/workplan:execute` and `/workplan:close` are offered.
2. Check the hook: ask Claude to "create a workplan for X" in a way that makes the model choose the
   skill itself. You must get one confirmation prompt before the skill starts. Typing
   `/workplan:create` yourself does not go through the hook; the explicit command is your
   confirmation.
3. From a clone of the repository, `node --test "test/**/*.test.mjs"` and
   `claude plugin validate . --strict` pass.

Hooks are read at session start. After changing `hooks/hooks.json` or the hook script, restart
the session; `/reload-plugins` alone is not enough.

## Prepare a repository

Nothing needs to be installed per repository. The first `/workplan:create` in a repository checks
two things:

1. `.workplans/` exists.
2. `git check-ignore` confirms that it is ignored.

If either is missing, `create` tells you and asks (header "Setup") before changing anything. On
your confirmation it creates the directory and appends `/.workplans/` to `.git/info/exclude`. The
local exclude file is preferred over `.gitignore` because workplans are personal working notes,
not project history, and the entry is then not part of any commit. The plugin never edits a
tracked `.gitignore`.

To do it by hand:

```bash
mkdir .workplans
echo /.workplans/ >> .git/info/exclude
```

## Project rules that belong in the repository

The plugin is project-neutral and does not carry rules such as test commands, commit message
format or branch naming. `execute` follows the project's own instructions (for example its
`CLAUDE.md`). Put those rules there, not into a workplan. See
[configuration-and-safety.md](configuration-and-safety.md) for the lines worth adding.
