import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, withTempDir } from './helpers/cli.mjs';
import { validWorkplanText, validBugText } from './helpers/fixture.mjs';

test('workplan-status: reports phases and the next open phase for a single candidate', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'));
    fs.writeFileSync(path.join(dir, '.workplans', 'one.md'), validWorkplanText());
    const { status, json } = runScript('workplan-status.mjs', ['--repo-root', dir]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.phases.length, 2);
    assert.equal(json.nextOpen.phase, '0');
    assert.equal(json.nextOpen.complexity, 'S');
    assert.equal(json.nextOpen.type, 'Implementation');
    assert.equal(json.allDone, false);
  });
});

test('workplan-status: lists candidates instead of guessing when several workplans exist', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'));
    fs.writeFileSync(path.join(dir, '.workplans', 'one.md'), validWorkplanText().replace('Example refactoring', 'First refactoring'));
    fs.writeFileSync(path.join(dir, '.workplans', 'two.md'), validWorkplanText().replace('Example refactoring', 'Second refactoring'));
    const { status, json } = runScript('workplan-status.mjs', ['--repo-root', dir]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.candidates.length, 2);
    assert.equal(json.phases, undefined);
  });
});

test('workplan-status: reports allDone once every phase is Done', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'));
    const doneText = validWorkplanText().replace(/\| Open \|$/gm, '| Done |');
    fs.writeFileSync(path.join(dir, '.workplans', 'one.md'), doneText);
    const { json } = runScript('workplan-status.mjs', ['--repo-root', dir]);
    assert.equal(json.allDone, true);
    assert.equal(json.nextOpen, null);
  });
});

test('workplan-status: a bug-analysis document is not offered as a candidate', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'));
    fs.writeFileSync(path.join(dir, '.workplans', 'bug.md'), validBugText());
    const { json } = runScript('workplan-status.mjs', ['--repo-root', dir]);
    assert.deepEqual(json.candidates, []);
  });
});

test('workplan-status: a .md design document and an .adoc file in .workplans are not candidates', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'));
    fs.writeFileSync(path.join(dir, '.workplans', 'design.md'), '# Design: Something\n');
    fs.writeFileSync(path.join(dir, '.workplans', 'old.adoc'), validWorkplanText());
    fs.writeFileSync(path.join(dir, '.workplans', 'one.md'), validWorkplanText());
    const { status, json } = runScript('workplan-status.mjs', ['--repo-root', dir]);
    assert.equal(status, 0, JSON.stringify(json));
    // Exactly one candidate means the script reports on it directly.
    assert.ok(json.file.endsWith('one.md'));
    assert.equal(json.ok, true);
  });
});
