import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readLines,
  inferGenre,
  getPhaseTable,
  getCommitTable,
  findSection,
  findSubsections,
  fieldLineRe,
  REQUIRED_PHASE_FIELDS,
} from '../scripts/lib/workplan.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readTemplate(name) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, 'reference', name), 'utf8');
}

test('templates: the workplan template is genre "workplan" with the two tables readable', () => {
  const lines = readLines(readTemplate('workplan-template.md'));
  assert.equal(inferGenre(lines), 'workplan');

  const phaseTable = getPhaseTable(lines);
  assert.ok(phaseTable);
  assert.deepEqual(phaseTable.columns, { Phase: 0, Content: 1, Type: 2, Complexity: 3, Status: 4 });
  assert.equal(phaseTable.rows.length, 2);

  const commitTable = getCommitTable(lines);
  assert.ok(commitTable);
  assert.equal(commitTable.rows.length, 2);

  for (const title of ['Phase Overview', 'Commit Cut', 'Current State', 'Findings', 'Goal', 'Approach', 'Out of Scope', 'Risks', 'Verification', 'Addenda']) {
    assert.ok(findSection(lines, title), `section "${title}" not found`);
  }
});

test('templates: the bug template is genre "bug" and carries the fix-sketch anchor', () => {
  const lines = readLines(readTemplate('bug-analysis-template.md'));
  assert.equal(inferGenre(lines), 'bug');
  const section = findSection(lines, 'Fix Sketch for the Follow-up Session');
  assert.ok(section);
  assert.equal(lines[section.line - 1], '<a id="fix-sketch"></a>');
});

test('templates: each phase body lists the five fields as bullets in order', () => {
  const lines = readLines(readTemplate('workplan-template.md'));
  const approach = findSection(lines, 'Approach');
  const phase0 = findSubsections(lines, approach, 3)[0];
  assert.ok(phase0);
  const body = lines.slice(phase0.line + 1, phase0.end);
  const found = body
    .map((l) => REQUIRED_PHASE_FIELDS.find((f) => fieldLineRe(f).test(l)))
    .filter(Boolean);
  assert.deepEqual(found, ['Goal', 'Requires', 'Delivers', 'Files', 'Complexity']);
  for (const f of REQUIRED_PHASE_FIELDS) {
    assert.ok(body.some((l) => l.startsWith(`- **${f}:**`)), `field "${f}" is not a bullet`);
  }
});

test('templates: no angle-bracket placeholder was lost', () => {
  const text = readTemplate('workplan-template.md');
  assert.ok(text.includes('<Topic>'));
  assert.ok(text.includes('<S/M/L/XL>'));
});
