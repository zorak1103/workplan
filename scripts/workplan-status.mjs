#!/usr/bin/env node
// Reports a workplan document's phases, their type/status, and the next open phase -- the read
// side `execute` and `close` both need before doing anything else. With no --file, lists every
// workplan-genre document under .workplans/ as candidates instead of guessing, so the calling
// skill can ask the user via AskUserQuestion when there's more than one.
//
// Usage:
//   node workplan-status.mjs --repo-root <dir> [--file <path>] --json
//
// Exit codes: 0 = ok, 1 = hard error.

import fs from 'node:fs';
import path from 'node:path';
import { readLines, inferGenre, getPhaseTable, STATUS_OPEN, STATUS_DONE } from './lib/workplan.mjs';

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), file: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo-root') args.repoRoot = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log('Usage: node workplan-status.mjs --repo-root <dir> [--file <path>] [--json]');
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

function findCandidates(workplansDirAbs) {
  if (!fs.existsSync(workplansDirAbs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(workplansDirAbs)) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = path.join(workplansDirAbs, entry);
    const lines = readLines(fs.readFileSync(fullPath, 'utf8'));
    if (inferGenre(lines) === 'workplan') out.push(fullPath.split(path.sep).join('/'));
  }
  return out;
}

function reportForFile(fileAbs, args) {
  const text = fs.readFileSync(fileAbs, 'utf8');
  const lines = readLines(text);
  const genre = inferGenre(lines);
  if (genre !== 'workplan') {
    fail(`Not a workplan document (genre: ${genre ?? 'unknown'}): ${fileAbs}`, args);
    return;
  }
  const phaseTable = getPhaseTable(lines);
  if (!phaseTable) {
    fail(`Phase Overview table not found: ${fileAbs}`, args);
    return;
  }
  const phases = phaseTable.rows.map((r) => ({ phase: r.phase, content: r.content, type: r.type, complexity: r.complexity, status: r.status }));
  const nextOpen = phases.find((p) => p.status === STATUS_OPEN) ?? null;
  const allDone = phases.length > 0 && phases.every((p) => p.status === STATUS_DONE);
  const result = {
    ok: true,
    file: fileAbs.split(path.sep).join('/'),
    phases,
    nextOpen,
    allDone,
  };
  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(`File: ${result.file}`);
    for (const p of phases) {
      const typeLabel = p.complexity ? `${p.type}, ${p.complexity}` : p.type;
      console.log(`  Phase ${p.phase} [${typeLabel}] ${p.status} -- ${p.content}`);
    }
    console.log(nextOpen ? `Next open phase: ${nextOpen.phase}` : allDone ? 'All phases done.' : 'No open phase found.');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRootAbs = path.resolve(args.repoRoot);
  if (!fs.existsSync(repoRootAbs)) fail(`Repo root not found: ${repoRootAbs}`, args);
  const workplansDirAbs = path.join(repoRootAbs, '.workplans');

  if (args.file) {
    const fileAbs = path.isAbsolute(args.file) ? args.file : path.resolve(repoRootAbs, args.file);
    if (!fs.existsSync(fileAbs)) fail(`File not found: ${fileAbs}`, args);
    reportForFile(fileAbs, args);
    return;
  }

  const candidates = findCandidates(workplansDirAbs);
  if (candidates.length === 1) {
    reportForFile(path.resolve(candidates[0]), args);
    return;
  }
  const result = { ok: true, candidates };
  if (args.json) console.log(JSON.stringify(result));
  else {
    if (candidates.length === 0) console.log('No workplan documents found under .workplans/.');
    else {
      console.log('Multiple workplan documents found, pass --file:');
      for (const c of candidates) console.log(`  - ${c}`);
    }
  }
}

main();
