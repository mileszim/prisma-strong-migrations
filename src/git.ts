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
 * Prefers a three-dot diff (`base...HEAD`) so it reflects what the branch
 * changed since it diverged from base — the right comparison for a pull request.
 * Deleted files are excluded; only files that still exist on disk are returned.
 */
export function changedMigrationFiles(options: ChangedOptions): string[] {
  const cwd = options.cwd ?? process.cwd();
  const root = repoRoot(cwd);
  // Resolve symlinks on both sides so prefix matching is reliable (macOS maps
  // the temp dir through /private, and `git --show-toplevel` returns realpaths).
  const migrationsRoot = real(resolve(cwd, options.migrationsDir));

  const output = git(
    ['diff', '--diff-filter=d', '--name-only', ...diffRange(options.base, cwd)],
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

/**
 * Build the `git diff` revision argument for `base` versus `HEAD`.
 *
 * Fails loudly when `base` does not resolve: a missing base ref is the most
 * common reason changed-file detection silently finds nothing in CI (the
 * checkout was too shallow to include it). A safety linter must never quietly
 * scan zero files, so we surface an actionable error instead.
 *
 * Three-dot (`base...HEAD`) needs a common ancestor; shallow CI checkouts often
 * don't have one, where three-dot aborts with "no merge base". In that case we
 * fall back to a two-dot comparison of the two tips, which still surfaces files
 * the branch added or modified.
 */
function diffRange(base: string, cwd: string): string[] {
  if (!refExists(base, cwd)) {
    throw new Error(
      `Base ref "${base}" was not found. Changed-file detection needs it in history. ` +
        `In CI, fetch it first — set actions/checkout 'fetch-depth: 0' (or fetch the ` +
        `base branch before linting). Pass an explicit ref with --base to override.`,
    );
  }
  return hasMergeBase(base, cwd) ? [`${base}...HEAD`] : [`${base}..HEAD`];
}

/** Whether `ref` resolves to a commit in the current repository. */
function refExists(ref: string, cwd: string): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/** Whether `base` and `HEAD` share a common ancestor (false on shallow clones). */
function hasMergeBase(base: string, cwd: string): boolean {
  try {
    git(['merge-base', base, 'HEAD'], cwd);
    return true;
  } catch {
    return false;
  }
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
