import type { Node, Statement } from 'sql-parser-cst';

/**
 * SQL dialects the linter understands. Only `postgresql` has dedicated safety
 * rules today, but the type is a union so additional dialects can be added
 * without changing rule signatures.
 */
export type Dialect = 'postgresql';

/** Effective severity of a diagnostic. `off` disables a rule entirely. */
export type Severity = 'error' | 'warning' | 'off';

/** Severity a diagnostic can actually be emitted with (never `off`). */
export type ReportedSeverity = Exclude<Severity, 'off'>;

/**
 * Why a rule exists. Categories map to the real failure modes that make a
 * migration dangerous, not to arbitrary buckets.
 */
export type RuleCategory =
  | 'destructive' // irreversible data loss
  | 'backwards-incompatible' // breaks the previously deployed app during a rolling deploy
  | 'locking' // takes heavy locks / rewrites or scans a table, risking downtime
  | 'correctness' // likely to fail outright when applied to a populated table
  | 'opinionated'; // stylistic / policy preferences, disabled by default

/** A single parsed SQL statement within a migration file. */
export interface ParsedStatement {
  /** Normalised statement kind, e.g. `alter_table`, `create_index`, `drop_table`. */
  kind: StatementKind;
  /** The raw SQL text of just this statement. */
  text: string;
  /** 1-based line where the statement begins in the file. */
  line: number;
  /** 1-based column where the statement begins. */
  column: number;
  /** Byte offset of the statement within the file. */
  offset: number;
  /** The parsed CST node, or `null` if this statement could not be parsed. */
  node: Statement | null;
}

export type StatementKind =
  | 'create_table'
  | 'alter_table'
  | 'drop_table'
  | 'rename_table'
  | 'create_index'
  | 'drop_index'
  | 'insert'
  | 'update'
  | 'delete'
  | 'select'
  | 'other';

/** A failure to parse part of a migration, surfaced rather than swallowed. */
export interface ParseError {
  message: string;
  line: number;
  column: number;
}

/** One Prisma migration file (`<timestamp>_<name>/migration.sql`). */
export interface Migration {
  /** Migration name, e.g. `20240101120000_add_users`. */
  name: string;
  /** Absolute path to the `migration.sql` file. */
  path: string;
  /** Path relative to the working directory, for display. */
  relativePath: string;
  /** Full file contents. */
  sql: string;
  statements: ParsedStatement[];
  parseErrors: ParseError[];
}

/** A finding produced by a rule. The engine enriches it into a {@link Diagnostic}. */
export interface Finding {
  /** Human-readable description of the problem. */
  message: string;
  /**
   * The statement the finding relates to. Used to derive a location when
   * `node`/`line` are not given.
   */
  statement: ParsedStatement;
  /** A more specific CST node to point at (its location overrides the statement's). */
  node?: Node | null;
  /** Explicit 1-based line override. */
  line?: number;
  /** Explicit 1-based column override. */
  column?: number;
  /** Why this is dangerous. */
  detail?: string;
  /** How to do it safely instead. */
  suggestion?: string;
}

/** The API a rule receives. Rules call {@link RuleContext.report} for each problem. */
export interface RuleContext {
  migration: Migration;
  dialect: Dialect;
  /** All statements in the file (for cross-statement checks). */
  statements: ParsedStatement[];
  /** Resolve a CST node or offset to a 1-based `{ line, column }`. */
  locate(offset: number): { line: number; column: number };
  report(finding: Finding): void;
}

export interface Rule {
  /** Stable kebab-case identifier, e.g. `no-drop-column`. */
  name: string;
  category: RuleCategory;
  /** Severity used when the user has not overridden it. */
  defaultSeverity: ReportedSeverity;
  /** Whether the rule runs when the user provides no configuration for it. */
  enabledByDefault: boolean;
  /** One-line summary shown by `list-rules`. */
  description: string;
  /** Link to the rule's documentation. */
  docsUrl?: string;
  /** Dialects the rule applies to. Defaults to all when omitted. */
  dialects?: Dialect[];
  check(context: RuleContext): void;
}

/** A fully-resolved problem ready to be reported. */
export interface Diagnostic {
  rule: string;
  category: RuleCategory;
  severity: ReportedSeverity;
  message: string;
  detail?: string;
  suggestion?: string;
  /** Migration name. */
  migration: string;
  /** Relative path to the migration file. */
  file: string;
  line: number;
  column: number;
}

/** A diagnostic that was silenced by an inline `psm-` suppression directive. */
export interface SuppressedDiagnostic extends Diagnostic {
  /** Reason given on the suppressing comment, if one was provided. */
  reason?: string;
}

export interface LintResult {
  diagnostics: Diagnostic[];
  /**
   * Findings that fired but were silenced by an inline suppression comment.
   * Surfaced (not hidden) so suppressions stay auditable.
   */
  suppressed: SuppressedDiagnostic[];
  /** Number of migration files inspected. */
  filesChecked: number;
  errorCount: number;
  warningCount: number;
  /** Statements that could not be parsed (surfaced, not hidden). */
  parseErrorCount: number;
}
