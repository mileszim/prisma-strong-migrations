import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { changedMigrationFiles, isGitRepository } from '../src/git';

const repo = mkdtempSync(join(tmpdir(), 'psm-git-'));
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });

function addMigration(name: string, sql: string): void {
  const dir = join(repo, 'prisma', 'migrations', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'migration.sql'), sql);
}

beforeAll(() => {
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  addMigration('20240101000000_init', 'CREATE TABLE "User" ("id" INT);');
  git('add', '-A');
  git('commit', '-m', 'init');

  git('checkout', '-b', 'feature');
  addMigration('20240102000000_drop', 'DROP TABLE "User";');
  git('add', '-A');
  git('commit', '-m', 'drop');
});

describe('isGitRepository', () => {
  it('is true inside a repo and false outside', () => {
    expect(isGitRepository(repo)).toBe(true);
    expect(isGitRepository(tmpdir())).toBe(false);
  });
});

describe('changedMigrationFiles', () => {
  it('returns only migrations added since the base ref', () => {
    const changed = changedMigrationFiles({ base: 'main', migrationsDir: 'prisma/migrations', cwd: repo });
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain('20240102000000_drop');
  });

  it('returns nothing when the branch matches base', () => {
    const changed = changedMigrationFiles({ base: 'feature', migrationsDir: 'prisma/migrations', cwd: repo });
    expect(changed).toHaveLength(0);
  });

  it('throws an actionable error when the base ref does not exist', () => {
    expect(() =>
      changedMigrationFiles({ base: 'origin/missing', migrationsDir: 'prisma/migrations', cwd: repo }),
    ).toThrow(/Base ref "origin\/missing" was not found/);
  });
});

// Mirrors a default (shallow) CI checkout: the base ref is present but shares no
// common ancestor with HEAD in the fetched history, so three-dot diffs abort.
// Detection must fall back to a two-dot comparison instead of failing.
describe('changedMigrationFiles on a shallow checkout', () => {
  const remote = mkdtempSync(join(tmpdir(), 'psm-remote-'));
  const clone = mkdtempSync(join(tmpdir(), 'psm-clone-'));
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'ignore' });

  function write(root: string, relPath: string, contents: string): void {
    const file = join(root, relPath);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents);
  }

  beforeAll(() => {
    git(remote, 'init', '-b', 'main');
    git(remote, 'config', 'user.email', 'test@example.com');
    git(remote, 'config', 'user.name', 'Test');
    git(remote, 'config', 'commit.gpgsign', 'false');
    // A: init migration on main.
    write(remote, 'prisma/migrations/20240101000000_init/migration.sql', 'CREATE TABLE "User" ("id" INT);');
    git(remote, 'add', '-A');
    git(remote, 'commit', '-m', 'init');
    // B: feature branches from A and adds a migration.
    git(remote, 'checkout', '-b', 'feature');
    write(remote, 'prisma/migrations/20240202000000_drop/migration.sql', 'DROP TABLE "User";');
    git(remote, 'add', '-A');
    git(remote, 'commit', '-m', 'drop');
    // C: main advances with an unrelated (non-migration) change.
    git(remote, 'checkout', 'main');
    write(remote, 'README.md', 'docs');
    git(remote, 'add', '-A');
    git(remote, 'commit', '-m', 'docs');

    // Shallow-fetch both tips at depth 1, so the common ancestor A is absent.
    git(clone, 'init', '-b', 'main');
    git(clone, 'remote', 'add', 'origin', remote);
    git(
      clone,
      'fetch',
      '--depth=1',
      'origin',
      '+refs/heads/main:refs/remotes/origin/main',
      '+refs/heads/feature:refs/remotes/origin/feature',
    );
    git(clone, 'checkout', '--detach', 'refs/remotes/origin/feature');
  });

  it('falls back to a two-dot diff and still finds the changed migration', () => {
    const changed = changedMigrationFiles({
      base: 'origin/main',
      migrationsDir: 'prisma/migrations',
      cwd: clone,
    });
    expect(changed.some((file) => file.includes('20240202000000_drop'))).toBe(true);
  });
});
