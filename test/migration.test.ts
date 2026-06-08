import { describe, expect, it } from 'vitest';
import { findMigrationFiles, loadMigration, loadMigrations } from '../src/migration';

const FIXTURES = 'test/fixtures/migrations';

describe('migration loading', () => {
  it('discovers every migration.sql, sorted', () => {
    const files = findMigrationFiles(FIXTURES);
    expect(files).toHaveLength(3);
    expect(files.every((f) => f.endsWith('migration.sql'))).toBe(true);
    expect([...files]).toEqual([...files].sort());
  });

  it('derives the migration name from the directory', () => {
    const [first] = loadMigrations(FIXTURES, 'postgresql');
    expect(first!.name).toBe('20240101000000_init_users');
  });

  it('parses statements from a fixture file', () => {
    const files = findMigrationFiles(FIXTURES);
    const unsafe = files.find((f) => f.includes('unsafe'))!;
    const migration = loadMigration(unsafe, 'postgresql');
    expect(migration.statements.length).toBeGreaterThan(0);
    expect(migration.statements.some((s) => s.kind === 'drop_table')).toBe(true);
    expect(migration.parseErrors).toHaveLength(0);
  });
});
