// Tests for scripts/check-skill-entry-confirmation.mjs -- the PreToolUse hook that forces one
// explicit confirmation before any of this plugin's four skills starts, in every permission mode.
// Run as a real child process fed via stdin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { runHookScript, SCRIPTS_DIR } from './helpers/cli.mjs';

const SCRIPT = 'check-skill-entry-confirmation.mjs';
const SCRIPT_PATH = path.join(SCRIPTS_DIR, SCRIPT);

function run(payload) {
  return runHookScript(SCRIPT, payload);
}

/** Feeds literal (possibly invalid) text on stdin -- unlike `run`, which always feeds valid
 *  `JSON.stringify(payload)` via runHookScript. Needed only for the malformed-stdin test. */
function runRaw(rawInput) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], { input: rawInput, encoding: 'utf8' });
  const trimmed = result.stdout.trim();
  return { status: result.status, stdout: result.stdout, decision: trimmed === '' ? null : JSON.parse(trimmed) };
}

// -- Ask: the plugin/skill is identifiable ----------------------------------------------------

test('check-skill-entry-confirmation: asks for a Skill call naming workplan:create', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'workplan:create' } });
  assert.equal(decision.permissionDecision, 'ask');
});

test('check-skill-entry-confirmation: asks regardless of which tool_input field carries the name', () => {
  for (const input of [{ skill: 'workplan:review' }, { name: 'workplan:review' }, { command: 'workplan:review' }]) {
    const { decision } = run({ tool_name: 'Skill', tool_input: input });
    assert.equal(decision.permissionDecision, 'ask');
  }
});

test('check-skill-entry-confirmation: asks when the skill is identified only by its SKILL.md path', () => {
  const windowsPath = 'C:\\Users\\x\\.claude\\plugins\\workplan\\skills\\close\\SKILL.md';
  const { decision } = run({ tool_name: 'Skill', tool_input: { path: windowsPath } });
  assert.equal(decision.permissionDecision, 'ask');
  assert.match(decision.permissionDecisionReason, /"close"/);
});

test('check-skill-entry-confirmation: names the concrete skill in the English reason', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'workplan:execute' } });
  const reason = decision.permissionDecisionReason;
  assert.match(reason, /^workplan: /);
  assert.match(reason, /"execute"/);
  assert.match(reason, /auto mode/);
});

test('check-skill-entry-confirmation: asks with a generic reason when the plugin is named but the skill is not', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { plugin: 'workplan', id: 'abc123' } });
  assert.equal(decision.permissionDecision, 'ask');
  assert.match(decision.permissionDecisionReason, /create\/review\/execute\/close/);
});

test('check-skill-entry-confirmation: asks for a bare skill name with no plugin qualifier', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'execute' } });
  assert.equal(decision.permissionDecision, 'ask');
});

test('check-skill-entry-confirmation: asks for a bare "review" name with no plugin qualifier', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'review' } });
  assert.equal(decision.permissionDecision, 'ask');
  assert.match(decision.permissionDecisionReason, /"review"/);
});

// -- Silent: not this plugin's skill -----------------------------------------------------------

test("check-skill-entry-confirmation: stays silent for another plugin's skill", () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'other-plugin:review' } });
  assert.equal(decision, null);
});

test("check-skill-entry-confirmation: stays silent for another plugin's review-rounds skill", () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'other-plugin:review-rounds' } });
  assert.equal(decision, null);
});

test("check-skill-entry-confirmation: stays silent for a Bash call that runs one of this plugin's own scripts", () => {
  const { decision } = run({
    tool_name: 'Bash',
    tool_input: { command: 'node "/repo/plugins/workplan/scripts/validate-workplan.mjs" --file x.md --json' },
  });
  assert.equal(decision, null);
});

test('check-skill-entry-confirmation: stays silent for a bare name that is not one of the four', () => {
  const { decision } = run({ tool_name: 'Skill', tool_input: { name: 'brainstorming' } });
  assert.equal(decision, null);
});

test('check-skill-entry-confirmation: a Skill payload mentioning validate-workplan.mjs or .workplans/ is not a plugin mention', () => {
  for (const input of [
    { name: 'other-plugin:inspect', args: 'validate-workplan.mjs --file .workplans/x.md' },
    { name: 'brainstorming', args: 'see .workplans/ and my-workplan-notes' },
  ]) {
    const { decision } = run({ tool_name: 'Skill', tool_input: input });
    assert.equal(decision, null, JSON.stringify(input));
  }
});

// -- Invariants -----------------------------------------------------------------------------

test('check-skill-entry-confirmation: asks in every permission mode', () => {
  for (const permission_mode of ['default', 'auto', 'acceptEdits', 'plan', undefined]) {
    const payload = { tool_name: 'Skill', tool_input: { name: 'workplan:close' } };
    if (permission_mode !== undefined) payload.permission_mode = permission_mode;
    const { decision } = run(payload);
    assert.equal(decision.permissionDecision, 'ask', `mode=${permission_mode}`);
  }
});

test('check-skill-entry-confirmation: never emits deny or allow', () => {
  const payloads = [
    { tool_name: 'Skill', tool_input: { name: 'workplan:create' } },
    { tool_name: 'Skill', tool_input: { name: 'workplan:review' } },
    { tool_name: 'Skill', tool_input: { name: 'workplan:execute' } },
    { tool_name: 'Skill', tool_input: { name: 'workplan:close' } },
    { tool_name: 'Skill', tool_input: { name: 'execute' } },
  ];
  for (const payload of payloads) {
    const { decision } = run(payload);
    assert.equal(decision.permissionDecision, 'ask');
  }
});

test('check-skill-entry-confirmation: emits a well-formed PreToolUse envelope', () => {
  const { stdout } = run({ tool_name: 'Skill', tool_input: { name: 'workplan:create' } });
  const parsed = JSON.parse(stdout.trim());
  assert.deepEqual(Object.keys(parsed), ['hookSpecificOutput']);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
});

test('check-skill-entry-confirmation: fails open on malformed stdin', () => {
  const { status, stdout, decision } = runRaw('not json');
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
  assert.equal(decision, null);
});

test('check-skill-entry-confirmation: fails open on an empty payload and on a missing tool_input', () => {
  for (const payload of [{}, { tool_name: 'Skill' }]) {
    const { decision } = run(payload);
    assert.equal(decision, null);
  }
});

// -- Pin: explicit-slash suppression is not yet implemented ------------------------------------
// Whether an explicit `/workplan:create` invocation is even distinguishable from a model-chosen
// Skill call in the real payload is unverified. This test pins today's conservative default
// (always ask) and is expected to flip once a real discriminator field is confirmed -- see
// check-skill-entry-confirmation.mjs's `looksLikeExplicitUserInvocation`.

test('check-skill-entry-confirmation: still asks for a payload that looks like an explicit slash invocation', () => {
  const { decision } = run({
    tool_name: 'Skill',
    tool_input: { name: 'workplan:create', invocation_source: 'slash_command' },
  });
  assert.equal(decision.permissionDecision, 'ask');
});
