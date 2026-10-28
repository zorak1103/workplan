// Guards the regressions the model-invocability change introduced the risk of: a stray
// `disable-model-invocation` re-appearing, one of the four descriptions losing its exclusion
// clause and quietly widening its trigger surface again, AskUserQuestion silently dropping out of
// a skill's grant (the in-body confirmations in create's start check and close's confirmation
// steps depend on it), or the review skill's agent grant drifting from the agent files.
// Dependency-free by convention (no YAML parser in this repo) -- reads each SKILL.md as text and
// regexes the frontmatter block.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = ['create', 'review', 'execute', 'close'];
const AGENTS = ['workplan-fact-checker', 'workplan-cut-critic', 'workplan-devils-advocate'];

function readFrontmatterOf(relativePath) {
  const text = fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  assert.ok(match, `${relativePath} has no frontmatter block`);
  return match[1];
}

function readFrontmatter(skill) {
  return readFrontmatterOf(path.join('skills', skill, 'SKILL.md'));
}

function readDescription(frontmatter) {
  const match = /description:\s*"([\s\S]*?)"\r?\n\S/.exec(`${frontmatter}\n---`);
  assert.ok(match, 'description field not found or not double-quoted');
  return match[1];
}

test('skills frontmatter: no skill carries disable-model-invocation any more', () => {
  for (const skill of SKILLS) {
    const frontmatter = readFrontmatter(skill);
    assert.doesNotMatch(frontmatter, /disable-model-invocation/, `${skill} still has the flag`);
  }
});

test('skills frontmatter: every skill still grants AskUserQuestion', () => {
  for (const skill of SKILLS) {
    const frontmatter = readFrontmatter(skill);
    assert.match(frontmatter, /^\s*-\s*AskUserQuestion\s*$/m, `${skill} lost the AskUserQuestion grant`);
  }
});

test('skills frontmatter: every description names .workplans/ and carries an exclusion clause', () => {
  for (const skill of SKILLS) {
    const description = readDescription(readFrontmatter(skill));
    assert.match(description, /\.workplans\//, `${skill}'s description no longer mentions .workplans/`);
    assert.match(description, /Use only|Not for /, `${skill}'s description lost its exclusion clause`);
  }
});

test('skills frontmatter: every skill name matches its directory', () => {
  for (const skill of SKILLS) {
    assert.match(readFrontmatter(skill), new RegExp(`^name:\\s*${skill}\\s*$`, 'm'), `${skill} has a different name`);
  }
});

test('skills frontmatter: review grants exactly the three plugin-qualified critic agents', () => {
  const frontmatter = readFrontmatter('review');
  const grant = /Agent\(([^)]*)\)/.exec(frontmatter);
  assert.ok(grant, 'review has no Agent(...) grant');
  const granted = grant[1].split(',').map((s) => s.trim());
  assert.deepEqual(granted, AGENTS.map((a) => `workplan:${a}`));
});

test('agents: each agent file exists and its frontmatter name matches the file name', () => {
  for (const agent of AGENTS) {
    const frontmatter = readFrontmatterOf(path.join('agents', `${agent}.md`));
    assert.match(frontmatter, new RegExp(`^name:\\s*${agent}\\s*$`, 'm'), `${agent} has a different name`);
  }
});

test('create: advertises both seeding flags and documents --from-design in its body', () => {
  const frontmatter = readFrontmatter('create');
  assert.match(frontmatter, /argument-hint:\s*".*--from-bug <path>.*"/, 'argument-hint lost --from-bug');
  assert.match(frontmatter, /argument-hint:\s*".*--from-design <path>.*"/, 'argument-hint lacks --from-design');
  const body = fs.readFileSync(path.join(PLUGIN_ROOT, 'skills', 'create', 'SKILL.md'), 'utf8');
  assert.match(body, /\*\*With `--from-design <path>`:\*\*/, 'create has no --from-design step');
  assert.match(body, /read-only/i, 'create no longer states that seed documents stay read-only');
});

test('create: --from-design keeps its conflict guards (excludes --from-bug and --genre bug)', () => {
  const body = fs.readFileSync(path.join(PLUGIN_ROOT, 'skills', 'create', 'SKILL.md'), 'utf8');
  const step = /\*\*With `--from-design <path>`:\*\*[\s\S]*?(?=\n## )/.exec(body);
  assert.ok(step, 'create has no --from-design step');
  assert.match(step[0], /--from-bug/, 'no rule about combining --from-design with --from-bug');
  assert.match(step[0], /--genre bug/, 'no rule about --from-design with --genre bug');
});

test('docs: README and conventions mention --from-design', () => {
  for (const file of ['README.md', path.join('reference', 'document-conventions.md')]) {
    const text = fs.readFileSync(path.join(PLUGIN_ROOT, file), 'utf8');
    assert.match(text, /--from-design/, `${file} does not mention --from-design`);
  }
});

test('plugin manifest: name is "workplan" and the hook matcher targets the Skill tool', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'workplan');
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'hooks', 'hooks.json'), 'utf8'));
  assert.equal(hooks.hooks.PreToolUse[0].matcher, 'Skill');
});
