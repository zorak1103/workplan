---
name: close
description: "Closes an existing workplan document under .workplans/ whose phases are all Done: harvests what should survive it (memory entry, documentation change, merge request description, follow-up ticket) with one confirmation each, appends the closing sentence, and deletes the document only after explicit confirmation. Use only for a workplan document. Not for closing an issue, a merge request, a branch, or a session."
argument-hint: "[<workplan>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git rev-parse --show-toplevel)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*" *)
---

# close

Entry to this skill is gated by the plugin's `PreToolUse` hook
(`scripts/check-skill-entry-confirmation.mjs`): the harness forces one explicit confirmation
before this skill starts, in every permission mode. Do **not** ask a second "shall I start?"
question here — the confirmation has already happened. This is the only skill in this plugin that
deletes a file, so treat the hook's confirmation as meaningful, not a formality to click through.

All chat output and all document content are English.

## Step 0 — Repo root

```
git rev-parse --show-toplevel
```

## Step 1 — All phases done?

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/workplan-status.mjs" --repo-root <repoRoot> [--file <path>] --json
```

`candidates` present → `AskUserQuestion` (`header: "Workplan"`) to pick one. Once resolved: if
`allDone` is `false`, list the still-open phases and stop — closing is not this skill's job to
force through; the user runs `/workplan:execute` on the remaining phases first.

## Step 2 — Harvest (mandatory, one item at a time)

The document is about to disappear (pending Step 4's confirmation) — anything worth keeping has
to move somewhere durable now, or it's gone. Read the whole document once, then propose
candidates for each of these, and only these:

- **Memory entry** — a fact, convention, or gotcha discovered during execution that isn't
  already written down anywhere else and would help a future session. Ask the user which file
  (or follow the project's own memory convention if one is evident, e.g. an existing `MEMORY.md`
  index) before writing — this plugin doesn't hardcode a destination since it's project-neutral.
- **Documentation change** — a project convention the workplan's findings revealed was
  missing, wrong, or unclear in the project's own documentation. Same rule: ask which file before
  editing it.
- **Merge request description** — if a merge/pull request exists for this work and doesn't
  already reflect the final phase table, compose the updated section and show it to the user.
  Applying it reaches outside the repo (the project's own forge CLI or web UI), so it needs its
  own confirmation like every other harvest item, and this skill does not pre-approve any forge
  CLI.
- **Follow-up ticket** — work explicitly named in `## Out of Scope` as out of scope but real.
  Creating tickets is deliberately not pre-approved and this skill must not do it — "harvesting"
  a follow-up ticket means drafting its title and description for the user to file themselves,
  not creating it here.

For each candidate: `AskUserQuestion` (`header` matching the category, e.g. `"Memory"`,
`"Docs"`, `"MR"`, `"Follow-up"`) proposing the specific content, not just "should we keep
something?". **Nothing is written anywhere without its own confirmation** — a "yes, harvest
something" in general is not consent for any specific piece of content. Skip a category
entirely if the document genuinely has nothing for it; don't manufacture a candidate to have
something to ask.

## Step 3 — Closing sentence

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/close-workplan.mjs" --file <path> --append-closing-sentence --json
```

This appends "<topic> is now fully completed." and refuses (exit 2) if any phase isn't `Done` —
the same check `close-workplan.mjs` applies to both this call and Step 4's `--delete`, not just
deletion. If it fires here (the document changed between Step 1 and now), re-run Step 1, tell
the user which phases are open, and stop — don't try to force the append through.

## Step 4 — Delete, only on explicit confirmation

`AskUserQuestion` (`header: "Delete"`): delete the document now, or keep it on disk? Keeping it
is a completely valid answer — this plugin's convention is "delete after completion", not "delete
automatically"; a user may want the document around a while longer even once every phase is
`Done`. Only on explicit confirmation to delete:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/close-workplan.mjs" --file <path> --delete --json
```

This refuses (exit 2) if any phase isn't `Done` — a second, independent check beyond Step 1,
in case the document changed between steps.

## Step 5 — Summary

Report in English: what was harvested (and where each piece went), whether the document was
deleted or kept, and its path either way.
