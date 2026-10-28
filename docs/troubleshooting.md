# Troubleshooting

## Validator findings

`node scripts/validate-workplan.mjs --file <path>` prints `[severity] code (line N): message`.
Errors give exit code 2 and must be fixed. Warnings should be fixed but do not block. Exit code 1
means a hard error such as a missing file or an unknown genre.

| Code | Severity | Meaning and fix |
|---|---|---|
| `wrong-extension` | error | the file is not `.md`; rename it |
| `wrong-directory` | error | the file is not under `.workplans/`; move it |
| `missing-section` | error | a required `##` section is missing; see the order in [document-conventions.md](../reference/document-conventions.md) |
| `section-order` | error | required sections are in the wrong order |
| `missing-phase-table` | error | no readable pipe table under `## Phase Overview` (a table without outer pipes counts as unreadable) |
| `empty-phase-table` | error | the table has a header but no phase rows |
| `missing-complexity-column` | error | the Phase Overview has no `Complexity` column |
| `duplicate-phase-id` | error | two rows have the same phase ID |
| `invalid-status` | error | status is not `Open`, `In progress` or `Done` (this includes the German `Offen`, `In Arbeit`, `Erledigt`) |
| `invalid-type` | error | type is not `Plan` or `Implementation` |
| `invalid-complexity` | error | complexity is not `S`, `M`, `L` or `XL`; an unfilled `<S/M/L/XL>` from the template causes this |
| `complexity-xl` | warning | the phase is `XL`; split it into several sessions |
| `phase-without-section` | error | a table row has no `### Phase <id> — ...` under `## Approach` |
| `section-without-phase` | error | a phase section has no row in the table |
| `missing-phase-field` | error | one of `**Goal:**`, `**Requires:**`, `**Delivers:**`, `**Files:**`, `**Complexity:**` is missing |
| `complexity-mismatch` | error | the field and the table cell differ, or the field is not `<level> — <justification>` |
| `missing-commit-table` | error | no readable pipe table under `## Commit Cut` |
| `duplicate-commit-id` | error | two commit rows have the same ID |
| `duplicate-finding-id` | error | two findings have the same ID |
| `finding-id-format` | warning | a finding heading has no ID before the em dash |
| `placeholder` | warning | text like `TBD` or "similar to phase 2" is left in the document |
| `missing-anchor` | error | a bug analysis lacks `<a id="fix-sketch"></a>` before the fix sketch section |

The em dash in `### Phase 1 — Title` and `### C1 — Title` matters. A plain hyphen is accepted for
phase headings, but findings need the em dash `—` after the ID.

A freshly copied template fails with `invalid-complexity`. That is expected; the templates keep
angle-bracket placeholders on purpose.

## Old `.adoc` workplans

Workplans written as `.workplans/*.adoc` before the switch to Markdown are no longer read, listed or
migrated. `validate-workplan.mjs` reports `wrong-extension` for them and `close-workplan.mjs`
refuses them. To continue such a plan, copy its content into a new `.md` workplan via `create`.

## Situations

| Situation | Cause | What to do |
|---|---|---|
| `create` says `.workplans/` is missing or not ignored | first use in this repository, or the exclude entry is not there | confirm the "Setup" question, or create it by hand, see [installation.md](installation.md) |
| `new-workplan.mjs` exits with 2 | the target file already exists; it never overwrites | choose a different slug |
| `execute` says there is nothing to execute | every phase is `Done` | run `/workplan:close` |
| `execute` stops because `Requires` names something that does not exist | planning defect | fix the plan with `/workplan:execute --amend`, do not guess |
| `workplan-status.mjs` returns a list of candidates | several workplans exist and no `--file` was given | pick one; the skills ask with a "Workplan" question |
| a bug analysis is not offered as a workplan | by design, `workplan-status.mjs` lists only workplans | use `create --from-bug <path>` to turn it into one |
| `set-phase-status.mjs` rejects `Erledigt` or `Fertig` | the vocabulary is closed and English | use `Open`, `In progress` or `Done` |
| `close-workplan.mjs` exits with 2 | at least one phase is not `Done` | finish the phases with `execute` first |
| the validator refuses a document with "Unknown genre" | the title does not start with `# Workplan:` or `# Bug Analysis:` | fix the first line; see the genres in [document-conventions.md](../reference/document-conventions.md) |
| a status change does not find the row | the table was reformatted (multi-line rows, extra tables) | keep one row per line and one table per section |
| the skills do not show up | the plugin is not loaded | start with `--plugin-dir`, or check `claude plugin list` |
| a confirmation appears before a skill starts | the entry hook, because the model chose the skill | expected; type the slash command yourself to skip it |
| no confirmation appears for a model-chosen skill | the hook was not loaded, or the input schema changed | restart the session; capture a payload with `WORKPLAN_DEBUG_PAYLOAD=1` and compare with `test/check-skill-entry-confirmation.test.mjs` |
| a change to the hook has no effect | hooks are read at session start | restart the session |
| tests fail with an unknown option or glob error | Node older than 21 does not expand the glob | use Node 21 or later, or pass the test files explicitly |

## Getting a payload for the hook

```bash
set WORKPLAN_DEBUG_PAYLOAD=1        # cmd.exe; use export on bash
claude --plugin-dir <plugin-dir>
```

Each payload the hook sees is appended to `~/.claude/tmp/logs/skill-payload.json`. Remove the
variable afterwards.
