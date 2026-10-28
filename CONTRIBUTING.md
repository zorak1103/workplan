# Contributing

For people who change the plugin. How to use it is in [README.md](README.md) and under
[docs/](docs/README.md); Claude Code sessions in this repository also read the short version in
`.claude/CLAUDE.md`.

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
  docs/                          user documentation
  CONTRIBUTING.md                this file
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

`scripts/lib/workplan.mjs` is a purpose-built reader and writer, not a general Markdown parser. It
expects the shape the templates produce: a `# Title` line, a preamble, flat `##`/`###`/`####`
headings, and pipe tables with outer pipes written one row per line. Headings and tables inside
fenced code blocks (``` or ~~~) are ignored; an unclosed fence hides everything after it. A table
without outer pipes counts as missing, and an escaped pipe (`\|`) stays inside its cell. Keep that
shape when editing by hand, otherwise the status scripts may not find the rows.

Its central property: parsing and serialising without a change returns the input byte for byte.
Row changes rewrite only the touched line. All vocabulary lives in this file as constants
(`STATUS_*`, `PHASE_TYPE_VALUES`, `PHASE_COMPLEXITY_VALUES`, `REQUIRED_PHASE_FIELDS`,
`PLACEHOLDER_PATTERNS`, the title prefixes). The section titles are string literals in
`validate-workplan.mjs` and in the two table finders.

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

The name `workplan` appears in:

- `.claude-plugin/plugin.json` (`name`);
- `scripts/check-skill-entry-confirmation.mjs` (`PLUGIN` and the three regular expressions);
- the agent files (`name`) and their cross references;
- `skills/review/SKILL.md` (`Agent(<plugin>:<agent>, ...)` in `allowed-tools`) and every
  `/workplan:<skill>` mention in the skills, the reference files and the README;
- `test/check-skill-entry-confirmation.test.mjs` and `test/skills-frontmatter.test.mjs`;
- the `WORKPLAN_DEBUG_PAYLOAD` variable name;
- this file and the documentation under `docs/`.

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

## Releasing

The repository is its own marketplace, so a release is a push to `main`. Users only see an update
when `version` in `.claude-plugin/plugin.json` changes (set it there and not in
`marketplace.json`; `claude plugin validate` warns if both carry one).

1. Run the suite and `claude plugin validate . --strict`.
2. Bump `version` in `.claude-plugin/plugin.json` (semver).
3. Commit and push.
4. Optional: `claude plugin tag --push` creates and pushes the tag `workplan--v<version>`.
   GitHub Releases are not needed.
5. Users run `claude plugin update workplan@workplan-marketplace`.

After a change to the skills or the hook, do the [acceptance run](#acceptance-run).

## Known limitations

| Item | State |
|---|---|
| slash invocation vs. hook | `looksLikeExplicitUserInvocation` always returns false; whether an explicit slash command is distinguishable in the payload is unverified, the cost of the open question is one redundant prompt |
| live run of the skills | not exercised end to end in a Claude Code session, see [Acceptance run](#acceptance-run) |
| `--from-design` against a real brainstorming document | not exercised |
| `set-phase-status.mjs` with an unescaped `|` in a code span | splits the cell; the row is not checked against the header's cell count |
| CRLF files | rewritten to LF on every status change |
| the `TODO` placeholder pattern | flags the word anywhere, including plans about TODO tracking |

## Acceptance run

The scripts and the validator are covered by the test suite. What the tests cannot cover is the
behaviour inside a live Claude Code session: the skill steps, the entry hook, the install commands
and the hand-over from `brainstorming`. This run closes that gap. Do it after a release-worthy
change to the skills or the hook, and mark each line only after you saw the result.

Use a scratch git repository so nothing real is touched:

```bash
claude plugin install workplan@workplan-marketplace     # or: claude --plugin-dir <plugin-dir>
mkdir scratch && cd scratch && git init
claude
```

| # | Do | Expect |
|---|---|---|
| 1 | check the skill list | `/workplan:create`, `review`, `execute`, `close` are offered |
| 2 | `/workplan:create` for a small invented task | a "Setup" question; after confirming, `.workplans/` exists and `.git/info/exclude` contains `/.workplans/` |
| 3 | answer the questions | a document under `.workplans/`, validated by `validate-workplan.mjs` without errors, summary in English |
| 4 | `/workplan:review` | three critics run in parallel; one consolidated list; nothing written to the document |
| 5 | `/workplan:execute --amend` with one accepted finding | the finding appears in `## Addenda`, no status changed |
| 6 | `/workplan:execute` on a `Plan` phase | the phase's complexity is named first; only that phase is read; status becomes `Done`; the skill stops and names the next phase |
| 7 | say "create a workplan for X" without the slash command | one confirmation prompt appears before the skill starts (the entry hook) |
| 8 | try `set-phase-status.mjs --status Erledigt` | refused, nothing changed |
| 9 | finish all phases, then `/workplan:close` | harvest questions one at a time, closing sentence appended, delete only after your explicit yes |
| 10 | run a short `brainstorming` session to an approved design, then `/workplan:create --from-design <design>` | no repeated questions about goals; the design's claims about the code are checked; the preamble names the design; the design file is unchanged |

If step 7 shows no prompt, capture a payload as described in
[docs/troubleshooting.md](docs/troubleshooting.md) and compare it with the hook tests.

If step 10 works, add the hand-over rule from
[docs/brainstorming-integration.md](docs/brainstorming-integration.md) to your instructions.
