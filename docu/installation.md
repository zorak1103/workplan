# Installation

## Prerequisites

| Requirement | Why | Checked with |
|---|---|---|
| Claude Code with plugin support | hosts the skills, agents and the hook | developed against 2.1.312 |
| Node.js | every script is a standalone `node` script, built-in modules only, no `npm install` | developed with 24.16; the scripts need nothing newer than Node 16; the quoted glob in `node --test "test/**/*.test.mjs"` needs Node 21 or later |
| git | `ensure-workplan-dir.mjs` runs `git check-ignore`; skills call `git rev-parse` | any recent version |

A workplan is stored per repository, so the plugin is only useful inside a git repository.

## Option A: load for one session (verified flag)

```bash
claude --plugin-dir <plugin-dir>
```

`<plugin-dir>` is the directory that holds `.claude-plugin/plugin.json`, for example the folder you
unpacked or cloned. `--plugin-dir` loads the plugin for this session only, nothing is installed or written to your
configuration. Use it to try the plugin and to work on it. Start Claude Code this way every time
until you install it permanently.

## Option B: this repository as its own marketplace (manifest validated, install not run)

The repository contains `.claude-plugin/marketplace.json` next to `plugin.json`. It lists the
plugin with `"source": "./"`, so the repository is plugin and marketplace at once. The manifest
layout passed `claude plugin validate` in a scratch copy; the commands below were not run against a
real configuration.

```bash
claude plugin marketplace add <path-or-git-url-of-this-repository>
claude plugin install workplan@workplan-marketplace
```

`marketplace add` writes to your Claude Code configuration (scope `user` by default; `--scope
project` or `--scope local` narrow it). For a team, push the repository to your git server and
give colleagues the URL. Replace the marketplace and plugin descriptions and the `owner` in
`marketplace.json` first, and fix the `<owner>/<repo>` install line the validator asks for in the
README once the URL is known.

## Option C: a separate marketplace that holds the plugin (not yet verified end to end)

Use this when the plugin should live next to other plugins in an existing marketplace. A local
marketplace is a directory with a `.claude-plugin/marketplace.json` and the plugin below it. The
structure mirrors the existing marketplaces in `~/.claude/plugins/marketplaces`.

```
my-plugins/
  .claude-plugin/marketplace.json
  plugins/workplan/              <- copy of <plugin-dir> (without .git)
```

`marketplace.json`:

```json
{
  "name": "my-plugins",
  "owner": { "name": "<your name or team>" },
  "plugins": [
    { "name": "workplan", "source": "./plugins/workplan" }
  ]
}
```

Then:

```bash
claude plugin validate my-plugins --strict
claude plugin marketplace add C:\path\to\my-plugins
claude plugin install workplan@my-plugins
```

`marketplace add` writes to your Claude Code configuration (scope `user` by default; `--scope
project` or `--scope local` narrow it). If the marketplace is a git repository on a server
instead, `marketplace add` accepts the repository URL, and `claude plugin install workplan
--marketplace <owner>/<repo>` is the one-step form the validator mentions for GitHub
repositories.

Update and removal:

```bash
claude plugin update workplan
claude plugin uninstall workplan
claude plugin list
```

## Option D: skills directory (not verified)

`claude plugin init <name>` scaffolds plugins at `~/.claude/skills/<name>/`, and the CLI treats
such plugins as `<name>@skills-dir`. Copying this plugin there may load it without a marketplace.
Whether the hook in `hooks/hooks.json` is honoured for a plugin loaded this way has not been
checked; if you try it, confirm with `/hooks` that the `PreToolUse` entry for `Skill` is present.

## Verify the installation

1. `claude plugin validate <plugin-dir> --strict` reports `Validation passed`. It
   currently adds one advisory: the README has no marketplace install line. That is expected until
   the plugin has a marketplace.
2. From the plugin directory, run the test suite and expect all tests green:

   ```bash
   node --test "test/**/*.test.mjs"
   ```
3. Start a session with the plugin and check that `/workplan:create`, `/workplan:review`,
   `/workplan:execute` and `/workplan:close` are offered.
4. Check the hook: ask Claude to "create a workplan for X" in a way that makes the model choose the
   skill itself. You must get one confirmation prompt before the skill starts. Typing
   `/workplan:create` yourself does not go through the hook; the explicit command is your
   confirmation.

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

## Running next to bars-workplan

The plugins have different names (`workplan` and `bars-workplan`), so both can be installed.
Their skills are addressed as `workplan:create` and `bars-workplan:create` and do not collide,
and neither hook reacts to the other's skills. Both skill sets, however, keep their descriptions
in the session context permanently, and a request for "a workplan" could match either. Disable
the one you do not want for the current work, see
[migration-from-bars-workplan.md](migration-from-bars-workplan.md).
