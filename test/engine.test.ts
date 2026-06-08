import { describe, expect, it } from 'vitest';
import { lintMigration } from '../src/engine';
import { config, migrationFromSql } from './helpers';

describe('engine', () => {
  it('applies the configured severity, not a hardcoded one', () => {
    const migration = migrationFromSql('DROP TABLE "User";');
    const [diagnostic] = lintMigration(migration, config({ 'no-drop-table': 'warning' }));
    expect(diagnostic!.rule).toBe('no-drop-table');
    expect(diagnostic!.severity).toBe('warning');
  });

  it('skips rules set to off', () => {
    const migration = migrationFromSql('DROP TABLE "User";');
    expect(lintMigration(migration, config({ 'no-drop-table': 'off' }))).toHaveLength(0);
  });

  it('runs only default-enabled rules with the default config', () => {
    // require-explicit-not-null is opt-in, so a bare column is not flagged.
    const migration = migrationFromSql('CREATE TABLE "User" ("id" SERIAL, "bio" TEXT);');
    expect(lintMigration(migration, config())).toHaveLength(0);
  });

  it('reports multiple distinct rules from one migration, sorted by location', () => {
    const sql = ['DROP TABLE "A";', 'ALTER TABLE "B" DROP COLUMN "c";'].join('\n');
    const diagnostics = lintMigration(migrationFromSql(sql), config());
    expect(diagnostics.map((d) => d.rule)).toEqual(['no-drop-table', 'no-drop-column']);
    expect(diagnostics[0]!.line).toBeLessThan(diagnostics[1]!.line);
  });

  it('surfaces parse errors as warning diagnostics', () => {
    const migration = migrationFromSql('THIS IS NOT VALID SQL;');
    const diagnostics = lintMigration(migration, config());
    const parseError = diagnostics.find((d) => d.rule === 'parse-error');
    expect(parseError).toBeDefined();
    expect(parseError!.severity).toBe('warning');
  });

  it('passes a realistic initial Prisma migration with default rules', () => {
    // The shape `prisma migrate dev` emits for an initial schema: create tables,
    // then their unique indexes and foreign keys — all on brand-new tables.
    const sql = [
      'CREATE TABLE "User" (',
      '    "id" SERIAL NOT NULL,',
      '    "email" TEXT NOT NULL,',
      '    "name" TEXT,',
      '    CONSTRAINT "User_pkey" PRIMARY KEY ("id")',
      ');',
      'CREATE TABLE "Post" (',
      '    "id" SERIAL NOT NULL,',
      '    "title" TEXT NOT NULL,',
      '    "authorId" INTEGER NOT NULL,',
      '    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")',
      ');',
      'CREATE UNIQUE INDEX "User_email_key" ON "User"("email");',
      'CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");',
      'ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    ].join('\n');
    expect(lintMigration(migrationFromSql(sql), config())).toHaveLength(0);
  });

  it('attaches migration name and file path to every diagnostic', () => {
    const migration = migrationFromSql('DROP TABLE "User";', '20240101_drop');
    const [diagnostic] = lintMigration(migration, config());
    expect(diagnostic!.migration).toBe('20240101_drop');
    expect(diagnostic!.file).toContain('20240101_drop');
  });
});
