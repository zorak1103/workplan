#!/usr/bin/env node
// Structural gate for a workplan document: required sections in order, the Phase Overview
// table matches the `## Approach` phase subsections one-to-one, every phase has its five
// required fields (including a Complexity level that must agree with its table cell), status
// values are from the closed vocabulary, finding IDs are unique, and no placeholder phrase
// survived into a document that's supposed to be ready for execution.
//
// This is deliberately narrow to the two genres this plugin manages (see
// reference/document-conventions.md) -- a document with an unrecognized title prefix is refused
// rather than guessed at, so a document written to a different convention reports "unknown
// genre" instead of a wall of false-positive findings.
//
// Usage:
//   node validate-workplan.mjs --file <path> --json
//
// Exit codes: 0 = no error-level findings, 2 = at least one error-level finding, 1 = hard error
// (file not found, unrecognized genre).

import fs from 'node:fs';
import path from 'node:path';
import {
  readLines,
  inferGenre,
  fieldLineRe,
  findSection,
  findSubsections,
  getPhaseTable,
  getCommitTable,
  PHASE_STATUS_VALUES,
  PHASE_TYPE_VALUES,
  PHASE_COMPLEXITY_VALUES,
  REQUIRED_PHASE_FIELDS,
  PLACEHOLDER_PATTERNS,
  WORKPLAN_TITLE_PREFIX,
  BUG_TITLE_PREFIX,
} from './lib/workplan.mjs';

const WORKPLAN_SECTION_ORDER = [
  'Phase Overview',
  'Commit Cut',
  'Current State',
  'Findings',
  'Goal',
  'Approach',
  'Out of Scope',
  'Risks',
  'Verification',
];

const BUG_SECTION_ORDER = [
  'Symptom',
  'Root Cause',
  'Evidence Chain',
  'Reproduction',
  'Red Reproduction Tests',
  'Fix Sketch for the Follow-up Session',
];

function parseArgs(argv) {
  const args = { file: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log('Usage: node validate-workplan.mjs --file <path> [--json]');
      process.exit(0);
    }
  }
  return args;
}

function fail(message, args) {
  if (args.json) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(message);
  process.exit(1);
}

function error(findings, code, message, line) {
  findings.push({ severity: 'error', code, message, ...(line != null ? { line: line + 1 } : {}) });
}

function warning(findings, code, message, line) {
  findings.push({ severity: 'warning', code, message, ...(line != null ? { line: line + 1 } : {}) });
}

/** Checks that each title in `order` has a matching level-2 heading, and that the ones found
 *  appear in the same relative order they're listed in (optional sections may be interleaved). */
function checkSectionOrder(lines, order, findings) {
  let lastLine = -1;
  let lastTitle = null;
  for (const title of order) {
    const section = findSection(lines, title);
    if (!section) {
      error(findings, 'missing-section', `Required section missing: "## ${title}"`);
      continue;
    }
    if (section.line <= lastLine) {
      error(
        findings,
        'section-order',
        `Section "## ${title}" comes before "## ${lastTitle}" -- expected order violated.`,
        section.line,
      );
    }
    lastLine = section.line;
    lastTitle = title;
  }
}

function checkPlaceholders(lines, findings) {
  lines.forEach((line, idx) => {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(line)) {
        warning(findings, 'placeholder', `Possible placeholder text: "${line.trim()}"`, idx);
      }
    }
  });
}

/** `### Phase <id> — ...` -> id, e.g. "Phase 0 — Safety net..." -> "0". */
function extractPhaseId(subsectionTitle) {
  const m = /^Phase\s+([^\s—-]+)\s*[—-]/.exec(subsectionTitle);
  return m ? m[1] : null;
}

/** Extract the level token from a `**Complexity:** <level> — <justification>` field line. Returns
 *  undefined when the field is present but not in the expected shape. */
const COMPLEXITY_FIELD_RE = /^(?:[-*]\s+)?\*\*Complexity:\*\*\s*(\S+)\s*—\s*\S/;
function extractComplexityLevel(bodyLines) {
  for (const l of bodyLines) {
    const m = COMPLEXITY_FIELD_RE.exec(l.trim());
    if (m) return m[1];
  }
  return undefined;
}

