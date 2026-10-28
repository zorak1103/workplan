# Phase complexity rubric

`create` estimates every phase's complexity as one of `S`/`M`/`L`/`XL`, written into the
Phase Overview table's `Complexity` column and repeated as the `**Complexity:**` field in that
phase's `## Approach` subsection (`reference/document-conventions.md`). The estimate names what
drives the effort -- it never names a model or an effort setting. Deciding which model and how
much scaffolding (plan mode, subagents, review) a given level warrants is a decision for whoever
executes the phase, made with current model capabilities in mind -- baking that choice into the
document would make it stale the moment models change.

## The four drivers

Every estimate weighs these together; none of them alone determines the level.

- **Scope** -- how many files/modules does `**Files:**` actually list, and how mechanical is the
  change to each?
- **Uncertainty** -- is the solution already fully known, or does execution require exploring
  and deciding along the way?
- **Blast radius** -- how many other things (callers, later phases, other services) depend on
  what this phase changes?
- **Verification effort** -- do existing tests cover this, or does the phase need new tests or
  manual verification to trust the result?

## The four levels

- **S** -- one file, or a mechanical change across a few files (rename, constant, one obvious
  fix). Solution fully known before starting. No consumers affected. Existing tests cover it.
- **M** -- a handful of files inside one module. The approach is clear; some details still need
  working out while implementing. Verified by existing tests, or a small addition to them.
- **L** -- multiple modules or layers. At least one real open design question remains. New tests
  are needed. Later phases (or other code) depend on this phase's outcome.
- **XL** -- scope can only be determined by exploring first; unknowns dominate the estimate. This
  is a **splitting signal**, not a level to build a session plan around -- see
  `agents/workplan-cut-critic.md`. A phase estimated `XL` should normally be cut into smaller
  phases before execution rather than attempted as-is.

## Writing the justification

The `**Complexity:**` field's justification names which of the four drivers pushed the estimate up
or down -- concretely, not "laborious" or "complex" without saying why. Examples:

```
- **Complexity:** L — 4 tables, a schema migration across 3 environments, rollback path still unclear.
- **Complexity:** S — rename one method, IDE refactoring covers all callers.
- **Complexity:** M — two files in one module, approach clear, tests already exist.
```

## What this rubric is not

- Not a numeric score -- an enumerated label suffices, and inventing numbers would suggest a
  precision the estimate does not have.
- Not a model recommendation -- no level maps to a fixed model or effort setting anywhere in this
  plugin.
- Not self-correcting after execution -- if a phase turns out more (or less) complex than
  estimated, that goes into `## Addenda` via `execute --amend`; the table cell stays the
  original planning estimate (`reference/document-conventions.md`).
