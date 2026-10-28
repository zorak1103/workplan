# Configuration and safety

## What the plugin may do on its own

| Skill | Pre-approved tools (`allowed-tools`) | Notes |
|---|---|---|
| `create` | `Read`, `Write`, `Glob`, `Grep`, `AskUserQuestion`, `git rev-parse --show-toplevel`, the plugin's own scripts | no `Edit`, no general `Bash`; plans only |
| `review` | `AskUserQuestion`, the three critic agents, `git rev-parse --show-toplevel`, the plugin's own scripts | does not read or write the document itself |
| `execute` | `Read`, `Write`, `Edit`, `Glob`, `Grep`, `AskUserQuestion`, unrestricted `Bash` | the only skill with unrestricted `Bash`: a phase can be real implementation work |
| `close` | `Read`, `Write`, `Edit`, `Glob`, `Grep`, `AskUserQuestion`, `git rev-parse --show-toplevel`, the plugin's own scripts | the only skill that deletes a file |

`allowed-tools` is a grant for the skill's turn, not a restriction. A tool that is not listed is
not blocked; it falls back to the normal permission flow of your project. "Plans, never
implements" in `create` and `review` is therefore a rule in the skill text, not something the
frontmatter enforces. The three critic agents are different: their `tools: Read, Grep, Glob`
frontmatter is an enforced restriction for subagents.

## The entry confirmation hook

`hooks/hooks.json` registers a `PreToolUse` hook for the `Skill` tool, implemented in
`scripts/check-skill-entry-confirmation.mjs`.

- When the model itself decides to start one of the four skills, the hook forces one explicit
  confirmation. This applies in every permission mode including auto, because a `Skill` call has no
  default prompt of its own.
- Typing `/workplan:create` yourself does not reach the hook, so there is no second prompt.
- The hook only ever escalates to `ask`. It never allows and never denies, so a false match costs
  one extra prompt and never blocks a call.
- It scans the serialised tool input for the plugin name instead of a named field, because the
  `Skill` tool's input schema is not documented. The plugin name must stand alone: `workplan` as
  part of `validate-workplan.mjs` or `.workplans/` does not count.
- A skill with the same bare name from another plugin, for example `other-plugin:review`, is not
  matched.
- It fails open: on any problem reading the payload it does nothing.

Hooks are read at session start. A change needs a restart of the session.

Debug aid: with `WORKPLAN_DEBUG_PAYLOAD=1` in the environment the hook appends every payload it
sees to `~/.claude/tmp/logs/skill-payload.json`. Use it to capture the real `Skill` input shape,
for example to make the hook recognise explicit slash invocations. Do not leave it on.

## What the plugin never does

- It never writes project-specific rules (test commands, commit format, branch names) into a
  workplan; those come from the project's own instructions.
- It never deletes a document without explicit confirmation, even when every phase is `Done`.
- It never adopts a review finding into the document by itself.
- It never creates `.workplans/` or an ignore entry without confirmation, and it never touches a
  tracked `.gitignore`.
- It never pushes, and it never comments on or edits a merge request unless you ask.
- It never starts a second phase after one `execute` session, and it never creates tickets.
- It never starts one of its skills without a confirmation, including in auto mode, when the
  model chose the skill.

Nothing in the plugin sends data anywhere. The scripts are local `node` processes that read and
write files under `.workplans/` and run `git check-ignore`.

## Agent settings

The three critics are pinned in their frontmatter to `model: opus`, `effort: high`,
`maxTurns: 25`, tools `Read, Grep, Glob`. Change these in `agents/*.md` if you want a cheaper or
different model for the critique.

## Project rules worth adding to your instructions

These belong in your project's `CLAUDE.md` or equivalent, because `execute` follows them and the
workplan deliberately does not repeat them:

```markdown
## Workplans
- Workplans live in `.workplans/` and are git-ignored. One phase is one session.
- How to run the tests: <command>. Redirect long output to a file and read only the summary.
- Commit message format: <format>. Branches: <pattern>.
- Documents of this repository are written in <language>.
```

For the hand-over from brainstorming see [brainstorming-integration.md](brainstorming-integration.md).

## Language

All skill text, agent text, reference files, chat output of the skills and the content of
generated documents are English. The plugin has no setting for another language. A different
language means changing the vocabulary in `scripts/lib/workplan.mjs` and the validator and
rewriting the text files; see [development.md](development.md).
