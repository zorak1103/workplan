#!/usr/bin/env node
// Resolves the target path for a new workplan document, refuses to overwrite an existing one,
// and surfaces other documents that already mention the same ticket (a "workplan series") so
// the `create` skill can compose the right series number and back-reference in the preamble --
// this script only *finds* the candidates; composing the actual "Workplan N, after Workplan N-1"
// prose is the model's job; the numbering scheme is free prose, not a stable field this script
// could parse reliably.
//
// Usage:
//   node new-workplan.mjs --repo-root <dir> --slug <kebab-case> --genre workplan|bug [--ticket <id>] --json
//
// Exit codes: 0 = ok, 1 = hard error, 2 = target already exists.

import fs from 'node:fs';
import path from 'node:path';
import { readLines, inferGenre } from './lib/workplan.mjs';

const GENRES = ['workplan', 'bug'];

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), slug: null, genre: null, ticket: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo-root') args.repoRoot = argv[++i];
    else if (arg === '--slug') args.slug = argv[++i];
    else if (arg === '--genre') args.genre = argv[++i];
    else if (arg === '--ticket') args.ticket = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      console.log('Usage: node new-workplan.mjs --repo-root <dir> --slug <kebab-case> --genre workplan|bug [--ticket <id>] [--json]');
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

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Scans every existing workplan or bug-analysis .md under .workplans/ for a literal mention of
 *  `ticket` in its first 15 lines (title + preamble) -- where a document's ticket reference
 *  lives. Other .md files (e.g. design documents) are skipped: their title is not one of the two
 *  genres. */
function findExistingSeries(workplansDirAbs, ticket) {
  if (!ticket || !fs.existsSync(workplansDirAbs)) return [];
  const hits = [];
  for (const entry of fs.readdirSync(workplansDirAbs)) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = path.join(workplansDirAbs, entry);
    const lines = readLines(fs.readFileSync(fullPath, 'utf8'));
    if (inferGenre(lines) === null) continue;
    const head = lines.slice(0, 15).join('\n');
    if (head.includes(ticket)) hits.push(fullPath.split(path.sep).join('/'));
  }
  return hits;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug) fail('--slug is required.', args);
  if (!SLUG_RE.test(args.slug)) fail(`--slug must be kebab-case (a-z0-9-): "${args.slug}"`, args);
  if (!GENRES.includes(args.genre)) fail(`--genre must be "workplan" or "bug", not "${args.genre}".`, args);

  const repoRootAbs = path.resolve(args.repoRoot);
  if (!fs.existsSync(repoRootAbs)) fail(`Repo root not found: ${repoRootAbs}`, args);
  const workplansDirAbs = path.join(repoRootAbs, '.workplans');

  const fileName = args.ticket ? `${args.ticket}-${args.slug}.md` : `${args.slug}.md`;
  const targetAbs = path.join(workplansDirAbs, fileName);

  const existingSeries = findExistingSeries(workplansDirAbs, args.ticket);

  if (fs.existsSync(targetAbs)) {
    fail(`Target file already exists, not overwriting: ${targetAbs.split(path.sep).join('/')}`, args, 2);
    return;
  }

  const result = {
    ok: true,
    targetPath: targetAbs.split(path.sep).join('/'),
    genre: args.genre,
    templatePath: args.genre === 'workplan' ? 'reference/workplan-template.md' : 'reference/bug-analysis-template.md',
    existingSeries,
  };
  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(`Target path: ${result.targetPath}`);
    if (existingSeries.length > 0) {
      console.log(`Existing documents for the same ticket (${args.ticket}):`);
      for (const p of existingSeries) console.log(`  - ${p}`);
    }
  }
}

main();
