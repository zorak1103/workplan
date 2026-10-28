import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript, withTempDir } from './helpers/cli.mjs';

function initGitRepo(dir) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
}

test('ensure-workplan-dir: reports missing dir/ignore without --create', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    const { status, json } = runScript('ensure-workplan-dir.mjs', ['--repo-root', dir]);
    assert.equal(status, 2);
    assert.equal(json.ok, false);
    assert.equal(json.exists, false);
    assert.equal(json.ignored, false);
  });
});

test('ensure-workplan-dir: --create establishes the dir and the ignore entry', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    const { status, json } = runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.ok(fs.existsSync(path.join(dir, '.workplans')));
    const exclude = fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8');
    assert.match(exclude, /^\/\.workplans\/$/m);
  });
});

test('ensure-workplan-dir: --create is idempotent, no duplicate ignore entries', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    const { status, json } = runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    assert.equal(status, 0);
    assert.equal(json.created, false);
    assert.equal(json.ignoreEntryAdded, false);
    const exclude = fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8');
    const occurrences = exclude.split(/\r?\n/).filter((l) => l.trim() === '/.workplans/').length;
    assert.equal(occurrences, 1);
  });
});

test('new-workplan: resolves a fresh target path with no collision', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    const { status, json } = runScript('new-workplan.mjs', ['--repo-root', dir, '--slug', 'example-refactoring', '--genre', 'workplan']);
    assert.equal(status, 0, JSON.stringify(json));
    assert.ok(json.targetPath.endsWith('.workplans/example-refactoring.md'));
    assert.equal(json.templatePath, 'reference/workplan-template.md');
    assert.deepEqual(json.existingSeries, []);
  });
});

test('new-workplan: refuses to overwrite an existing document', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    fs.writeFileSync(path.join(dir, '.workplans', 'example-refactoring.md'), 'x');
    const { status, json } = runScript('new-workplan.mjs', ['--repo-root', dir, '--slug', 'example-refactoring', '--genre', 'workplan']);
    assert.equal(status, 2);
    assert.equal(json.ok, false);
  });
});

test('new-workplan: finds an existing document mentioning the same ticket', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    fs.writeFileSync(
      path.join(dir, '.workplans', 'TEST-1-first-part.md'),
      '# Workplan: First part\n\nThis document is **Workplan 1** under ticket **TEST-1**.\n',
    );
    const { json } = runScript('new-workplan.mjs', ['--repo-root', dir, '--slug', 'second-part', '--genre', 'workplan', '--ticket', 'TEST-1']);
    assert.equal(json.existingSeries.length, 1);
    assert.ok(json.existingSeries[0].endsWith('TEST-1-first-part.md'));
  });
});

test('new-workplan: the ticket scan skips design documents but keeps bug analyses', async () => {
  await withTempDir((dir) => {
    initGitRepo(dir);
    runScript('ensure-workplan-dir.mjs', ['--repo-root', dir, '--create']);
    fs.writeFileSync(path.join(dir, '.workplans', 'TEST-1-design.md'), '# Design: x\n\nTicket TEST-1.\n');
    fs.writeFileSync(path.join(dir, '.workplans', 'TEST-1-bug.md'), '# Bug Analysis: y\n\nTicket TEST-1.\n');
    const { json } = runScript('new-workplan.mjs', ['--repo-root', dir, '--slug', 'second-part', '--genre', 'workplan', '--ticket', 'TEST-1']);
    assert.equal(json.existingSeries.length, 1);
    assert.ok(json.existingSeries[0].endsWith('TEST-1-bug.md'));
  });
});
