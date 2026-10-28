#!/usr/bin/env node
// Checks (and, with --create, establishes) the precondition every other script in this plugin
// assumes: a `.workplans/` directory that exists and is git-ignored. Never creates or edits
// anything without --create -- the `create` skill's start check always calls this once
// read-only first, shows the result to the user via AskUserQuestion, and only calls it again
// with --create after explicit confirmation.
//
// Usage:
//   node ensure-workplan-dir.mjs --repo-root <dir> [--create] --json
//
// Exit codes: 0 = ok (directory exists and is ignored, or was just created with --create),
//             1 = hard error, 2 = precondition not met (missing dir/entry) and --create absent.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), create: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo-root') args.repoRoot = argv[++i];
    else if (arg === '--create') args.create = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log('Usage: node ensure-workplan-dir.mjs --repo-root <dir> [--create] [--json]');
      process.exit(0);
    }
  }
  return args;
}

function fail(message, args, code = 1) {
  if (args.json) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(message);
  process.exit(code);
}

/** True if `.workplans/` is ignored per `git check-ignore` -- covers both `.git/info/exclude`
 *  and a tracked `.gitignore` entry, whichever the repo uses. */
function isIgnored(repoRootAbs) {
  try {
    execFileSync('git', ['check-ignore', '-q', '.workplans/'], { cwd: repoRootAbs });
    return true;
  } catch (err) {
    // git check-ignore exits 1 when the path is not ignored -- that's a normal "no", not a
    // script failure. Any other exit code (e.g. 128, not a git repo) is a real error.
    if (err.status === 1) return false;
    throw new Error(`git check-ignore failed: ${err.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRootAbs = path.resolve(args.repoRoot);
  if (!fs.existsSync(repoRootAbs)) fail(`Repo root not found: ${repoRootAbs}`, args);

  const workplansDirAbs = path.join(repoRootAbs, '.workplans');
  let exists = fs.existsSync(workplansDirAbs);
  let ignored;
  try {
    ignored = isIgnored(repoRootAbs);
  } catch (err) {
    fail(err.message, args);
    return;
  }

  let created = false;
  let ignoreEntryAdded = false;

  if (args.create) {
    if (!exists) {
      fs.mkdirSync(workplansDirAbs, { recursive: true });
      created = true;
      exists = true;
    }
    if (!ignored) {
      const excludePath = path.join(repoRootAbs, '.git', 'info', 'exclude');
      if (!fs.existsSync(path.dirname(excludePath))) {
        fail(`No git repository at ${repoRootAbs} (.git/info is missing) -- cannot add the ignore entry.`, args);
        return;
      }
      const existingExclude = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
      const entry = '/.workplans/';
      if (!existingExclude.split(/\r?\n/).some((l) => l.trim() === entry)) {
        const sep = existingExclude.length > 0 && !existingExclude.endsWith('\n') ? '\n' : '';
        fs.appendFileSync(excludePath, `${sep}${entry}\n`);
      }
      ignoreEntryAdded = true;
      ignored = true;
    }
  }

  const ok = exists && ignored;
  const result = {
    ok,
    exists,
    ignored,
    created,
    ignoreEntryAdded,
    workplansDir: workplansDirAbs.split(path.sep).join('/'),
  };
  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(`.workplans/ exists: ${exists ? 'yes' : 'no'}`);
    console.log(`.workplans/ ignored: ${ignored ? 'yes' : 'no'}`);
  }
  if (!ok) process.exit(2);
}

main();
