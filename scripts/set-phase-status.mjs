#!/usr/bin/env node
// Mechanically flips one phase's status cell (and, optionally, one commit's hash cell) in a
// workplan document. This is the write side of the plugin's mandatory write-back rule --
// `execute` calls this at the end of every phase instead of hand-editing
// the Markdown table, so the table's formatting never drifts from what this plugin can parse
// back. Idempotent: setting the same status/hash again reproduces the same line.
//
// Usage:
//   node set-phase-status.mjs --file <path> --phase <id> --status Open|"In progress"|Done
//                              [--commit <commitId> --hash <hash>] --json
//
// Exit codes: 0 = ok, 1 = hard error (file/phase/commit not found, invalid status).

import fs from 'node:fs';
import path from 'node:path';
import { readLines, joinLines, getPhaseTable, getCommitTable, buildRow, replaceLine, PHASE_STATUS_VALUES } from './lib/workplan.mjs';

function parseArgs(argv) {
  const args = { file: null, phase: null, status: null, commit: null, hash: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--phase') args.phase = argv[++i];
    else if (arg === '--status') args.status = argv[++i];
    else if (arg === '--commit') args.commit = argv[++i];
    else if (arg === '--hash') args.hash = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log(
        'Usage: node set-phase-status.mjs --file <path> --phase <id> --status Open|"In progress"|Done [--commit <commitId> --hash <hash>] [--json]',
      );
      process.exit(0);
    }
  }
  return args;
}

function fail(message, args) {
  if (args.json) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(message);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) fail('--file is required.', args);
  if (!args.phase) fail('--phase is required.', args);
  if (!args.status) fail('--status is required.', args);
  if (!PHASE_STATUS_VALUES.includes(args.status)) {
    fail(`Invalid status "${args.status}" -- allowed: ${PHASE_STATUS_VALUES.join(', ')}.`, args);
  }
  if ((args.commit && !args.hash) || (!args.commit && args.hash)) {
    fail('--commit and --hash must be given together.', args);
  }

  const fileAbs = path.resolve(args.file);
  if (!fs.existsSync(fileAbs)) fail(`File not found: ${fileAbs}`, args);

  const text = fs.readFileSync(fileAbs, 'utf8');
  const lines = readLines(text);

  const phaseTable = getPhaseTable(lines);
  if (!phaseTable) fail(`Phase Overview table not found: ${fileAbs}`, args);
  const phaseRow = phaseTable.rows.find((r) => r.phase === args.phase);
  if (!phaseRow) fail(`Phase "${args.phase}" not found in the Phase Overview.`, args);
  if (phaseTable.columns.Status == null) fail(`Phase Overview table has no "Status" column: ${fileAbs}`, args);

  // Copy the row's actual cells rather than rebuilding from the four "classic" fields, so any
  // extra column this document already has (e.g. Complexity) survives the rewrite untouched --
  // see reference/document-conventions.md.
  const phaseCells = [...phaseRow.cells];
  phaseCells[phaseTable.columns.Status] = args.status;
  replaceLine(lines, phaseRow.line, buildRow(phaseCells));

  let commitResult = null;
  if (args.commit) {
    const commitTable = getCommitTable(lines);
    if (!commitTable) fail(`Commit Cut table not found: ${fileAbs}`, args);
    const commitRow = commitTable.rows.find((r) => r.commit === args.commit);
    if (!commitRow) fail(`Commit "${args.commit}" not found in the Commit Cut table.`, args);
    if (commitTable.columns.Hash == null) fail(`Commit Cut table has no "Hash" column: ${fileAbs}`, args);
    const commitCells = [...commitRow.cells];
    commitCells[commitTable.columns.Hash] = args.hash;
    replaceLine(lines, commitRow.line, buildRow(commitCells));
    commitResult = { commit: args.commit, hash: args.hash };
  }

  fs.writeFileSync(fileAbs, joinLines(lines));

  const result = { ok: true, file: fileAbs.split(path.sep).join('/'), phase: args.phase, status: args.status, commit: commitResult };
  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(`Phase ${args.phase} -> ${args.status}`);
    if (commitResult) console.log(`Commit ${commitResult.commit} -> ${commitResult.hash}`);
  }
}

main();
