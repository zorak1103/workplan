# Development

## Layout

```
workplan/
  .claude-plugin/plugin.json     manifest (name, version, author)
  .claude-plugin/marketplace.json  makes this repository its own marketplace
  LICENSE, .gitignore, .gitattributes
  .claude/CLAUDE.md              contributor notes for Claude Code sessions in this repository
  hooks/hooks.json               PreToolUse hook for the Skill tool
  skills/{create,review,execute,close}/SKILL.md
  agents/workplan-{fact-checker,cut-critic,devils-advocate}.md
  scripts/                       standalone node scripts, built-in modules only
    lib/workplan.mjs             parser, writer, vocabulary constants
  reference/                     conventions, templates, complexity rubric
  test/                          node:test suites, helpers/ for fixtures and process spawning
  docu/                          this documentation
  README.md                      short plugin README
```

There is no `package.json` and nothing to install. The plugin runs straight from its directory.

## Scripts

All command line scripts take `--json` for machine output and `--help` for usage. The hook
script is the exception: it reads a payload from stdin and has no options. Paths are resolved
against the working directory.

| Script | Arguments | Exit codes |
|---|---|---|
| `ensure-workplan-dir.mjs` | `--repo-root <dir> [--create]` | 0 ok, 1 hard error, 2 precondition not met and `--create` absent |
| `new-workplan.mjs` | `--repo-root <dir> --slug <kebab-case> --genre workplan\|bug [--ticket <id>]` | 0 ok, 1 hard error, 2 target already exists |
| `validate-workplan.mjs` | `--file <path>` | 0 no errors, 1 hard error (file, unknown genre), 2 at least one error finding |
| `workplan-status.mjs` | `--repo-root <dir> [--file <path>]` | 0 ok, 1 hard error |
| `set-phase-status.mjs` | `--file <path> --phase <id> --status Open\|"In progress"\|Done [--commit <id> --hash <hash>]` | 0 ok, 1 hard error |
| `close-workplan.mjs` | `--file <path> (--append-closing-sentence \| --delete)` | 0 ok, 1 hard error, 2 not every phase is `Done` |
| `check-skill-entry-confirmation.mjs` | hook payload on stdin | 0; prints a decision only when it asks |

Notes:

- `workplan-status.mjs` without `--file` lists every workplan-genre document under `.workplans/`.
  With exactly one candidate it reports on that one.
- `set-phase-status.mjs` and `close-workplan.mjs` rewrite only the touched line or append the
  closing sentence. `close-workplan.mjs` refuses files outside `.workplans/*.md`.
- Everything the skills call goes through these scripts; the skills never edit tables by hand.

## The parser

`scripts/lib/workplan.mjs` reads the shape the templates produce and writes row changes in the
same one-line shorthand. Its central property: parsing and serialising without a change returns the
input byte for byte. All vocabulary lives in this file as constants (`STATUS_*`,
`PHASE_TYPE_VALUES`, `PHASE_COMPLEXITY_VALUES`, `REQUIRED_PHASE_FIELDS`, `PLACEHOLDER_PATTERNS`,
the title prefixes). The section titles are string literals in `validate-workplan.mjs` and in the
two table finders.

Row objects expose `phase`, `content`, `type`, `complexity`, `status` for the phase table and
`commit`, `phase`, `content`, `hash` for the commit table.

## Tests

```bash
node --test "test/**/*.test.mjs"
```

94 tests at the time of writing, covering the parser round trip, the validator's finding codes,
every script as a real child process, the hook's matching rules (qualified, path-shaped, bare,
foreign, standalone-name guards, fail-open) and structural guards for skills and agents:
frontmatter keys, the `review` agent grant, agent names, the manifest, the `--from-design` flag
and its documentation. Output is long; redirect it to a file and read the summary lines.

Plugin check:

```bash
claude plugin validate . --strict
```

When you change the format, change the fixtures in `test/helpers/fixture.mjs` first and let the
suites fail.

## Renaming the plugin

`workplan` is a working name. It appears in:

- `.claude-plugin/plugin.json` (`name`);
- `scripts/check-skill-entry-confirmation.mjs` (`PLUGIN` and the three regular expressions);
- the agent files (`name`) and their cross references;
- `skills/review/SKILL.md` (`Agent(<plugin>:<agent>, ...)` in `allowed-tools`) and every
  `/workplan:<skill>` mention in the skills, the reference files and the README;
- `test/check-skill-entry-confirmation.test.mjs` and `test/skills-frontmatter.test.mjs`;
- the `WORKPLAN_DEBUG_PAYLOAD` variable name;
- this documentation.

After renaming, run the test suite and the plugin validation. Note that a plugin named like a
common word can match more in the hook's scan; the standalone-name guard in the regular
expressions exists for that reason.

## Design decisions worth knowing

- **Why the hook scans the payload as a string.** The `Skill` tool's input schema is not
  documented. Keying on a guessed field name would silently switch the gate off the day the guess
  is wrong. A false positive costs one prompt, a false negative costs the whole gate.
- **Why `create` uses `Write` and not `Edit`.** Its self-review re-emits the whole document, so
  the plan is always consistent as a whole. This is a convention of the skill, not an enforced
  limit.
- **Why the commit cut is its own axis.** Phases are cut by session, commits by what belongs
  together in history. Tying them one to one forces bad commits or bad sessions.
- **Why the complexity is never rewritten.** The table shows what was planned. What happened goes
  into the Addenda, so the estimate can be judged afterwards.
- **Why phases name concrete identifiers.** A phase starts cold. Prose such as "the previous
  result" is useless without memory.
- **Why the plugin is dependency-free.** It must run from `--plugin-dir` or a copied directory
  without an install step.

## Open items

| Item | State |
|---|---|
| name `workplan` | working name, see "Renaming" |
| `author` in `plugin.json` | set to `zorak1103` |
| version | 1.0.0 set without a release process |
| install line in `README.md` | points to the marketplace `zorak1103/workplan`; works once the repository is published |
| marketplace and repository | the repository contains `.claude-plugin/marketplace.json` (manifest validated in a scratch copy, install not run); the GitHub repository is `zorak1103/workplan`, see [transfer-checklist.md](transfer-checklist.md) |
| licence | `LICENSE` is the MIT text, holder `zorak1103` |
| slash invocation vs. hook | `looksLikeExplicitUserInvocation` always returns false; whether an explicit slash command is distinguishable in the payload is unverified, the cost of the open question is one redundant prompt |
| live run of the skills | not exercised end to end in a Claude Code session since the translation |
| `--from-design` against a real brainstorming document | not exercised |
| README install paths B and C | not verified |
| conversion of `bars-workplan` documents | no converter, see [migration-from-bars-workplan.md](migration-from-bars-workplan.md) |
| the `TODO` placeholder pattern | flags the word anywhere, including plans about TODO tracking |
