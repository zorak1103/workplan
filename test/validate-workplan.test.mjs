import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, withTempDir } from './helpers/cli.mjs';
import { validWorkplanText, validBugText, legacyPhaseTableWorkplanText } from './helpers/fixture.mjs';

function writeWorkplan(dir, text, fileName = 'valid.md') {
  const workplansDir = path.join(dir, '.workplans');
  fs.mkdirSync(workplansDir, { recursive: true });
  const filePath = path.join(workplansDir, fileName);
  fs.writeFileSync(filePath, text);
  return filePath;
}

const SAFETY_NET_ROW = '| 0 | Create safety net (mandatory) | Implementation | S | Open |';
const S_COMPLEXITY_FIELD = '- **Complexity:** S — One new test case, no dependencies, solution fully known.';

test('validate-workplan: the fixture itself is clean', async () => {
  await withTempDir((dir) => {
    const filePath = writeWorkplan(dir, validWorkplanText());
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.equal(json.genre, 'workplan');
    assert.deepEqual(
      json.findings.filter((f) => f.severity === 'error'),
      [],
    );
  });
});

test('validate-workplan: missing Phase Overview section is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(/## Phase Overview\n[\s\S]*?\n\n## Commit Cut/, '## Commit Cut');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.equal(json.ok, false);
    assert.ok(json.findings.some((f) => f.code === 'missing-phase-table'));
    assert.ok(json.findings.some((f) => f.code === 'missing-section' && f.message.includes('Phase Overview')));
  });
});

test('validate-workplan: a phase missing "**Requires:**" is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace('- **Requires:** none\n', '');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'missing-phase-field' && f.message.includes('Requires')));
  });
});

test('validate-workplan: a phase field written without the bullet is accepted', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace('- **Goal:** Add characterization tests.', '**Goal:** Add characterization tests.');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.ok, true);
  });
});

test('validate-workplan: a Phase Overview table without outer pipes is reported as missing', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText()
      .replace('| Phase | Content | Type | Complexity | Status |', 'Phase | Content | Type | Complexity | Status')
      .replace('|---|---|---|---|---|', '--- | --- | --- | --- | ---')
      .replace(SAFETY_NET_ROW, '0 | Create safety net (mandatory) | Implementation | S | Open')
      .replace('| 1 | Implement core change | Implementation | M | Open |', '1 | Implement core change | Implementation | M | Open');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'missing-phase-table'));
  });
});

test('validate-workplan: an out-of-vocabulary status is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(SAFETY_NET_ROW, '| 0 | Create safety net (mandatory) | Implementation | S | Finished |');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'invalid-status'));
  });
});

test('validate-workplan: an out-of-vocabulary phase type is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(SAFETY_NET_ROW, '| 0 | Create safety net (mandatory) | Umsetzung | S | Open |');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'invalid-type'));
  });
});

test('validate-workplan: a placeholder phrase is a warning, not a hard failure', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace('Work step A.', 'Work step A. TODO: details to follow.');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 0);
    assert.equal(json.ok, true);
    assert.ok(json.findings.some((f) => f.code === 'placeholder' && f.severity === 'warning'));
  });
});

test('validate-workplan: a duplicated finding ID is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(
      '### C1 — Example finding',
      '### C1 — Example finding\n\nText.\n\n### C1 — Second finding with the same ID',
    );
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'duplicate-finding-id'));
  });
});

test('validate-workplan: wrong extension and wrong directory are both reported', async () => {
  await withTempDir((dir) => {
    const otherDir = path.join(dir, 'not-workplans');
    fs.mkdirSync(otherDir, { recursive: true });
    const filePath = path.join(otherDir, 'valid.adoc');
    fs.writeFileSync(filePath, validWorkplanText());
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'wrong-extension' && f.message.includes('Expected ".md"')));
    assert.ok(json.findings.some((f) => f.code === 'wrong-directory'));
  });
});

test('validate-workplan: a real old .adoc workplan is told the format is .md, not just "Unknown genre"', async () => {
  await withTempDir((dir) => {
    const text = '= Workplan: Old plan\n:toc:\n\n== Phase Overview\n';
    const filePath = writeWorkplan(dir, text, 'old.adoc');
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 1);
    assert.match(json.error, /Expected "\.md"/);
  });
});

test('validate-workplan: an unrecognized title prefix fails hard instead of guessing', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace('# Workplan: Example refactoring', '# Idea: Example refactoring');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 1);
    assert.equal(json.ok, false);
    assert.match(json.error, /Unknown genre/);
  });
});

test('validate-workplan: the bug-analysis genre validates against its own section order', async () => {
  await withTempDir((dir) => {
    const filePath = writeWorkplan(dir, validBugText(), 'bug.md');
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.genre, 'bug');
  });
});

test('validate-workplan: a bug analysis without the fix-sketch anchor is a hard error', async () => {
  await withTempDir((dir) => {
    const filePath = writeWorkplan(dir, validBugText().replace('<a id="fix-sketch"></a>\n', ''), 'bug.md');
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'missing-anchor'));
  });
});

test('validate-workplan: a legacy 4-column table (no Complexity column) is a hard error', async () => {
  await withTempDir((dir) => {
    const filePath = writeWorkplan(dir, legacyPhaseTableWorkplanText());
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'missing-complexity-column'));
  });
});

test('validate-workplan: an out-of-vocabulary complexity level is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(SAFETY_NET_ROW, '| 0 | Create safety net (mandatory) | Implementation | XXL | Open |');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'invalid-complexity'));
  });
});

test('validate-workplan: a phase missing "**Complexity:**" is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(`${S_COMPLEXITY_FIELD}\n`, '');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'missing-phase-field' && f.message.includes('Complexity')));
  });
});

test('validate-workplan: a Complexity field that disagrees with the table cell is a hard error', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText().replace(S_COMPLEXITY_FIELD, S_COMPLEXITY_FIELD.replace('Complexity:** S', 'Complexity:** L'));
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 2);
    assert.ok(json.findings.some((f) => f.code === 'complexity-mismatch'));
  });
});

test('validate-workplan: an XL phase is a warning, not a hard failure', async () => {
  await withTempDir((dir) => {
    const text = validWorkplanText()
      .replace(SAFETY_NET_ROW, '| 0 | Create safety net (mandatory) | Implementation | XL | Open |')
      .replace(S_COMPLEXITY_FIELD, '- **Complexity:** XL — Scope can only be determined after exploration.');
    const filePath = writeWorkplan(dir, text);
    const { status, json } = runScript('validate-workplan.mjs', ['--file', filePath]);
    assert.equal(status, 0, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.ok(json.findings.some((f) => f.code === 'complexity-xl' && f.severity === 'warning'));
  });
});
