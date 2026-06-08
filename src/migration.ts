import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import type { Dialect, Migration } from './types';
import { parseSql } from './parser';

/** Find every Prisma `migration.sql` under `migrationsDir`, sorted by name. */
export function findMigrationFiles(migrationsDir: string, cwd = process.cwd()): string[] {
  const base = resolve(cwd, migrationsDir);
  return globSync('**/migration.sql', { cwd: base, absolute: true, nodir: true }).sort();
}

/** Read and parse a single `migration.sql` file. */
export function loadMigration(filePath: string, dialect: Dialect, cwd = process.cwd()): Migration {
  const absolute = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  const sql = readFileSync(absolute, 'utf8');
  const { statements, parseErrors } = parseSql(sql, dialect);

  return {
    name: migrationName(absolute),
    path: absolute,
    relativePath: relativePath(absolute, cwd),
    sql,
    statements,
    parseErrors,
  };
}

/** Load and parse every migration found under `migrationsDir`. */
export function loadMigrations(migrationsDir: string, dialect: Dialect, cwd = process.cwd()): Migration[] {
  return findMigrationFiles(migrationsDir, cwd).map((file) => loadMigration(file, dialect, cwd));
}

/** Derive the migration name from the path (`…/<name>/migration.sql` → `<name>`). */
function migrationName(filePath: string): string {
  const dir = basename(dirname(filePath));
  return dir && dir !== '.' ? dir : basename(filePath);
}

function relativePath(filePath: string, cwd: string): string {
  const rel = relative(cwd, filePath);
  return rel.startsWith('..') ? filePath : rel;
}