function checkPhaseRow(row, findings, seenPhaseIds) {
  if (seenPhaseIds.has(row.phase)) {
    error(findings, 'duplicate-phase-id', `Phase ID used more than once: "${row.phase}"`, row.line);
  }
  seenPhaseIds.add(row.phase);
  if (!PHASE_STATUS_VALUES.includes(row.status)) {
    error(
      findings,
      'invalid-status',
      `Invalid status "${row.status}" for phase ${row.phase} -- allowed: ${PHASE_STATUS_VALUES.join(', ')}.`,
      row.line,
    );
  }
  if (!PHASE_TYPE_VALUES.includes(row.type)) {
    error(
      findings,
      'invalid-type',
      `Invalid type "${row.type}" for phase ${row.phase} -- allowed: ${PHASE_TYPE_VALUES.join(', ')}.`,
      row.line,
    );
  }
  if (row.complexity == null) return;
  if (!PHASE_COMPLEXITY_VALUES.includes(row.complexity)) {
    error(
      findings,
      'invalid-complexity',
      `Invalid complexity "${row.complexity}" for phase ${row.phase} -- allowed: ${PHASE_COMPLEXITY_VALUES.join(', ')}.`,
      row.line,
    );
  } else if (row.complexity === 'XL') {
    warning(
      findings,
      'complexity-xl',
      `Phase ${row.phase} is rated XL -- candidate for splitting (one phase = one session).`,
      row.line,
    );
  }
}

function checkPhaseSubsection(lines, s, row, findings) {
  const bodyLines = lines.slice(s.line + 1, s.end);
  for (const field of REQUIRED_PHASE_FIELDS) {
    const hasField = bodyLines.some((l) => fieldLineRe(field).test(l.trim()));
    if (!hasField) {
      error(findings, 'missing-phase-field', `"### ${s.title}" is missing the required field "**${field}:**".`, s.line);
    }
  }
  if (row?.complexity == null) return;
  const fieldLevel = extractComplexityLevel(bodyLines);
  if (fieldLevel !== row.complexity) {
    error(
      findings,
      'complexity-mismatch',
      fieldLevel === undefined
        ? `"### ${s.title}": the "**Complexity:**" field does not match the format "<level> — <justification>".`
        : `"### ${s.title}": complexity in the field ("${fieldLevel}") differs from the Phase Overview ("${row.complexity}").`,
      s.line,
    );
  }
}

function checkPhases(lines, findings) {
  const phaseTable = getPhaseTable(lines);
  if (!phaseTable) {
    error(findings, 'missing-phase-table', 'Phase Overview table not found or not readable.');
    return;
  }
  if (phaseTable.rows.length === 0) {
    error(findings, 'empty-phase-table', 'Phase Overview table has no phase rows.');
  }
  if (phaseTable.columns.Complexity == null) {
    error(
      findings,
      'missing-complexity-column',
      'Phase Overview table has no "Complexity" column (see reference/complexity-rubric.md).',
    );
  }

  const seenPhaseIds = new Set();
  for (const row of phaseTable.rows) checkPhaseRow(row, findings, seenPhaseIds);

  const approach = findSection(lines, 'Approach');
  if (!approach) return; // already reported as missing-section
  const phaseSubsections = findSubsections(lines, approach, 3)
    .map((s) => ({ ...s, phaseId: extractPhaseId(s.title) }))
    .filter((s) => s.phaseId !== null);

  const rowsByPhaseId = new Map(phaseTable.rows.map((r) => [r.phase, r]));
  const subsectionIds = new Set(phaseSubsections.map((s) => s.phaseId));
  for (const row of phaseTable.rows) {
    if (!subsectionIds.has(row.phase)) {
      error(
        findings,
        'phase-without-section',
        `Phase ${row.phase} is in the overview but has no "### Phase ${row.phase} — ..." section in "## Approach".`,
        row.line,
      );
    }
  }
  for (const s of phaseSubsections) {
    if (!seenPhaseIds.has(s.phaseId)) {
      error(findings, 'section-without-phase', `"### ${s.title}" has no matching row in the Phase Overview.`, s.line);
    }
    checkPhaseSubsection(lines, s, rowsByPhaseId.get(s.phaseId), findings);
  }
}

