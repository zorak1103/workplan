---
name: review
description: "Critiques an existing workplan document under .workplans/ in three roles: fact-checking each finding against the real code, critiquing the phase cut (session sizing, Requires/Delivers chain), and an adversarial devil's-advocate pass. Use only when the thing being reviewed is a workplan document. Not for reviewing code, a diff, a merge request, or any other kind of document."
argument-hint: "[<workplan>]"
allowed-tools:
  - AskUserQuestion
  - Agent(workplan:workplan-fact-checker, workplan:workplan-cut-critic, workplan:workplan-devils-advocate)
  - Bash(git rev-parse --show-toplevel)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*" *)
---

# review

Entry to this skill is gated by the plugin's `PreToolUse` hook
(`scripts/check-skill-entry-confirmation.mjs`): the harness forces one explicit confirmation
before this skill starts, in every permission mode. Do **not** ask a second "shall I start?"
question here — the confirmation has already happened.

Never mutates the document — every one of the three dispatched agents is genuinely restricted to
`Read`/`Grep`/`Glob` via their own `tools:` frontmatter (that IS an enforced restriction for
subagents, unlike a skill's `allowed-tools`), and this skill does not read or write the document
itself — it only orchestrates, every actual document/code read happens inside the dispatched
agents. Findings from this review reach the document only through `/workplan:execute
--amend`, after the user has decided what to actually accept.

## Step 0 — Repo root

```
git rev-parse --show-toplevel
```

## Step 1 — Resolve the target document

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/workplan-status.mjs" --repo-root <repoRoot> [--file <path>] --json
```

If the result has `candidates` (no single document resolved), `AskUserQuestion`
(`header: "Workplan"`) to pick one.

## Step 2 — Dispatch all three roles in parallel

Single message, three `Agent` calls, all pointed at the resolved file and the repo root:

- `workplan-fact-checker` — verifies every `## Findings` finding against the real code, and
  flags any phase referencing a finding ID that doesn't exist.
- `workplan-cut-critic` — critiques session-sizing, `**Requires:**`/`**Delivers:**`
  concreteness and the dependency chain between phases, Phase 0's adequacy as a safety net,
  whether the declared `Complexity` level actually fits the phase, and whether the
  Commit Cut proposal is coherent.
- `workplan-devils-advocate` — must produce a concrete alternative approach or explicitly
  concede that this is the right approach after an active search for a better one.

Do not run them sequentially — nothing in one role's task depends on another's output, and
running them one at a time only adds wall-clock time for no benefit.

## Step 3 — Consolidate

Merge the three JSON results into one list, most severe first:

- Fact-checker `REFUTED`/`UNVERIFIABLE` verdicts and any dangling phase reference → **Blocker**.
- Fact-checker `PARTIALLY_CONFIRMED` → **Major**.
- Cut-critic `blocker`/`major`/`minor` → carry the severity through as-is.
- Devil's-advocate `alternative-proposed` → its own top-level item, not folded into
  blocker/major/minor (it's a different kind of finding — an approach question, not a defect).
  `conceded` → report as one confirming line, not a finding.

Drop nothing silently — if two findings from different roles describe the same underlying issue,
merge them into one item and say which roles raised it, rather than picking one arbitrarily.
`CONFIRMED` fact-checker verdicts are not findings — they don't appear in the consolidated list at
all, only as an implicit "checked, no issue" count in Step 4's summary.

## Step 4 — Present

In English, most severe first. For each item: which role(s) raised it, the summary, the detail,
and (for cut-critic/fact-checker items) the phase or finding ID it's about. For the
devil's-advocate verdict, always show it even when `conceded` — a documented "no better
alternative found" is itself useful evidence the plan was pressure-tested.

**Never apply anything automatically.** Close with: findings worth keeping go into the document
via `/workplan:execute --amend <workplan>` — name it explicitly so the user knows the next
step, don't just leave the findings hanging in chat.
