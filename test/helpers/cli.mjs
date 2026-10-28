// Spawns one of this plugin's CLI scripts as a real child process and captures its result --
// deliberately exercising the scripts the same way the skills invoke them (as standalone `node
// <script> --json` commands), not by importing their internals.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPTS_DIR = path.resolve(HERE, '..', '..', 'scripts');

export function runScript(scriptName, args) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args, '--json'], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // leave json null; caller can inspect stdout/stderr/status directly for diagnosing a
    // non-JSON failure (e.g. an uncaught exception printed a stack trace instead)
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

/** Spawns one of this plugin's hook scripts, feeding `payload` as JSON on stdin -- the shape a
 *  PreToolUse hook actually receives, unlike the `--json`-flagged CLI scripts `runScript` targets.
 *  Returns the parsed `hookSpecificOutput` object, or `null` when the hook emitted no output
 *  (the normal "let the permission flow proceed unchanged" outcome). */
export function runHookScript(scriptName, payload) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  const trimmed = result.stdout.trim();
  const decision = trimmed === '' ? null : JSON.parse(trimmed).hookSpecificOutput;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, decision };
}

/** Creates an isolated temp directory under the OS temp root, removed automatically after `fn`
 *  runs (success or failure) so tests never leave fixtures behind. */
export async function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-test-'));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
