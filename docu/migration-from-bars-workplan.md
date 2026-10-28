# Migration from bars-workplan

`workplan` is a generalisation of the German plugin `bars-workplan` (version 0.3.0). The skills,
steps and discipline are the same. What changed is the language, the removal of project-specific
references, and the vocabulary of the document format, which the scripts now parse in English.

## Do you need to migrate?

Usually not. Workplans are short-lived: they are deleted when the work is done. The simplest
route is:

1. Finish every workplan that is already in progress with `bars-workplan`.
2. Start new work with `workplan`.

Documents written for `bars-workplan` are not recognised by the new scripts. The validator
refuses a title that does not start with `# Workplan:` or `# Bug Analysis:`, and the status
scripts do not find the German table headers.

## Using both

Both plugins can be installed. Their skills are addressed as `bars-workplan:<skill>` and
`workplan:<skill>`, and each plugin's hook ignores the other's skills. Both sets of skill
descriptions stay in the session context while enabled, and a request such as "make me a workplan"
could match either one. While you finish old documents, disable `workplan`, and the other way
round afterwards:

```bash
claude plugin disable workplan
claude plugin enable workplan
```

## Vocabulary

| Concept | `bars-workplan` (German) | `workplan` (English) |
|---|---|---|
| plugin / commands | `bars-workplan`, `/bars-workplan:<skill>` | `workplan`, `/workplan:<skill>` |
| agents | `bars-workplan-fact-checker`, `-cut-critic`, `-devils-advocate` | `workplan-fact-checker`, `workplan-cut-critic`, `workplan-devils-advocate` |
| workplan title | `= Workplan: <Thema>` | `# Workplan: <Topic>` |
| bug title | `= Bug-Analyse: <Kurzbeschreibung>` | `# Bug Analysis: <Short description>` |
| table of contents title | `Inhaltsverzeichnis` | none (Markdown has no table of contents attribute) |
| section | `== Phasenübersicht` | `## Phase Overview` |
| section | `== Commit-Schnitt (Vorschlag)` | `## Commit Cut (Proposal)` |
| section | `== Ausgangslage` | `## Current State` |
| section | `== Befunde` | `## Findings` |
| section | `== Ziel` | `## Goal` |
| section | `== Zielkonzept` | `## Target Design` |
| section | `== Vorgehen` | `## Approach` |
| section | `== Abgrenzung` | `## Out of Scope` |
| section | `== Risiken` | `## Risks` |
| section | `== Verifikation` | `## Verification` |
| section | `== Nachträge` | `## Addenda` |
| phase table columns | `Phase \| Inhalt \| Typ \| Komplexität \| Status` | `Phase \| Content \| Type \| Complexity \| Status` |
| commit table columns | `Commit \| Phase \| Inhalt \| Hash` | `Commit \| Phase \| Content \| Hash` |
| risk table columns | `Risiko \| Ausprägung \| Maßnahme` | `Risk \| Severity \| Mitigation` |
| status | `Offen`, `In Arbeit`, `Erledigt` | `Open`, `In progress`, `Done` |
| type | `Plan`, `Umsetzung` | `Plan`, `Implementation` |
| phase fields | `*Ziel:*`, `*Voraussetzt:*`, `*Liefert:*`, `*Dateien:*`, `*Komplexität:*` | `- **Goal:**`, `- **Requires:**`, `- **Delivers:**`, `- **Files:**`, `- **Complexity:**` |
| file actions | `(neu)`, `(ändern)` | `(new)`, `(modify)` |
| complexity drivers | Umfang, Unsicherheit, Blast-Radius, Verifikationsaufwand | scope, uncertainty, blast radius, verification effort |
| bug sections | `Beweiskette (Aufrufkette)`, `Reproduktion`, `Rote Reproduktions-Tests`, `Fix-Skizze für die Folge-Session` | `Evidence Chain (Call Chain)`, `Reproduction`, `Red Reproduction Tests`, `Fix Sketch for the Follow-up Session` |
| bug anchor | `[[fix-skizze]]` | `<a id="fix-sketch"></a>` |
| closing sentence | "<Thema> damit vollständig abgeschlossen." | "<topic> is now fully completed." |
| debug variable | `BARS_WORKPLAN_DEBUG_PAYLOAD` | `WORKPLAN_DEBUG_PAYLOAD` |
| script output | German | English; JSON keys `content`, `type`, `complexity` instead of `inhalt`, `typ`, `komplexitaet` |

## Differences beyond language

- `create` has the new `--from-design <path>` option; see
  [brainstorming-integration.md](brainstorming-integration.md).
- The `close` skill no longer pre-approves a GitLab command; merge request texts are composed and
  shown, and applying them needs your confirmation and the project's own tooling.
- `execute` step 6 refers to "the project's own forge CLI" instead of a specific command.
- All references to internal design documents, historical documents of a specific project and
  other plugins of a specific marketplace are gone.
- The hook matches the plugin name only as a standalone word.

## If you really want to convert a document

No converter is provided. The conversion is a token replacement along the table above, in the
title, the section headings, the table headers and cells, the phase fields and the status values,
plus the syntax change: `bars-workplan` documents are written in the old markup, `workplan`
documents are Markdown with pipe tables (see [document-format.md](document-format.md)).
Make the replacements by hand, or with your editor's search and replace, then run
`validate-workplan.mjs` on the result; it lists every heading, field or value it still does not
recognise. Do not run a blanket text replacement over prose: words like "Ziel" or "Vorgehen" can
occur in the content, and the document is only meant to be edited at the structure points above.
