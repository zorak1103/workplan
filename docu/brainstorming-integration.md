# Working together with brainstorming

This document describes how `superpowers:brainstorming` (read in version 7.0.0) and `workplan`
fit together. The plugin itself does not depend on `brainstorming`: `create --from-design` takes
any approved design or spec document. The hand-over described here has not been exercised in a
live session yet.

## Division of labour

| | brainstorming | workplan |
|---|---|---|
| Question it answers | what should be built, and why | how, in which order, across how many sessions |
| Style | open questions, one per message, play-back every 200 to 300 words | clarifying questions only for what the phase cut needs; findings verified in code |
| Result | a design document (intent, goals, non-goals, anti-goals, constraints, decisions, what is left to the builder) | a phased workplan with findings, phases, commit cut, risks, verification |
| Granularity | no files, no phases | per phase: goal, requires, delivers, files, complexity |
| Review | a builder check by a fresh subagent: is the document understandable? | `review`: are the findings true, does the cut hold, is there a better approach? |
| Gate | nothing is built until the design is approved | `create` plans only, `execute` does one phase |
| Where it lives | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, committed (the user can override) | `.workplans/`, git-ignored |

Brainstorming ends by sizing the work: a quick task is just done, a small change is built from
the chat description, and a project gets a written design and then a plan. `workplan` takes over
for the last case when that project spans several sessions.

## The flow

```
idea
  │
  ▼
brainstorming ──► approved design document
  │
  ├─ fits one session ──────────────► build directly or write a short plan
  │
  └─ spans several sessions ────────► /workplan:create --from-design <design>
                                         │
                                         ▼
                                      /workplan:review   (optional)
                                         ▼
                                      /workplan:execute  (one phase per session)
                                         ▼
                                      /workplan:close
```

## What `create --from-design` does with the document

| Design document | Workplan |
|---|---|
| intent, the why, success criterion | `## Goal` |
| current state, prior work, constraints | `## Current State` |
| non-goals | `## Out of Scope` |
| anti-goals (a failure even if it technically works) | `## Risks` and `## Verification` |
| decisions the user made | `## Target Design`, as decided |
| parts left to the builder | resolved by the findings and the phase cut |

Rules:

- Only what the design leaves open is asked. Intent, goals and constraints are not asked again.
- Statements about the code in the design are unverified claims until the findings step has
  checked them. A contradiction becomes a finding and is put to you; neither side wins silently.
- Calls that the design marks as the author's own, not yours, stay marked that way in
  `## Target Design`.
- The workplan's preamble links back to the design. The design stays read-only. When
  assumptions change during execution they are recorded in `## Addenda`; the design is not
  updated, so the two can drift apart. If the design matters beyond the workplan, update it
  yourself when you close.
- `--from-design` together with `--from-bug` or `--genre bug` is contradictory; `create` asks
  which one you mean.
- The seed document can have any shape. The mapping is by meaning, not by heading.

## Points of friction and how to resolve them

| Friction | Why | Resolution |
|---|---|---|
| The brainstorming skill says to invoke `superpowers:writing-plans` and no other skill after approval | its hard gate names its own successor | user instructions take precedence over skills, so state the exception once in your instructions (below) |
| Different question style | brainstorming asks open questions without option lists; a personal rule may require structured questions for every question | `create` follows your rule (it uses `AskUserQuestion`); for the brainstorming phase decide deliberately, the skill's open questions produce better answers for vague ideas |
| Two homes for documents | design in `docs/superpowers/specs/`, workplan in `.workplans/` | if your repository does not want design documents under `docs/`, tell brainstorming to write them to `.workplans/` instead; the skill allows the user to override the location |
| Second confirmation | the hook asks before a model-chosen skill starts, although you just approved the design | type `/workplan:create --from-design <path>` yourself; the explicit command is not gated |
| Design and workplan drift | the design is read-only for the plugin | treat the design as the intent at approval time and the workplan as the living plan |

## Recommended setup

Put these lines into your global or project instructions. They are not installed automatically.

Hand-over rule:

```markdown
# Planning handoff

After `superpowers:brainstorming` has produced an approved design document for work that will
span several sessions, continue with `/workplan:create --from-design <design document>`
instead of `superpowers:writing-plans`. This overrides the brainstorming skill's instruction
to invoke no other skill; the user's instructions take precedence over skills.

Work that fits one session still goes to `superpowers:writing-plans` or is built directly.
```

Location of design documents, for repositories that keep `docs/` for something else:

```markdown
Design documents from brainstorming go to `.workplans/<topic>-design.md`, not to `docs/`.
```

A design document in `.workplans/` is git-ignored like the workplan itself. It is skipped by the
status listing and the series scan because its first line is not a workplan title
(`# Workplan:` or `# Bug Analysis:`); the validator is never run on it.

## Worked example

1. You say you want to replace a hand-written client with a generated one. Brainstorming asks what
   made you want this, which behaviour must not change, and what would be a failure even if it
   works. It plays back the intent twice and writes a design: goal, non-goals, one anti-goal
   ("any change to wire format"), your decision to keep a thin gateway, and "sequence of the
   migration" left to the builder. You approve it.
2. Brainstorming sizes the work as a project that spans several sessions. Your hand-over rule
   applies, so Claude proposes `/workplan:create --from-design .workplans/client-design.md`; you
   confirm.
3. `create` reads the design, asks only about the session budget, and checks the design's
   statements about the current client in the code. One statement is wrong: the client has a
   second caller. That becomes finding `C2` and shapes Phase 2. The anti-goal turns into a
   verification step in every phase that touches the wire format.
4. `review` runs; the cut critic splits an `XL` migration phase in two. You apply the change with
   `execute --amend`.
5. Execution runs phase by phase in fresh sessions. `close` harvests the convention that was
   missing from the project documentation.

## When to skip a step

- Skip brainstorming when the goal is already fixed in writing. Hand that text to
  `create --from-design` directly, or answer `create`'s questions.
- Skip the workplan when brainstorming sizes the work as small. Building it in one session is
  cheaper than the ceremony of a phased document.
- Skip `review` for short plans of two or three phases. Run it for anything where a wrong finding
  would cost a session.
