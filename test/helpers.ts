import { parseSql } from '../src/parser';
import { lintMigration } from '../src/engine';
import { ALL_RULES } from '../src/rules';
import type { ResolvedConfig } from '../src/config';
import type { Diagnostic, Migration, ReportedSeverity, Severity } from '../src/types';

/** Build a Migration from raw SQL using the real parser. */
export function migrationFromSql(sql: string, name = 'test_migration'): Migration {
  const { statements, parseErrors } = parseSql(sql, 'postgresql');
  return {
    name,
    path: `/repo/prisma/migrations/${name}/migration.sql`,
    relativePath: `prisma/migrations/${name}/migration.sql`,
    sql,
    statements,
    parseErrors,
  };
}

/** A ResolvedConfig with the given per-rule overrides on top of the defaults. */
export function config(rules: Record<string, Severity> = {}, failOn: ReportedSeverity = 'error'): ResolvedConfig {
  const ruleSeverity = new Map<string, Severity>();
  for (const rule of ALL_RULES) {
    ruleSeverity.set(rule.name, rule.enabledByDefault ? rule.defaultSeverity : 'off');
  }
  for (const [name, severity] of Object.entries(rules)) ruleSeverity.set(name, severity);
  return { migrationsDir: './prisma/migrations', dialect: 'postgresql', failOn, ruleSeverity };
}

/** A ResolvedConfig with every rule off except the named one. */
export function onlyRule(name: string): ResolvedConfig {
  const ruleSeverity = new Map<string, Severity>();
  for (const rule of ALL_RULES) ruleSeverity.set(rule.name, 'off');
  const rule = ALL_RULES.find((r) => r.name === name);
  if (!rule) throw new Error(`Unknown rule in test: ${name}`);
  ruleSeverity.set(name, rule.defaultSeverity);
  return { migrationsDir: './prisma/migrations', dialect: 'postgresql', failOn: 'error', ruleSeverity };
}

/** Lint a SQL string and return the diagnostics from a single rule. */
export function findings(sql: string, ruleName: string): Diagnostic[] {
  return lintMigration(migrationFromSql(sql), onlyRule(ruleName));
}
