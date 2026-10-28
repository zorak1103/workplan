// Minimal, purpose-built reader/writer for the workplan plugin's Markdown documents.
//
// This is NOT a general Markdown parser. It only understands the specific shape produced by
// this plugin's own templates (reference/workplan-template.md,
// reference/bug-analysis-template.md): a `# Title` line, a preamble, then a flat sequence of
// `##`/`###`/`####` headings, with at most two pipe tables per document written one row per
// line, every row starting and ending with `|`. Lines inside fenced code blocks (``` or ~~~) are
// never read as headings or tables.
//
// Every mutation works by locating specific lines and replacing them in place, so parsing then
// serializing WITHOUT any mutation reproduces the input byte-for-byte (round-trip property,
// verified by test/lib-workplan.test.mjs). Mutated rows are rebuilt with the same
// `| cell | cell | ... |` shape this plugin's templates use, so a document this plugin wrote
// stays visually consistent after a mutation even though only the touched line changes.
//
// Deliberately dependency-free (no package.json) so the plugin runs via --plugin-dir without
// `npm install`.

export function readLines(text) {
  return text.split(/\r?\n/);
}

export function joinLines(lines) {
  return lines.join('\n');
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const TABLE_SEPARATOR_RE = /^\|(\s*:?-+:?\s*\|)+$/;

/**
 * Per line: true when the line belongs to a fenced code block (opening and closing fence lines
 * included). A fence closes on a line of the same character, at least as long as the opener; an
 * unclosed fence runs to the end of the document.
 */
function fencedMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let fence = null; // { char, length } while inside a fence
  for (let i = 0; i < lines.length; i++) {
    if (fence) {
      mask[i] = true;
      const m = /^ {0,3}(`+|~+)\s*$/.exec(lines[i]);
      if (m && m[1][0] === fence.char && m[1].length >= fence.length) fence = null;
      continue;
    }
    const m = FENCE_OPEN_RE.exec(lines[i]);
    // A backtick fence's info string may not contain a backtick (that would be inline code).
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      fence = { char: m[1][0], length: m[1].length };
      mask[i] = true;
    }
  }
  return mask;
}

/** Every `#`-prefixed heading in the document outside fenced code, in order. */
export function extractHeadings(lines) {
  const mask = fencedMask(lines);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const m = HEADING_RE.exec(lines[i]);
    if (m) out.push({ line: i, level: m[1].length, title: m[2].trim() });
  }
  return out;
}

/** Title (`# ...`) of the document, or null if the first line isn't a level-1 heading. */
export function getTitle(lines) {
  const m = HEADING_RE.exec(lines[0] ?? '');
  if (!m || m[1].length !== 1) return null;
  return m[2].trim();
}

/** Title prefixes that identify the two document genres (reference/document-conventions.md). */
export const WORKPLAN_TITLE_PREFIX = 'Workplan:';
export const BUG_TITLE_PREFIX = 'Bug Analysis:';

/**
 * Genre inferred from the title prefix. Returns 'workplan', 'bug', or null when the title
 * doesn't match either of this plugin's two known genres (reference/document-conventions.md).
 */
export function inferGenre(lines) {
  const title = getTitle(lines);
  if (!title) return null;
  if (title.startsWith(WORKPLAN_TITLE_PREFIX)) return 'workplan';
  if (title.startsWith(BUG_TITLE_PREFIX)) return 'bug';
  return null;
}

/**
 * Find a top-level (level 2) heading whose title starts with `titlePrefix`. Returns
 * `{ line, level, title, end }` where `end` is the line index of the next heading at level <= 2
 * (or EOF) — i.e. the exclusive end of this section's body. Returns null if not found.
 */
export function findSection(lines, titlePrefix, level = 2) {
  const headings = extractHeadings(lines);
  const idx = headings.findIndex((h) => h.level === level && h.title.startsWith(titlePrefix));
  if (idx === -1) return null;
  const h = headings[idx];
  let end = lines.length;
  for (let i = idx + 1; i < headings.length; i++) {
    if (headings[i].level <= level) {
      end = headings[i].line;
      break;
    }
  }
  return { ...h, end };
}

/** All level-3 subsections directly inside a section's body (does not recurse into level 4). */
export function findSubsections(lines, section, level = 3) {
  const mask = fencedMask(lines);
  const out = [];
  for (let i = section.line + 1; i < section.end; i++) {
    if (mask[i]) continue;
    const m = HEADING_RE.exec(lines[i]);
    if (m && m[1].length === level) {
      let end = section.end;
      for (let j = i + 1; j < section.end; j++) {
        if (mask[j]) continue;
        const m2 = HEADING_RE.exec(lines[j]);
        if (m2 && m2[1].length <= level) {
          end = j;
          break;
        }
      }
      out.push({ line: i, level, title: m[2].trim(), end });
    }
  }
  return out;
}

/**
 * Locate the pipe table inside `lines[start:end]`: the first contiguous run of lines starting
 * with `|`, outside fenced code, whose second line is a separator row (`|---|---|`, alignment
 * colons allowed). Returns `{ headerLine, separatorLine, lastLine }` (all absolute line indices)
 * or null if no such table is there. A table written without outer pipes is not recognised.
 */
export function findTableBounds(lines, start, end) {
  const mask = fencedMask(lines);
  for (let i = start; i + 1 < end; i++) {
    if (mask[i] || !lines[i].trim().startsWith('|')) continue;
    if (mask[i + 1] || !TABLE_SEPARATOR_RE.test(lines[i + 1].trim())) continue;
    let lastLine = i + 1;
    while (lastLine + 1 < end && !mask[lastLine + 1] && lines[lastLine + 1].trim().startsWith('|')) {
      lastLine++;
    }
    return { headerLine: i, separatorLine: i + 1, lastLine };
  }
  return null;
}

/** Cells of a table row: outer pipes dropped, split on unescaped `|`, each cell trimmed. */
function splitRow(rawLine) {
  const inner = rawLine.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return inner.split(/(?<!\\)\|/).map((s) => s.trim());
}

/**
 * Parse the table found via `findTableBounds`. The line at `headerLine` is the header, the
 * separator row is skipped, every following row up to `lastLine` is data. Returns
 * `{ header: {line, cells}, rows: [{line, cells}] }`.
 */
export function parseTable(lines, bounds) {
  const header = { line: bounds.headerLine, cells: splitRow(lines[bounds.headerLine]) };
  const rows = [];
  for (let i = bounds.separatorLine + 1; i <= bounds.lastLine; i++) {
    rows.push({ line: i, cells: splitRow(lines[i]) });
  }
  return { header, rows };
}

/** Rebuild a data row line from cells, using this plugin's one-line-per-row shape. */
export function buildRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

/**
 * Regex matching a phase-field line such as `- **Goal:** ...` (the templates' bullet form) or
 * `**Goal:** ...` (accepted without the bullet).
 */
export function fieldLineRe(field) {
  return new RegExp(`^(?:[-*]\\s+)?\\*\\*${field}:\\*\\*`);
}

/** Replace one line in place. Mutates the array and returns it for chaining. */
export function replaceLine(lines, lineIdx, newLine) {
  lines[lineIdx] = newLine;
  return lines;
}

/**
 * Map a table's header cells to their column index by name, so callers never hard-code
 * positions. Returns e.g. `{ Phase: 0, Content: 1, Type: 2, Complexity: 3, Status: 4 }`. A
 * column that a document lacks is simply absent from the map -- callers must check with
 * `columns.Name != null`.
 */
export function mapColumns(headerCells) {
  const columns = {};
  headerCells.forEach((name, idx) => {
    columns[name] = idx;
  });
  return columns;
}

/**
 * Convenience: find the Phase Overview table and parse it into
 * `{ bounds, header, columns, rows: [{line, cells, phase, content, type, complexity, status}] }`,
 * or null if the section or its table is missing. `complexity` is `null` when the document's
 * table has no `Complexity` column.
 */
export function getPhaseTable(lines) {
  const section = findSection(lines, 'Phase Overview');
  if (!section) return null;
  const bounds = findTableBounds(lines, section.line, section.end);
  if (!bounds) return null;
  const { header, rows } = parseTable(lines, bounds);
  const columns = header ? mapColumns(header.cells) : {};
  return {
    section,
    bounds,
    header,
    columns,
    rows: rows.map((r) => ({
      line: r.line,
      cells: r.cells,
      phase: r.cells[columns.Phase],
      content: r.cells[columns.Content],
      type: r.cells[columns.Type],
      complexity: columns.Complexity != null ? r.cells[columns.Complexity] : null,
      status: r.cells[columns.Status],
    })),
  };
}

/**
 * Convenience: find the Commit Cut table and parse it into
 * `{ bounds, header, columns, rows: [{line, cells, commit, phase, content, hash}] }`, or null if
 * missing.
 */
export function getCommitTable(lines) {
  const section = findSection(lines, 'Commit Cut');
  if (!section) return null;
  const bounds = findTableBounds(lines, section.line, section.end);
  if (!bounds) return null;
  const { header, rows } = parseTable(lines, bounds);
  const columns = header ? mapColumns(header.cells) : {};
  return {
    section,
    bounds,
    header,
    columns,
    rows: rows.map((r) => ({
      line: r.line,
      cells: r.cells,
      commit: r.cells[columns.Commit],
      phase: r.cells[columns.Phase],
      content: r.cells[columns.Content],
      hash: r.cells[columns.Hash],
    })),
  };
}

/** Status values a phase can have. */
export const STATUS_OPEN = 'Open';
export const STATUS_IN_PROGRESS = 'In progress';
export const STATUS_DONE = 'Done';
export const PHASE_STATUS_VALUES = [STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_DONE];

/** Phase types: a planning-only session or an implementation session. */
export const PHASE_TYPE_VALUES = ['Plan', 'Implementation'];

/** Complexity levels phases are estimated on (see reference/complexity-rubric.md). */
export const PHASE_COMPLEXITY_VALUES = ['S', 'M', 'L', 'XL'];

/** Bold-marker field labels required in every `### Phase N — ...` body. */
export const REQUIRED_PHASE_FIELDS = ['Goal', 'Requires', 'Delivers', 'Files', 'Complexity'];

/** Case-insensitive placeholder phrases that make a plan a "plan failure". */
export const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /to be (?:added|defined|filled in|completed)(?: later)?/i,
  /(?:add|define|fill in|complete) (?:this )?later/i,
  /(?:similar|analogous) to (?:phase|step)/i,
  /same as (?:phase|step) \d/i,
  /appropriate error[- ]?handling/i,
  /details? (?:to follow|tbd)/i,
];
