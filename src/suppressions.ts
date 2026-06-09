import { scanComments } from './parser';
import type { Diagnostic, ParsedStatement, SuppressedDiagnostic } from './types';

/**
 * Inline suppression directives, written as SQL comments, that silence findings
 * the author has judged safe. Modelled on `eslint-disable` and tuned to the way
 * migrations read top to bottom.
 *
 * Syntax (in a `--` line comment or a block comment):
 *
 *   -- psm-disable-next-line [rules] [-- reason]   the statement below
 *   -- psm-disable-line      [rules] [-- reason]   the statement on this line
 *   -- psm-disable-file      [rules] [-- reason]   the whole file
 *   -- psm-disable           [rules]               from here…
 *   -- psm-enable            [rules]               …until here
 *
 * `rules` is an optional space/comma-separated list of rule names; omit it to
 * suppress every rule. `reason` (after ` -- ` or `:`) is free text. `psm-ignore`
 * and `psm-ignore-file` are accepted as aliases for the next-line and file forms.
 */
export type SuppressionKind = 'next-line' | 'line' | 'file' | 'block-disable' | 'block-enable';

export interface Suppression {
  kind: SuppressionKind;
  /** Rule names this directive targets. Empty means "all rules". */
  rules: string[];
  /** 1-based line the directive comment begins on. */
  line: number;
  /** Optional human explanation of why the finding is acceptable. */
  reason?: string;
}

export interface SuppressionResult {
  /** Diagnostics that survived (were not suppressed). */
  kept: Diagnostic[];
  /** Diagnostics that an inline directive silenced. */
  suppressed: SuppressedDiagnostic[];
}

const KEYWORD_TO_KIND: Record<string, SuppressionKind> = {
  'disable-next-line': 'next-line',
  ignore: 'next-line',
  'disable-line': 'line',
  'disable-file': 'file',
  'ignore-file': 'file',
  disable: 'block-disable',
  enable: 'block-enable',
};

// Longer keywords first so `disable` doesn't shadow `disable-next-line`.
const DIRECTIVE =
  /\bpsm-(disable-next-line|disable-line|disable-file|ignore-file|disable|enable|ignore)\b[ \t]*([^\r\n]*)/i;

/** Read all suppression directives from a migration's SQL. */
export function parseSuppressions(sql: string): Suppression[] {
  const suppressions: Suppression[] = [];
  for (const comment of scanComments(sql)) {
    const match = DIRECTIVE.exec(comment.text);
    if (!match) continue;
    const kind = KEYWORD_TO_KIND[match[1]!.toLowerCase()]!;
    const { rules, reason } = parseRest(match[2] ?? '');
    suppressions.push({ kind, rules, reason, line: comment.line });
  }
  return suppressions;
}

/** Split a directive's tail into rule names and an optional ` -- `/`:` reason. */
function parseRest(rest: string): { rules: string[]; reason?: string } {
  const trimmed = rest.trim();
  const reasonMatch = /(?:\s+--\s+|:\s*)(.+)$/.exec(trimmed);
  const reason = reasonMatch ? reasonMatch[1]!.trim() : undefined;
  const rulesText = reasonMatch ? trimmed.slice(0, reasonMatch.index).trim() : trimmed;
  const rules = rulesText ? rulesText.split(/[\s,]+/).filter(Boolean) : [];
  return { rules, reason: reason || undefined };
}

interface LineRange {
  from: number;
  to: number;
}

/**
 * Partition diagnostics into those a directive silences and those that remain.
 *
 * Each directive covers a line range (a statement, the file, or a block), and a
 * diagnostic is suppressed when it falls inside a covering range whose rule
 * filter matches. Directives are resolved against statement boundaries so a
 * `disable-next-line` above a multi-line statement covers the whole statement,
 * not just its first line.
 */
export function applySuppressions(
  diagnostics: Diagnostic[],
  suppressions: Suppression[],
  statements: ParsedStatement[],
  totalLines: number,
): SuppressionResult {
  if (suppressions.length === 0) return { kept: diagnostics, suppressed: [] };

  const ranges = statementRanges(statements);
  const covers = suppressions
    .map((suppression) => ({ suppression, range: coverage(suppression, ranges, suppressions, totalLines) }))
    .filter((c): c is { suppression: Suppression; range: LineRange } => c.range !== null);

  const kept: Diagnostic[] = [];
  const suppressed: SuppressedDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const hit = covers.find(
      ({ suppression, range }) =>
        diagnostic.line >= range.from &&
        diagnostic.line <= range.to &&
        (suppression.rules.length === 0 || suppression.rules.includes(diagnostic.rule)),
    );
    if (hit) suppressed.push({ ...diagnostic, reason: hit.suppression.reason });
    else kept.push(diagnostic);
  }
  return { kept, suppressed };
}

/** The line range each directive covers, or null if it covers nothing itself. */
function coverage(
  suppression: Suppression,
  ranges: LineRange[],
  all: Suppression[],
  totalLines: number,
): LineRange | null {
  switch (suppression.kind) {
    case 'file':
      return { from: 1, to: totalLines };
    case 'next-line': {
      const stmt = ranges.find((r) => r.from > suppression.line);
      return stmt ?? { from: suppression.line + 1, to: suppression.line + 1 };
    }
    case 'line': {
      const stmt = ranges.find((r) => r.from <= suppression.line && suppression.line <= r.to);
      return stmt ?? { from: suppression.line, to: suppression.line };
    }
    case 'block-disable': {
      const enable = all.find((o) => o.kind === 'block-enable' && o.line > suppression.line);
      return { from: suppression.line, to: enable ? enable.line : totalLines };
    }
    case 'block-enable':
      return null;
  }
}

/** Map each statement to the line range it spans. */
function statementRanges(statements: ParsedStatement[]): LineRange[] {
  return statements.map((stmt) => ({
    from: stmt.line,
    to: stmt.line + (stmt.text.match(/\n/g)?.length ?? 0),
  }));
}
