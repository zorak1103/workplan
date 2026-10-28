# workplan — contributor notes

A Claude Code plugin (skills `create`/`review`/`execute`/`close`, three critic agents, one
`PreToolUse` hook) that manages phased Markdown workplans under `.workplans/`. Start with
`README.md`, then `docs/README.md`; `CONTRIBUTING.md` has the layout, script arguments and
exit codes.

## Commands

```bash
node --test "test/**/*.test.mjs"     # whole suite, needs Node 21+ for the quoted glob; output is long, read the summary
node --test test/lib-workplan.test.mjs   # one suite
claude plugin validate . --strict     # manifest, skills, agents, hook
jq empty .claude-plugin/plugin.json hooks/hooks.json
```

## Rules

- No `package.json`, no npm dependencies, built-in Node modules only. The plugin must run from
  `--plugin-dir` without an install step.
- The document format is Markdown only (`.workplans/*.md`). Do not reintroduce the previous
  format's syntax or file extension; the leftover-guard test in `test/` fails the build if it
  creeps back.
- Format changes start in `test/helpers/fixture.mjs` and the tests: change the fixtures first, let
  the suites fail, then change `scripts/lib/workplan.mjs` and the validator.
- `scripts/lib/workplan.mjs` is a purpose-built reader/writer, not a general Markdown parser.
  Parse followed by write-back without a mutation must reproduce the file byte for byte.
- Vocabulary is closed and English: `Open`/`In progress`/`Done`, `Plan`/`Implementation`,
  `S`/`M`/`L`/`XL`. Validator finding codes and script exit codes and JSON shapes are a contract
  with the skills; do not change them casually.
- Skills never edit tables by hand; they call the scripts in `scripts/`.
- All text (skills, agents, docs, chat output, generated documents) is English.
- Project-specific rules (test commands, commit format) never go into the skills or templates;
  the plugin is project-neutral.
- Renaming the plugin touches many places; the list is in `CONTRIBUTING.md` ("Renaming the plugin").

## Docs

Keep `docs/` and `reference/` in step with behaviour changes. When the test count changes,
`docs/README.md` and `CONTRIBUTING.md` quote it.
