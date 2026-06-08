import type { ResolvedConfig } from './config';
import { LineMap } from './parser';
import { ALL_RULES } from './rules';
import type { Diagnostic, Migration, ReportedSeverity, Rule, RuleContext } from './types';

/** Run every active rule against one migration. */
export function lintMigration(migration: Migration, config: ResolvedConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lineMap = new LineMap(migration.sql);
  const locate = (offset: number) => lineMap.locate(offset);

  // Surface anything the parser couldn't read rather than silently ignoring it.
  for (const parseError of migration.parseErrors) {
    diagnostics.push({
      rule: 'parse-error',
      category: 'correctness',
      severity: 'warning',
      message: `Could not parse SQL: ${parseError.message}`,
      detail: 'This statement was skipped, so rules could not check it. The rest of the file was still analysed.',
      migration: migration.name,
      file: migration.relativePath,
      line: parseError.line,
      column: parseError.column,
    });
  }

  for (const rule of ALL_RULES) {
    const severity = config.ruleSeverity.get(rule.name);
    if (!severity || severity === 'off') continue;
    if (rule.dialects && !rule.dialects.includes(config.dialect)) continue;
    runRule(rule, severity, migration, config, locate, diagnostics);
  }

  return sortDiagnostics(diagnostics);
}

function runRule(
  rule: Rule,
  severity: ReportedSeverity,
  migration: Migration,
  config: ResolvedConfig,
  locate: (offset: number) => { line: number; column: number },
  out: Diagnostic[],
): void {
  const context: RuleContext = {
    migration,
    dialect: config.dialect,
    statements: migration.statements,
    locate,
    report(finding) {
      const { line, column } = resolveLocation(finding, locate);
      out.push({
        rule: rule.name,
        category: rule.category,
        severity,
        message: finding.message,
        detail: finding.detail,
        suggestion: finding.suggestion,
        migration: migration.name,
        file: migration.relativePath,
        line,
        column,
      });
    },
  };

  try {
    rule.check(context);
  } catch (error) {
    out.push({
      rule: rule.name,
      category: rule.category,
      severity: 'warning',
      message: `Rule "${rule.name}" failed to run: ${error instanceof Error ? error.message : String(error)}`,
      migration: migration.name,
      file: migration.relativePath,
      line: 1,
      column: 1,
    });
  }
}

function resolveLocation(
  finding: Parameters<RuleContext['report']>[0],
  locate: (offset: number) => { line: number; column: number },
): { line: number; column: number } {
  if (finding.line != null) {
    return { line: finding.line, column: finding.column ?? 1 };
  }
  const range = (finding.node as { range?: [number, number] } | null | undefined)?.range;
  if (range) return locate(range[0]);
  return { line: finding.statement.line, column: finding.statement.column };
}

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.column - b.column ||
      a.rule.localeCompare(b.rule),
  );
}
