#!/usr/bin/env node
// The two remaining mechanical steps of closing a workplan: appending the closing sentence, and
// -- only after the calling skill has already gotten explicit user confirmation -- deleting the
// file. Refuses both unless every phase in the Phase Overview is `Done`, as a second,
// independent safety net beyond the skill's own AskUserQuestion gate.
//
// Usage:
//   node close-workplan.mjs --file <path> --append-closing-sentence --json
//   node close-workplan.mjs --file <path> --delete --json
//
// Exit codes: 0 = ok, 1 = hard error, 2 = not every phase is Done.

import fs from 'node:fs';
import path from 'node:path';
import {
  readLines,
  joinLines,
  getPhaseTable,
  getTitle,
  STATUS_DONE,
  WORKPLAN_TITLE_PREFIX,
  BUG_TITLE_PREFIX,
} from './lib/workplan.mjs';

function parseArgs(argv) {
  const args = { file: null, appendClosingSentence: false, delete: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--append-closing-sentence') args.appendClosingSentence = true;
    else if (arg === '--delete') args.delete = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log('Usage: node close-workplan.mjs --file <path> (--append-closing-sentence | --delete) [--json]');
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) fail('--file is required.', args);
  if (!args.appendClosingSentence && !args.delete) fail('--append-closing-sentence or --delete is required.', args);

  const fileAbs = path.resolve(args.file);
  if (!fs.existsSync(fileAbs)) fail(`File not found: ${fileAbs}`, args);
  const fileAbsPosix = fileAbs.split(path.sep).join('/');
  if (!fileAbsPosix.endsWith('.md') || !fileAbsPosix.includes('/.workplans/')) {
    fail(`Refusing to modify a file outside ".workplans/*.md": ${fileAbsPosix}`, args);
  }

  const lines = readLines(fs.readFileSync(fileAbs, 'utf8'));
  const phaseTable = getPhaseTable(lines);
  if (!phaseTable || phaseTable.rows.length === 0) fail('Phase Overview table not found or empty.', args);
  const allDone = phaseTable.rows.every((r) => r.status === STATUS_DONE);
  if (!allDone) {
    const open = phaseTable.rows.filter((r) => r.status !== STATUS_DONE).map((r) => r.phase);
    fail(`Not every phase is Done (open: ${open.join(', ')}) -- refusing to close.`, args, 2);
    return;
  }

  if (args.delete) {
    fs.unlinkSync(fileAbs);
    const result = { ok: true, deleted: true, file: fileAbsPosix };
    if (args.json) console.log(JSON.stringify(result));
    else console.log(`Deleted: ${fileAbsPosix}`);
    return;
  }

  const title = getTitle(lines) ?? 'Workplan';
  const titlePrefixRe = new RegExp(`^(${WORKPLAN_TITLE_PREFIX}|${BUG_TITLE_PREFIX})\\s*`);
  const closingLine = `${title.replace(titlePrefixRe, '')} is now fully completed.`;
  const withClosing = [...lines];
  if (withClosing[withClosing.length - 1] === '') withClosing.pop();
  withClosing.push('', closingLine, '');
  fs.writeFileSync(fileAbs, joinLines(withClosing));

  const result = { ok: true, appended: true, file: fileAbsPosix, closingLine };
  if (args.json) console.log(JSON.stringify(result));
  else console.log(`Closing sentence appended: ${closingLine}`);
}

main();
