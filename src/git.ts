import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export interface ChangedOptions {
  /** Git ref to diff against (e.g. `origin/main`). */
  base: string;
  /** Migrations directory, relative to `cwd`. */
  migrationsDir: string;
  cwd?: string;
}

export function isGitRepository(cwd = process.cwd()): boolean {
  try {
    git(['rev-parse', '--git-dir'], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Absolute paths of `migration.sql` files added or modified relative to `base`.
 *
 * Uses a three-dot diff (`base...HEAD`) so it reflects what the branch changed
 * since it diverged from base — the right comparison for a pull request. Deleted
 * files are excluded; only files that still exist on disk are returned.
 */
export function changedMigrationFiles(options: ChangedOptions): string[] {
  const cwd = options.cwd ?? process.cwd();
  const root = repoRoot(cwd);
  // Resolve symlinks on both sides so prefix matching is reliable (macOS maps
  // the temp dir through /private, and `git --show-toplevel` returns realpaths).
  const migrationsRoot = real(resolve(cwd, options.migrationsDir));

  const output = git(
    ['diff', '--diff-filter=d', '--name-only', `${options.base}...HEAD`],
    cwd,
  ).trim();
  if (!output) return [];

  const seen = new Set<string>();
  for (const line of output.split('\n')) {
    if (!line.endsWith('migration.sql')) continue;
    const absolute = resolve(root, line);
    if (existsSync(absolute) && isInside(real(absolute), migrationsRoot)) {
      seen.add(absolute);
    }
  }
  return [...seen].sort();
}

function repoRoot(cwd: string): string {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

/** Resolve symlinks, falling back to the input path if it doesn't exist. */
function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
