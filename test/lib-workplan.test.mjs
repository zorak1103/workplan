import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readLines,
  joinLines,
  getPhaseTable,
  getCommitTable,
  findSection,
  findSubsections,
  extractHeadings,
  parseTable,
  findTableBounds,
  buildRow,
  fieldLineRe,
} from '../scripts/lib/workplan.mjs';
import { validWorkplanText, validBugText, legacyPhaseTableWorkplanText } from './helpers/fixture.mjs';

test('readLines/joinLines round-trips the fixture byte-for-byte without any mutation', () => {
  const text = validWorkplanText();
  const roundTripped = joinLines(readLines(text));
  assert.equal(roundTripped, text);
});

test('readLines/joinLines round-trips the bug-analysis fixture byte-for-byte', () => {
  const text = validBugText();
  assert.equal(joinLines(readLines(text)), text);
});

test('getPhaseTable finds both phases with correct cells', () => {
  const lines = readLines(validWorkplanText());
  const table = getPhaseTable(lines);
  assert.ok(table);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(
    table.rows.map((r) => r.phase),
    ['0', '1'],
  );
  assert.equal(table.rows[0].status, 'Open');
  assert.equal(table.rows[0].type, 'Implementation');
  assert.equal(table.rows[0].complexity, 'S');
  assert.equal(table.rows[1].complexity, 'M');
  assert.deepEqual(table.columns, { Phase: 0, Content: 1, Type: 2, Complexity: 3, Status: 4 });
});

test('getPhaseTable reports complexity as null when the document has no Complexity column', () => {
  const lines = readLines(legacyPhaseTableWorkplanText());
  const table = getPhaseTable(lines);
  assert.ok(table);
  assert.equal(table.columns.Complexity, undefined);
  assert.equal(table.rows[0].complexity, null);
  assert.equal(table.rows[0].status, 'Open');
});

test('getCommitTable finds both commits', () => {
  const lines = readLines(validWorkplanText());
  const table = getCommitTable(lines);
  assert.ok(table);
  assert.deepEqual(
    table.rows.map((r) => r.commit),
    ['C1', 'C2'],
  );
  assert.equal(table.rows[0].hash, '—');
});

test('findSection locates Approach and findSubsections finds both phase headings', () => {
  const lines = readLines(validWorkplanText());
  const approach = findSection(lines, 'Approach');
  assert.ok(approach);
  const subsections = findSubsections(lines, approach, 3);
  assert.deepEqual(
    subsections.map((s) => s.title),
    ['Phase 0 — Create safety net (mandatory)', 'Phase 1 — Implement core change'],
  );
});

test('findSubsections does not descend into level-4 subphases', () => {
  const lines = readLines(validWorkplanText());
  const approach = findSection(lines, 'Approach');
  const subsections = findSubsections(lines, approach, 3);
  const phase1 = subsections[1];
  // The level-4 "#### 1.1 — Subphase" heading must be inside Phase 1's body/end range, not
  // picked up as a third level-3 subsection.
  assert.equal(subsections.length, 2);
  assert.ok(phase1.end > phase1.line);
});

test('extractHeadings ignores a "# comment" line inside a fenced code block', () => {
  const lines = readLines('# Workplan: X\n\n## A\n\n```bash\n# not a heading\n```\n\n## B\n');
  assert.deepEqual(
    extractHeadings(lines).map((h) => h.title),
    ['Workplan: X', 'A', 'B'],
  );
});

test('findSubsections ignores a "### x" line inside a ~~~ fence', () => {
  const lines = readLines('# Workplan: X\n\n## Approach\n\n### Phase 0\n\n~~~\n### not a phase\n~~~\n\n### Phase 1\n');
  const approach = findSection(lines, 'Approach');
  assert.deepEqual(
    findSubsections(lines, approach, 3).map((s) => s.title),
    ['Phase 0', 'Phase 1'],
  );
});

test('parseTable skips the separator row, including alignment colons', () => {
  const lines = readLines('## T\n\n| a | b |\n|:---|---:|\n| 1 | 2 |\n| 3 | 4 |\n');
  const bounds = findTableBounds(lines, 0, lines.length);
  assert.ok(bounds);
  const { header, rows } = parseTable(lines, bounds);
  assert.deepEqual(header.cells, ['a', 'b']);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1].cells, ['3', '4']);
});

test('parseTable keeps an escaped pipe inside one cell', () => {
  const lines = readLines('## T\n\n| Phase | Content | Type | Complexity | Status |\n|---|---|---|---|---|\n| 0 | uses a \\| b | Plan | S | Open |\n');
  const bounds = findTableBounds(lines, 0, lines.length);
  const { rows } = parseTable(lines, bounds);
  assert.equal(rows[0].cells.length, 5);
  assert.equal(rows[0].cells[1], 'uses a \\| b');
});

test('findTableBounds returns null for a table without outer pipes', () => {
  const lines = readLines('# Workplan: X\n\n## Phase Overview\n\nPhase | Content\n--- | ---\n0 | x\n');
  assert.equal(getPhaseTable(lines), null);
});

test('buildRow wraps cells in outer pipes', () => {
  assert.equal(buildRow(['a', 'b']), '| a | b |');
});

test('fieldLineRe matches bulleted and bare fields', () => {
  const re = fieldLineRe('Goal');
  assert.ok(re.test('- **Goal:** x'));
  assert.ok(re.test('**Goal:** x'));
  assert.ok(!re.test('*Goal:* x'));
});
