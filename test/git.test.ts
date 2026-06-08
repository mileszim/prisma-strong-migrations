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
});
