import { describe, expect, it } from 'vitest';
import { lint } from '../src/lint';
import { parseSuppressions } from '../src/suppressions';
import { config, migrationFromSql } from './helpers';

/** Lint a SQL string with the default ruleset and return the full result. */
function run(sql: string) {
  return lint([migrationFromSql(sql, 'm')], config());
}

describe('parseSuppressions', () => {
  it('parses a directive with rules and a reason', () => {
    const [s] = parseSuppressions('-- psm-disable-next-line no-drop-table, no-set-not-null -- removed in #123\n');
    expect(s).toMatchObject({
      kind: 'next-line',
      rules: ['no-drop-table', 'no-set-not-null'],
      reason: 'removed in #123',
      line: 1,
    });
  });

  it('treats a bare directive as "all rules" with no reason', () => {
    const [s] = parseSuppressions('-- psm-disable-file\n');
    expect(s).toMatchObject({ kind: 'file', rules: [], reason: undefined });
  });

  it('accepts a colon as the reason separator', () => {
    const [s] = parseSuppressions('-- psm-ignore: safe, code already removed\n');
    expect(s).toMatchObject({ kind: 'next-line', rules: [], reason: 'safe, code already removed' });
  });

  it('does not read directives out of string literals', () => {
    const sql = `INSERT INTO "t" ("c") VALUES ('-- psm-disable-next-line no-drop-table');`;
    expect(parseSuppressions(sql)).toHaveLength(0);
  });

  it('reads directives from block comments', () => {
    const [s] = parseSuppressions('/* psm-disable-file no-drop-table */\n');
    expect(s).toMatchObject({ kind: 'file', rules: ['no-drop-table'] });
  });
});

describe('applying suppressions', () => {
  it('disable-next-line silences the statement below', () => {
    const result = run('-- psm-disable-next-line no-drop-table\nDROP TABLE "User";');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]!.rule).toBe('no-drop-table');
  });

  it('the psm-ignore alias works the same way', () => {
    const result = run('-- psm-ignore\nDROP TABLE "User";');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.suppressed).toHaveLength(1);
  });

  it('only silences the named rules', () => {
    const result = run('-- psm-disable-next-line no-rename-column\nDROP TABLE "User";');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.rule).toBe('no-drop-table');
    expect(result.suppressed).toHaveLength(0);
  });

  it('a trailing disable-line silences the statement on that line', () => {
    const result = run('DROP TABLE "User"; -- psm-disable-line no-drop-table');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.suppressed).toHaveLength(1);
  });

  it('disable-file silences every statement', () => {
    const result = run('-- psm-disable-file\nDROP TABLE "A";\nDROP TABLE "B";');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.suppressed).toHaveLength(2);
  });

  it('captures the reason on the suppressed finding', () => {
    const result = run('-- psm-disable-next-line no-drop-table -- code removed in #123\nDROP TABLE "User";');
    expect(result.suppressed[0]!.reason).toBe('code removed in #123');
  });

  it('covers a multi-line statement, not just its first line', () => {
    const result = run('-- psm-disable-next-line no-rename-column\nALTER TABLE "User"\n  RENAME COLUMN "id" TO "uid";');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]!.rule).toBe('no-rename-column');
  });

  it('block disable/enable silences only statements inside the block', () => {
    const result = run(
      '-- psm-disable no-drop-table\nDROP TABLE "A";\n-- psm-enable no-drop-table\nDROP TABLE "B";',
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.migration).toBe('m');
    expect(result.diagnostics[0]!.line).toBe(4); // the second DROP, after the block re-enabled
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]!.line).toBe(2);
  });

  it('leaves findings untouched when there are no directives', () => {
    const result = run('DROP TABLE "User";');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.suppressed).toHaveLength(0);
  });
});
