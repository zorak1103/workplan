import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set(['.git', '.remember', 'node_modules']);
const SKIP_PREFIXES = ['docs/superpowers'];
const CHECKED_EXTENSIONS = new Set(['.md', '.mjs', '.json']);

// Everything under test/ names `.adoc` on purpose (negative tests); the doc below mentions
// the old format deliberately (old workplans are no longer read).
const ALLOWLIST = [
  'test/',
  'docs/troubleshooting.md',
];

const LEFTOVER_PATTERNS = [
  /\.adoc\b/i,
  /asciidoc/i,
  /\|===/,
  /\[cols=/,
  /\[\[fix-sketch\]\]/,
  /`={2,4} [A-Z<0-9]/,
  /`={2,4}`/,
  /= (Workplan|Bug Analysis):/,
  /`(NOTE|IMPORTANT):`/,
  /(?<!\*)\*(Goal|Requires|Delivers|Files|Complexity):\*(?!\*)/,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(PLUGIN_ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_PREFIXES.includes(rel)) continue;
      walk(full, out);
    } else if (CHECKED_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(rel);
    }
  }
  return out;
}

test('no-asciidoc-leftovers: no AsciiDoc syntax or .adoc rule survives outside the allowlist', () => {
  const offenders = [];
  for (const rel of walk(PLUGIN_ROOT)) {
    if (ALLOWLIST.some((a) => rel === a || (a.endsWith('/') && rel.startsWith(a)))) continue;
    const lines = fs.readFileSync(path.join(PLUGIN_ROOT, rel), 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const pattern of LEFTOVER_PATTERNS) {
        if (pattern.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `AsciiDoc leftovers:\n${offenders.join('\n')}`);
});
