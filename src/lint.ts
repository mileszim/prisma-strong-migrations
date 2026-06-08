import { loadConfig, type ResolvedConfig, type UserConfig } from './config';
import { lintMigration } from './engine';
import { changedMigrationFiles, isGitRepository } from './git';
import { loadMigration, loadMigrations } from './migration';
import type { Diagnostic, LintResult, Migration, ReportedSeverity } from './types';

/** Run all active rules against a set of already-loaded migrations. */
export function lint(migrations: Migration[], config: ResolvedConfig): LintResult {
  const diagnostics: Diagnostic[] = [];
  let parseErrorCount = 0;

  for (const migration of migrations) {
    parseErrorCount += migration.parseErrors.length;
    diagnostics.push(...lintMigration(migration, config));
  }

  return {
    diagnostics,
    filesChecked: migrations.length,
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
    parseErrorCount,
  };
}

export interface LintProjectOptions {
  /** Path to an explicit config file. */
  configPath?: string;
  /** Inline overrides (e.g. from CLI flags), applied over the config file. */
  overrides?: Partial<UserConfig>;
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Only lint these migration files (absolute or cwd-relative paths). */
  files?: string[];
  /** Only lint migrations changed since this git ref (PR-style three-dot diff). */
  changedSince?: string;
}

/**
 * Load configuration and migrations from disk and lint them. The main entry
 * point for both the CLI and programmatic use.
 */
export function lintProject(options: LintProjectOptions = {}): {
  result: LintResult;
  config: ResolvedConfig;
} {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig({ configPath: options.configPath, overrides: options.overrides, cwd });
  const files = resolveFiles(options, config, cwd);
  const migrations = files
    ? files.map((file) => loadMigration(file, config.dialect, cwd))
    : loadMigrations(config.migrationsDir, config.dialect, cwd);
  return { result: lint(migrations, config), config };
}

function resolveFiles(
  options: LintProjectOptions,
  config: ResolvedConfig,
  cwd: string,
): string[] | undefined {
  if (options.files) return options.files;
  if (options.changedSince) {
    if (!isGitRepository(cwd)) {
      throw new Error('Not a git repository, so changed migrations cannot be detected.');
    }
    return changedMigrationFiles({ base: options.changedSince, migrationsDir: config.migrationsDir, cwd });
  }
  return undefined;
}

/** Whether the result should fail the run, given the configured `failOn` level. */
export function shouldFail(result: LintResult, failOn: ReportedSeverity): boolean {
  if (result.errorCount > 0) return true;
  return failOn === 'warning' && result.warningCount > 0;
}
