import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, withTempDir } from './helpers/cli.mjs';
import { validWorkplanText } from './helpers/fixture.mjs';

function allDoneText() {
  return validWorkplanText().replace(/\| Open \|$/gm, '| Done |');
}

function writeAllDoneFixture(dir) {
  fs.mkdirSync(path.join(dir, '.workplans'), { recursive: true });
  const filePath = path.join(dir, '.workplans', 'one.md');
  fs.writeFileSync(filePath, allDoneText());
  return filePath;
}

function writeOpenFixture(dir) {
  fs.mkdirSync(path.join(dir, '.workplans'), { recursive: true });
  const filePath = path.join(dir, '.workplans', 'one.md');
  fs.writeFileSync(filePath, validWorkplanText());
  return filePath;
}

test('close-workplan: the all-done fixture really has no open phase', () => {
  assert.doesNotMatch(allDoneText(), /\| Open \|$/m);
  assert.match(allDoneText(), /\| 0 \| .* \| Done \|$/m);
});

test('close-workplan: refuses to append or delete while a phase is still open', async () => {
  await withTempDir((dir) => {
    const filePath = writeOpenFixture(dir);
    const appendResult = runScript('close-workplan.mjs', ['--file', filePath, '--append-closing-sentence']);
    assert.equal(appendResult.status, 2);
    const deleteResult = runScript('close-workplan.mjs', ['--file', filePath, '--delete']);
    assert.equal(deleteResult.status, 2);
    assert.ok(fs.existsSync(filePath));
  });
});

test('close-workplan: appends the closing sentence once every phase is Done', async () => {
  await withTempDir((dir) => {
    const filePath = writeAllDoneFixture(dir);
    const { status, json } = runScript('close-workplan.mjs', ['--file', filePath, '--append-closing-sentence']);
    assert.equal(status, 0, JSON.stringify(json));
    const text = fs.readFileSync(filePath, 'utf8');
    assert.match(text, /Example refactoring is now fully completed\./);
  });
});

test('close-workplan: deletes the file once every phase is Done', async () => {
  await withTempDir((dir) => {
    const filePath = writeAllDoneFixture(dir);
    const { status, json } = runScript('close-workplan.mjs', ['--file', filePath, '--delete']);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(fs.existsSync(filePath), false);
  });
});

test('close-workplan: refuses to touch a file outside .workplans/*.md', async () => {
  await withTempDir((dir) => {
    const filePath = path.join(dir, 'one.md');
    fs.writeFileSync(filePath, allDoneText());
    const { status, json } = runScript('close-workplan.mjs', ['--file', filePath, '--delete']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
    assert.ok(fs.existsSync(filePath));
  });
});

test('close-workplan: refuses an .adoc file even inside .workplans/', async () => {
  await withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.workplans'), { recursive: true });
    const filePath = path.join(dir, '.workplans', 'one.adoc');
    fs.writeFileSync(filePath, allDoneText());
    const { status, json } = runScript('close-workplan.mjs', ['--file', filePath, '--delete']);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
    assert.ok(fs.existsSync(filePath));
  });
});
