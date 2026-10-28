#!/usr/bin/env node
// PreToolUse hook: forces one explicit confirmation before any of this plugin's four skills
// (create/review/execute/close) starts, in every permission mode including auto.
//
// Why the harness and not prose: once a skill is model-invocable, the model itself decides when
// it starts -- a "please ask first" sentence in the SKILL.md body is read only *after* the skill
// has already been selected, and auto mode is documented as biasing the model toward not
// stopping to ask. This hook does not trust the model to remember; it makes the harness itself
// force a real permission prompt.
//
// Why this asks in EVERY permission mode, not only "auto": unlike Edit/Write, a Skill-tool call
// has no default interactive prompt to fall back on in the first place, so an auto-only condition
// would leave default/acceptEdits/plan completely ungated. This hook never denies and never
// allows -- it only ever escalates to `ask`, so the cost of asking unconditionally is one extra
// confirmation, never a block.
//
// Why the payload is scanned as a serialised string rather than by field name: the `Skill`
// tool's `tool_input` schema is not documented anywhere at the time this was written. Keying on
// a guessed field name (`skill`? `name`? `command`? `path`?) would silently disable the whole
// gate the day that guess is wrong -- a false negative that is invisible until it matters.
// Scanning the serialised input for the plugin name is schema-agnostic and degrades the other
// way: a false positive costs one redundant prompt, a false negative costs the entire gate. The
// two tiers below are ordered on that basis -- prefer asking.
//
// Word boundaries (`(?![a-z0-9-])`) throughout, so e.g. `review` does not match inside a foreign
// skill named `review-rounds` that another plugin might ship.
//
// `looksLikeExplicitUserInvocation` currently always returns false -- whether an explicit
// `/workplan:create` slash invocation is even distinguishable from a model-chosen Skill call in
// this payload is unverified. Guessing a discriminator field here would risk matching the
// model-invocation case too and silently killing the gate for exactly the case it exists to
// cover; asking redundantly on the explicit path costs one keystroke. Flip this once a real
// discriminator is confirmed against a live payload.
//
// Reads the PreToolUse hook payload from stdin ({ tool_name, tool_input, ... }). Fails open (exit
// 0, no output) on any error reading/parsing the payload -- a hook that can crash the tool-call
// pipeline is worse than one that occasionally misses its one gate.
//
// Debug aid (WORKPLAN_DEBUG_PAYLOAD=1): appends every payload this hook actually sees to
// ~/.claude/tmp/logs/skill-payload.json, to let a live session capture the real `Skill`
// tool_input shape for verification. Never emitted otherwise; failures in the debug write
// itself are swallowed so they can never turn the main gate's fail-open into a crash.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PLUGIN = 'workplan';
const SKILL_TOOL_RE = /skill/i;

// The plugin name must stand alone: not preceded or followed by a name character, so that
// "validate-workplan.mjs" or ".workplans/" never counts as a mention of this plugin.
// e.g. "workplan:create" or "workplan/skills/close/SKILL.md" (after normalize()).
const OURS_QUALIFIED_RE = /(?<![a-z0-9-])workplan[:/](create|review|execute|close)(?![a-z0-9-])/;
const OURS_SKILLS_PATH_RE = /(?<![a-z0-9-])workplan\/skills\/(create|review|execute|close)(?![a-z0-9-])/;
const PLUGIN_MENTION_RE = /(?<![a-z0-9-])workplan(?![a-z0-9-])/;
// Any OTHER plugin qualifying one of our four bare names, e.g. "other-plugin:review" -- a
// definitive veto for Tier B, since it proves the call is not ours even though a plain name
// match would otherwise look like one.
const FOREIGN_QUALIFIED_RE = /([a-z0-9][a-z0-9-]*):(create|review|execute|close)(?![a-z0-9-])/g;
const BARE_NAME_RE = /"(create|review|execute|close)"/;

/** Collapses runs of backslashes to a single forward slash. Windows file paths inside a
 *  JSON-stringified payload arrive double-escaped (`C:\\...\\plugins\\workplan\\skills\\...`);
 *  without this, none of the path-shaped regexes above would ever match on this platform. */
