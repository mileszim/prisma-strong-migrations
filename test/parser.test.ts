import { describe, expect, it } from 'vitest';
import { LineMap, parseSql, splitStatements } from '../src/parser';

describe('LineMap', () => {
  it('maps offsets to 1-based line and column', () => {
    const map = new LineMap('abc\ndefg\nhi');
    expect(map.locate(0)).toEqual({ line: 1, column: 1 });
    expect(map.locate(4)).toEqual({ line: 2, column: 1 });
    expect(map.locate(6)).toEqual({ line: 2, column: 3 });
    expect(map.locate(9)).toEqual({ line: 3, column: 1 });
  });
});

describe('splitStatements', () => {
  it('splits on top-level semicolons', () => {
    const chunks = splitStatements('SELECT 1; SELECT 2;');
    expect(chunks.map((c) => c.text.trim())).toEqual(['SELECT 1;', 'SELECT 2;']);
  });

  it('ignores semicolons inside string literals', () => {
    const chunks = splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;");
    expect(chunks).toHaveLength(2);
  });

  it('ignores semicolons inside line and block comments', () => {
    const sql = 'SELECT 1; -- a; comment\n/* b; block */ SELECT 2;';
    expect(splitStatements(sql)).toHaveLength(2);
  });

  it('ignores semicolons inside dollar-quoted strings', () => {
    const sql = "CREATE FUNCTION f() RETURNS int AS $$ BEGIN; RETURN 1; END; $$ LANGUAGE plpgsql; SELECT 1;";
    expect(splitStatements(sql)).toHaveLength(2);
  });
});

describe('parseSql', () => {
  it('parses Prisma-style DDL into statements with accurate line numbers', () => {
    const sql = [
      '-- CreateTable',
      'CREATE TABLE "User" (',
      '    "id" SERIAL NOT NULL,',
      '    CONSTRAINT "User_pkey" PRIMARY KEY ("id")',
      ');',
      '',
      '-- AlterTable',
      'ALTER TABLE "User" DROP COLUMN "id";',
    ].join('\n');

    const { statements, parseErrors } = parseSql(sql, 'postgresql');
    expect(parseErrors).toHaveLength(0);
    expect(statements.map((s) => s.kind)).toEqual(['create_table', 'alter_table']);
    // The ALTER starts on line 8, after the leading comment is skipped.
    expect(statements[1]!.line).toBe(8);
  });

  it('surfaces a parse error and still parses the rest of the file', () => {
    const sql = 'CREATE TABLE "A" ("id" INT); THIS IS NOT SQL; DROP TABLE "B";';
    const { statements, parseErrors } = parseSql(sql, 'postgresql');
    expect(parseErrors.length).toBeGreaterThan(0);
    const kinds = statements.map((s) => s.kind);
    expect(kinds).toContain('create_table');
    expect(kinds).toContain('drop_table');
  });
});
