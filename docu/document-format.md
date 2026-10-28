# Document format at a glance

This is a cheat sheet. The binding rules are in `../reference/document-conventions.md`, the
templates in `../reference/workplan-template.md` and `../reference/bug-analysis-template.md`,
the complexity levels in `../reference/complexity-rubric.md`. `validate-workplan.mjs` enforces
the mechanical parts.

## Storage

- Directory `<repo-root>/.workplans/`, git-ignored.
- Extension `.md`.
- File name: a kebab-case slug of the subject, `<slug>.md`, optionally ticket-prefixed,
  for example `PROJ-1234-<slug>.md`.
- The title prefix decides the genre: `# Workplan: <Topic>` or `# Bug Analysis: <Short
  description>`. Any other title is out of scope and refused by the validator. A `.md` file in
  `.workplans/` with another title (for example a design document) is skipped by the status
  listing and the series scan.

## Workplan sections, in this order

| # | Section | Required | Content |
|---|---|---|---|
| 1 | `## Phase Overview` | yes | status table, first content section |
| 2 | `## Commit Cut (Proposal)` | yes | commit table plus a `> [!NOTE]` that it is a proposal |
| 3 | `## Current State` | yes | state before this workplan and why it is needed |
| 4 | `## Findings` | yes | `### <ID> — <Short title>` per finding, verified in code |
| 5 | `## Goal` | yes | state after full implementation, one or two sentences |
| 6 | `## Target Design` | no | rough design: modules, interfaces, data flow |
| 7 | `## Approach` | yes | `### Phase <n> — <Title>` per phase, `#### <n>.<m> — <Title>` subphases |
| 8 | `## Out of Scope` | yes | what is explicitly not part of this workplan |
| 9 | `## Risks` | yes | table `Risk \| Severity \| Mitigation` |
| 10 | `## Verification` | yes | how each phase is checked before it counts as `Done` |
| 11 | `## Addenda` | no | write-back target for findings outside a running phase |

## Tables

Tables are pipe tables: a header row, a separator row, then one data row per line. Every row
starts and ends with `|`; an escaped pipe (`\|`) stays inside its cell.

Phase Overview:

```markdown
| Phase | Content | Type | Complexity | Status |
|---|---|---|---|---|
| 0 | Create safety net (mandatory) | Implementation | S | Open |
```

Commit Cut:

```markdown
| Commit | Phase | Content | Hash |
|---|---|---|---|
| C1 | 0 | Safety net | — |
```

The Phase cell of a commit may be a single phase (`1`) or a range (`1-2`). The hash stays `—`
until the commit exists.

## Closed vocabularies

| Field | Allowed values |
|---|---|
| Status | `Open`, `In progress`, `Done` |
| Type | `Plan` (planning only, no production code), `Implementation` |
| Complexity | `S`, `M`, `L`, `XL` (an `XL` is a signal to split) |
| Risk severity | free text, the template suggests `low`, `medium`, `high` |
| File action in `Files` | `(new)`, `(modify)` |

## Phase body

Every `### Phase <n> — <Title>` starts with these five fields as bullets (so they render on
separate lines), in this order, before any prose. The validator also accepts a field without the
leading `- `.

```markdown
- **Goal:** <one sentence>
- **Requires:** <concrete names or signatures from earlier phases, or "none">
- **Delivers:** <concrete names or signatures that later phases can rely on>
- **Files:** `<file>` (new), `<file>` (modify)
- **Complexity:** <S|M|L|XL> — <justification naming scope, uncertainty, blast radius or verification effort>
```

The complexity in the field must equal the cell in the Phase Overview. It is a planning estimate
and is not rewritten afterwards; deviations go into `## Addenda`.

## Finding IDs

Each `### <ID> — <Short title>` under `## Findings` has a short, stable, alphanumeric ID
(`C1`, `H2`, `P1`, ...), unique in the document. Phases refer to findings by ID.

## No placeholders

A finished document contains none of: `TBD`, `TODO`, "to be added", "to be defined", "to be
filled in", "add later", "similar to phase N", "analogous to phase N", "same as phase N",
"appropriate error handling", "details to follow". The validator reports them as warnings. The
templates under `reference/` contain angle-bracket placeholders on purpose, so a copied template
fails validation until it is filled in.

## Bug analysis sections, in this order

1. `## Symptom`
2. `## Root Cause`
3. `## Evidence Chain (Call Chain)`
4. `## Reproduction`
5. `## Red Reproduction Tests`
6. an anchor line `<a id="fix-sketch"></a>`, then `## Fix Sketch for the Follow-up Session (not part of this session)`

No tables, no phases, no status.

## What the parser accepts

`scripts/lib/workplan.mjs` is a purpose-built reader and writer, not a general Markdown parser. It
expects the shape the templates produce: a `# Title` line, a preamble, flat `##`/`###`/`####`
headings, and tables with outer pipes written one row per line. Headings inside fenced code
blocks (``` or ~~~) are ignored. Keep that shape when editing by hand, otherwise the status
scripts may not find the rows: a table without outer pipes is reported as missing. Parsing and
writing back without a change reproduces the file byte for byte, which the tests verify.
