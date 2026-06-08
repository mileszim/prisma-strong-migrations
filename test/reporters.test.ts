import { describe, expect, it } from 'vitest';
import { lint } from '../src/lint';
import { github, json, stylish } from '../src/reporters';
import { config, migrationFromSql } from './helpers';

const result = (sql: string) => lint([migrationFromSql(sql, 'm1')], config());

describe('stylish reporter', () => {
  it('reports a clean result', () => {
    expect(stylish(result('CREATE TABLE "User" ("id" INT);'))).toContain('No migration safety issues');
  });
  it('groups findings under the file and shows a summary', () => {
    const out = stripAnsi(stylish(result('DROP TABLE "User";')));
    expect(out).toContain('m1/migration.sql');
    expect(out).toContain('no-drop-table');
    expect(out).toContain('1 problem (1 error)');
  });
});

describe('json reporter', () => {
  it('emits a parseable summary and diagnostics', () => {
    const parsed = JSON.parse(json(result('DROP TABLE "User";')));
    expect(parsed.summary.errorCount).toBe(1);
    expect(parsed.diagnostics[0].rule).toBe('no-drop-table');
  });
});

describe('github reporter', () => {
  it('emits an error workflow command with the message escaped onto one line', () => {
    const out = github(result('DROP TABLE "User";'));
    const firstLine = out.split('\n')[0]!;
    expect(firstLine).toMatch(/^::error file=.*,line=1,col=1,title=/);
    // The whole message — including the Fix section — stays on the command line.
    expect(firstLine).toContain('%0AFix:');
  });
});

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\[\d+m/g, '');
}
