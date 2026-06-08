import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../src/cli';

const UNSAFE = 'test/fixtures/migrations/20240102000000_unsafe_changes/migration.sql';
const SAFE = 'test/fixtures/migrations/20240103000000_safe_changes/migration.sql';

let stdout: string[];
let stderr: string[];

beforeEach(() => {
  stdout = [];
  stderr = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => void stdout.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => void stderr.push(a.join(' ')));
});

afterEach(() => vi.restoreAllMocks());

const out = () => stdout.join('\n');

describe('cli lint', () => {
  it('exits 1 and reports problems on an unsafe migration', async () => {
    const code = await run(['lint', UNSAFE]);
    expect(code).toBe(1);
    expect(out()).toContain('no-drop-table');
  });

  it('exits 0 on a safe migration', async () => {
    expect(await run(['lint', SAFE])).toBe(0);
  });

  it('supports the json reporter', async () => {
    await run(['lint', '--reporter', 'json', UNSAFE]);
    const parsed = JSON.parse(out());
    expect(parsed.summary.errorCount).toBeGreaterThan(0);
  });

  it('rejects an unknown reporter', async () => {
    expect(await run(['lint', '--reporter', 'nope', UNSAFE])).toBe(1);
    expect(stderr.join('\n')).toContain('Unknown reporter');
  });

  it('honours --fail-on warning', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'psm-cli-')), 'migration.sql');
    writeFileSync(file, 'CREATE INDEX "i" ON "User"("email");');
    expect(await run(['lint', file])).toBe(0); // a warning does not fail by default
    expect(await run(['lint', '--fail-on', 'warning', file])).toBe(1);
  });
});

describe('cli list-rules', () => {
  it('lists rules and exits 0', async () => {
    expect(await run(['list-rules'])).toBe(0);
    expect(out()).toContain('no-drop-table');
  });

  it('supports json output', async () => {
    await run(['list-rules', '--json']);
    const rules = JSON.parse(out());
    expect(rules.some((r: { name: string }) => r.name === 'no-drop-table')).toBe(true);
  });
});

describe('cli help and version', () => {
  it('returns 0 for --version', async () => {
    expect(await run(['--version'])).toBe(0);
  });
});