function normalize(value) {
  return value.replace(/\\+/g, '/');
}

/** Extracts which of the four skill names the haystack identifies, via either a qualified
 *  "plugin:skill" reference or a "plugin/skills/<skill>/" path. Returns null if the plugin is
 *  clearly named but the specific skill can't be pinned down -- callers still ask, just with a
 *  more generic reason. */
function resolveSkillName(haystack) {
  const bySkillsPath = OURS_SKILLS_PATH_RE.exec(haystack);
  if (bySkillsPath) return bySkillsPath[1];
  const byQualifier = OURS_QUALIFIED_RE.exec(haystack);
  if (byQualifier) return byQualifier[1];
  return null;
}

/** True if the haystack qualifies one of our four bare skill names with some plugin name other
 *  than ours -- e.g. "other-plugin:review". Used only as Tier B's veto, so that a bare
 *  `"review"` belonging to a foreign plugin's own skill doesn't get mistaken for ours. */
function mentionsForeignQualifiedSkill(haystack) {
  for (const match of haystack.matchAll(FOREIGN_QUALIFIED_RE)) {
    if (match[1] !== PLUGIN) return true;
  }
  return false;
}

/** Always false today -- see the header comment for why this isn't guessed at. Kept as a named,
 *  independently testable predicate so the one-line change described there stays exactly that:
 *  one line, once a real discriminator is confirmed. */
function looksLikeExplicitUserInvocation(_payload) {
  return false;
}

/** Decides whether to ask, and (if resolvable) which skill to name in the reason. Returns
 *  `{ ask: false }` when nothing in the payload identifies this plugin or one of its skills. */
function decide(payload) {
  if (typeof payload.tool_name !== 'string' || !SKILL_TOOL_RE.test(payload.tool_name)) {
    return { ask: false };
  }

  const haystack = normalize(JSON.stringify(payload.tool_input ?? {}));

  // Tier A -- the plugin name appears anywhere in the serialised input. This is the load-bearing
  // path; see the header comment on why it scans the whole serialised value instead of a field.
  if (PLUGIN_MENTION_RE.test(haystack)) {
    return { ask: true, skill: resolveSkillName(haystack) };
  }

  // Tier B -- fallback for an unrecognised schema that never mentions the plugin name at all, but
  // does carry a bare skill name (e.g. `{"name":"execute"}`). Vetoed the moment some other
  // plugin's qualifier is present, since that proves the call isn't ours.
  if (mentionsForeignQualifiedSkill(haystack)) return { ask: false };
  const bareMatch = BARE_NAME_RE.exec(haystack);
  if (bareMatch) return { ask: true, skill: bareMatch[1] };

  return { ask: false };
}

function reasonFor(skill) {
  const subject = skill
    ? `The skill "${skill}" is about to start.`
    : 'A skill of this plugin (create/review/execute/close) is about to start.';
  return (
    `workplan: ${subject} This skill creates, changes or deletes a workplan document and shapes ` +
    'the rest of the session -- it only ever starts after explicit confirmation, even in auto ' +
    'mode. Please confirm or decline.'
  );
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Debug aid only -- see header comment. Never throws; a failure here must never affect the
 *  hook's actual (fail-open) behaviour. */
function maybeLogPayloadForDebugging(rawPayload) {
  if (process.env.WORKPLAN_DEBUG_PAYLOAD !== '1') return;
  try {
    const logDir = path.join(os.homedir(), '.claude', 'tmp', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'skill-payload.json'), `${new Date().toISOString()}\n${rawPayload}\n---\n`);
  } catch {
    // debug aid only -- never let this affect the hook's real behaviour.
  }
}

function main() {
  const raw = readStdin();
  maybeLogPayloadForDebugging(raw);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // malformed/empty payload -- fail open, no output.
  }

  if (looksLikeExplicitUserInvocation(payload)) return;

  const { ask, skill } = decide(payload);
  if (!ask) return;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reasonFor(skill),
    },
  }));
}

main();