function checkCommitTable(lines, findings) {
  const commitTable = getCommitTable(lines);
  if (!commitTable) {
    error(findings, 'missing-commit-table', 'Commit Cut table not found or not readable.');
    return;
  }
  const seenCommitIds = new Set();
  for (const row of commitTable.rows) {
    if (seenCommitIds.has(row.commit)) {
      error(findings, 'duplicate-commit-id', `Commit ID used more than once: "${row.commit}"`, row.line);
    }
    seenCommitIds.add(row.commit);
  }
}

function checkFindingIds(lines, findings) {
  const findingsSection = findSection(lines, 'Findings');
  if (!findingsSection) return; // already reported as missing-section
  const subsections = findSubsections(lines, findingsSection, 3);
  const seen = new Set();
  const ID_RE = /^([A-Za-z][A-Za-z0-9]*)\s*—/;
  for (const s of subsections) {
    const m = ID_RE.exec(s.title);
    if (!m) {
      warning(findings, 'finding-id-format', `Finding heading without a recognizable ID: "### ${s.title}"`, s.line);
      continue;
    }
    const id = m[1];
    if (seen.has(id)) {
      error(findings, 'duplicate-finding-id', `Finding ID used more than once: "${id}"`, s.line);
    }
    seen.add(id);
  }
}

function checkBugGenre(lines, findings) {
  checkSectionOrder(lines, BUG_SECTION_ORDER, findings);
  const raw = lines.join('\n');
  if (!raw.includes('<a id="fix-sketch"></a>')) {
    error(findings, 'missing-anchor', 'Anchor "<a id=\"fix-sketch\"></a>" is missing before the fix sketch section.');
  }
}

function checkWorkplanGenre(lines, findings) {
  checkSectionOrder(lines, WORKPLAN_SECTION_ORDER, findings);
  checkPhases(lines, findings);
  checkCommitTable(lines, findings);
  checkFindingIds(lines, findings);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) fail('--file is required.', args);

  const fileAbs = path.resolve(args.file);
  if (!fs.existsSync(fileAbs)) fail(`File not found: ${fileAbs}`, args);

  const findings = [];
  const fileAbsPosix = fileAbs.split(path.sep).join('/');

  if (!fileAbsPosix.endsWith('.md')) {
    error(findings, 'wrong-extension', `Expected ".md": ${fileAbsPosix}`);
  }
  if (!fileAbsPosix.includes('/.workplans/')) {
    error(findings, 'wrong-directory', `File is not under ".workplans/": ${fileAbsPosix}`);
  }

  const text = fs.readFileSync(fileAbs, 'utf8');
  const lines = readLines(text);
  const genre = inferGenre(lines);

  if (!genre) {
    // The hard failure discards `findings`, so repeat the extension rule here: an old
    // workplan must hear that the format is .md, not only that its title is unknown.
    const extensionHint = fileAbsPosix.endsWith('.md') ? '' : ` Also: Expected ".md": ${fileAbsPosix}`;
    fail(
      `Unknown genre -- the title must start with "# ${WORKPLAN_TITLE_PREFIX}" or "# ${BUG_TITLE_PREFIX}". First line: "${lines[0] ?? ''}".${extensionHint}`,
      args,
    );
    return;
  }

  if (genre === 'workplan') checkWorkplanGenre(lines, findings);
  else checkBugGenre(lines, findings);
  checkPlaceholders(lines, findings);

  const hasError = findings.some((f) => f.severity === 'error');
  const result = { ok: !hasError, genre, findings };
  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(`Genre: ${genre}`);
    if (findings.length === 0) console.log('No findings.');
    for (const f of findings) {
      console.log(`[${f.severity}] ${f.code}${f.line != null ? ` (line ${f.line})` : ''}: ${f.message}`);
    }
  }
  process.exit(hasError ? 2 : 0);
}

main();
