import { parse, type Statement } from 'sql-parser-cst';
import type { Dialect, ParseError, ParsedStatement, StatementKind } from './types';

/** Maps byte offsets in a source string to 1-based line/column positions. */
export class LineMap {
  /** Offset at which each line starts. `lineStarts[0]` is always 0. */
  private readonly lineStarts: number[];

  constructor(source: string) {
    const starts = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\n') starts.push(i + 1);
    }
    this.lineStarts = starts;
  }

  locate(offset: number): { line: number; column: number } {
    // Binary search for the last line start <= offset.
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - this.lineStarts[lo]! + 1 };
  }
}

const PARSE_OPTIONS = (dialect: Dialect) => ({
  dialect,
  includeRange: true as const,
  // Comments and whitespace are irrelevant to the rules; dropping them keeps
  // statement ranges tight to the SQL itself.
  includeComments: false,
});

interface ParseOutput {
  statements: ParsedStatement[];
  parseErrors: ParseError[];
  lineMap: LineMap;
}

/**
 * Parse a migration's SQL into top-level statements.
 *
 * The whole file is parsed at once when possible (the most accurate path). If
 * that fails — e.g. the file uses a construct the parser doesn't model — we fall
 * back to splitting on statement boundaries and parsing each independently, so a
 * single unparseable statement never blinds the linter to the rest of the file.
 */
export function parseSql(sql: string, dialect: Dialect): ParseOutput {
  const lineMap = new LineMap(sql);

  try {
    const program = parse(sql, PARSE_OPTIONS(dialect));
    const statements = program.statements
      .filter((node) => node.type !== 'empty')
      .map((node) => toParsedStatement(node, sql, lineMap));
    return { statements, parseErrors: [], lineMap };
  } catch {
    return parsePerStatement(sql, dialect, lineMap);
  }
}

function toParsedStatement(
  node: Statement,
  sql: string,
  lineMap: LineMap,
): ParsedStatement {
  const [start, end] = node.range ?? [0, 0];
  const { line, column } = lineMap.locate(start);
  return {
    kind: statementKind(node.type),
    text: sql.slice(start, end),
    line,
    column,
    offset: start,
    node,
  };
}

/** Fallback path: split into statements and parse each on its own. */
function parsePerStatement(
  sql: string,
  dialect: Dialect,
  lineMap: LineMap,
): ParseOutput {
  const statements: ParsedStatement[] = [];
  const parseErrors: ParseError[] = [];

  for (const chunk of splitStatements(sql)) {
    const text = chunk.text.trim();
    if (!text) continue;

    const { line, column } = lineMap.locate(chunk.offset);
    let node: Statement | null = null;
    try {
      const program = parse(chunk.text, PARSE_OPTIONS(dialect));
      node = program.statements.find((s) => s.type !== 'empty') ?? null;
    } catch (error) {
      parseErrors.push({
        message: error instanceof Error ? error.message.split('\n')[0]! : String(error),
        line,
        column,
      });
    }

    statements.push({
      kind: node ? statementKind(node.type) : inferKind(text),
      text,
      line,
      column,
      offset: chunk.offset,
      node,
    });
  }

  return { statements, parseErrors, lineMap };
}

interface Chunk {
  text: string;
  offset: number;
}

/**
 * Split SQL into statements on top-level semicolons, while respecting string
 * literals, quoted identifiers, line/block comments, and dollar-quoted strings.
 */
export function splitStatements(sql: string): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let i = 0;

  const push = (end: number) => {
    if (sql.slice(start, end).trim()) chunks.push({ text: sql.slice(start, end), offset: start });
    start = end;
  };

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      i = indexOrEnd(sql, '\n', i + 2);
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? sql.length : close + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i = skipQuoted(sql, i, ch);
      continue;
    }
    if (ch === '$') {
      const tag = dollarTag(sql, i);
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        i = close === -1 ? sql.length : close + tag.length;
        continue;
      }
    }
    if (ch === ';') {
      push(i + 1);
      i++;
      continue;
    }
    i++;
  }
  push(sql.length);
  return chunks;
}

/** A comment found in the SQL, with the 1-based line it begins on. */
export interface SqlComment {
  /** Comment body, without the surrounding line- or block-comment markers. */
  text: string;
  line: number;
}

/**
 * Extract every line (`--`) and block comment from the SQL, with line numbers.
 *
 * Uses the same scanner as {@link splitStatements} so that string literals,
 * quoted identifiers and dollar-quoted bodies are skipped — text that merely
 * looks like a comment inside a string is never reported as one. This is what
 * suppression directives are read from.
 */
export function scanComments(sql: string): SqlComment[] {
  const comments: SqlComment[] = [];
  let i = 0;
  let line = 1;
  const advance = (to: number) => {
    for (let j = i; j < to; j++) if (sql[j] === '\n') line++;
    i = to;
  };

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === '-' && next === '-') {
      const end = indexOrEnd(sql, '\n', i + 2);
      comments.push({ text: sql.slice(i + 2, end), line });
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      const bodyEnd = close === -1 ? sql.length : close;
      comments.push({ text: sql.slice(i + 2, bodyEnd), line });
      advance(close === -1 ? sql.length : close + 2);
      continue;
    }
    if (ch === "'" || ch === '"') {
      advance(skipQuoted(sql, i, ch));
      continue;
    }
    if (ch === '$') {
      const tag = dollarTag(sql, i);
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        advance(close === -1 ? sql.length : close + tag.length);
        continue;
      }
    }
    i++;
  }
  return comments;
}

function indexOrEnd(sql: string, needle: string, from: number): number {
  const idx = sql.indexOf(needle, from);
  return idx === -1 ? sql.length : idx;
}

/** Skip a `'…'` or `"…"` literal, handling doubled-quote escapes. */
function skipQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2; // escaped quote
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return sql.length;
}

/** Return the dollar-quote tag starting at `i` (e.g. `$$` or `$tag$`), or null. */
function dollarTag(sql: string, i: number): string | null {
  const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64));
  return match ? match[0] : null;
}

const KIND_BY_TYPE: Record<string, StatementKind> = {
  create_table_stmt: 'create_table',
  alter_table_stmt: 'alter_table',
  drop_table_stmt: 'drop_table',
  create_index_stmt: 'create_index',
  drop_index_stmt: 'drop_index',
  insert_stmt: 'insert',
  update_stmt: 'update',
  delete_stmt: 'delete',
  select_stmt: 'select',
  compound_select_stmt: 'select',
};

function statementKind(type: string): StatementKind {
  return KIND_BY_TYPE[type] ?? 'other';
}

/** Best-effort statement kind from raw text, used only when parsing failed. */
function inferKind(text: string): StatementKind {
  const head = text.trimStart().toUpperCase();
  if (head.startsWith('CREATE') && head.includes('INDEX')) return 'create_index';
  if (head.startsWith('DROP') && head.includes('INDEX')) return 'drop_index';
  if (head.startsWith('CREATE TABLE')) return 'create_table';
  if (head.startsWith('ALTER TABLE')) return 'alter_table';
  if (head.startsWith('DROP TABLE')) return 'drop_table';
  if (head.startsWith('INSERT')) return 'insert';
  if (head.startsWith('UPDATE')) return 'update';
  if (head.startsWith('DELETE')) return 'delete';
  if (head.startsWith('SELECT')) return 'select';
  return 'other';
}
