import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, withTempDir } from './helpers/cli.mjs';
import { validWorkplanText, legacyPhaseTableWorkplanText } from './helpers/fixture.mjs';

function writeFixture(dir) {
  const filePath = path.join(dir, 'one.md');
  fs.writeFileSync(filePath, validWorkplanText());
  return filePath;
}

test('set-phase-status: flips a phase status and only that line changes', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const before = fs.readFileSync(filePath, 'utf8');
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'In progress']);
    assert.equal(status, 0, JSON.stringify(json));
    const after = fs.readFileSync(filePath, 'utf8');
    assert.notEqual(after, before);
    assert.match(after, /\| 0 \| Create safety net \(mandatory\) \| Implementation \| S \| In progress/);
    // Phase 1's row is untouched.
    assert.match(after, /\| 1 \| Implement core change \| Implementation \| M \| Open/);
    // Exactly one line differs.
    const changed = after.split('\n').filter((line, idx) => line !== before.split('\n')[idx]);
    assert.equal(changed.length, 1);
  });
});

test('set-phase-status: is idempotent -- setting the same status twice yields the same file', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Done']);
    const once = fs.readFileSync(filePath, 'utf8');
    runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Done']);
    const twice = fs.readFileSync(filePath, 'utf8');
    assert.equal(once, twice);
  });
});

test('set-phase-status: --commit also fills in the commit hash', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const { status } = runScript('set-phase-status.mjs', [
      '--file',
      filePath,
      '--phase',
      '0',
      '--status',
      'Done',
      '--commit',
      'C1',
      '--hash',
      'abc1234',
    ]);
    assert.equal(status, 0);
    const after = fs.readFileSync(filePath, 'utf8');
    assert.match(after, /\| C1 \| 0 \| Safety net \| abc1234/);
    // The other commit row is untouched.
    assert.match(after, /\| C2 \| 1 \| Core change \| —/);
  });
});

test('set-phase-status: rejects --commit without --hash', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Done', '--commit', 'C1']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
  });
});

test('set-phase-status: rejects an unknown phase id', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '99', '--status', 'Done']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
  });
});

test('set-phase-status: rejects a status outside the closed vocabulary', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Finished']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
  });
});

test('set-phase-status: rejects a status from the previous German vocabulary', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    const before = fs.readFileSync(filePath, 'utf8');
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Erledigt']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  });
});

test('set-phase-status: a status change on a 5-column document leaves the Complexity cell untouched', async () => {
  await withTempDir((dir) => {
    const filePath = writeFixture(dir);
    runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '1', '--status', 'Done']);
    const after = fs.readFileSync(filePath, 'utf8');
    assert.match(after, /\| 1 \| Implement core change \| Implementation \| M \| Done/);
  });
});

test('set-phase-status: a legacy 4-column document is rewritten correctly and stays 4-column', async () => {
  await withTempDir((dir) => {
    const filePath = path.join(dir, 'legacy.md');
    fs.writeFileSync(filePath, legacyPhaseTableWorkplanText());
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'In progress']);
    assert.equal(status, 0, JSON.stringify(json));
    const after = fs.readFileSync(filePath, 'utf8');
    assert.match(after, /\| 0 \| Create safety net \(mandatory\) \| Implementation \| In progress/);
    assert.match(after, /\| 1 \| Implement core change \| Implementation \| Open/);
    // No stray extra cell was introduced -- the row still has exactly four pipe-delimited cells.
    const row0 = after.split('\n').find((l) => l.startsWith('| 0 |'));
    assert.equal(row0.split('|').length - 1, 5);
  });
});

test('set-phase-status: a row with an escaped pipe in a cell survives a status change', async () => {
  await withTempDir((dir) => {
    const filePath = path.join(dir, 'one.md');
    fs.writeFileSync(filePath, validWorkplanText().replace('Create safety net (mandatory)', 'Create a \\| b net'));
    const { status, json } = runScript('set-phase-status.mjs', ['--file', filePath, '--phase', '0', '--status', 'Done']);
    assert.equal(status, 0, JSON.stringify(json));
    const after = fs.readFileSync(filePath, 'utf8');
    assert.ok(after.split('\n').includes('| 0 | Create a \\| b net | Implementation | S | Done |'), after);
  });
});
