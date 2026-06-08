import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig, ConfigError } from '../src/config';

const dir = mkdtempSync(join(tmpdir(), 'psm-config-'));
let counter = 0;

/** Write a JSON config to a temp file and return its path. */
function writeConfig(config: unknown): string {
  const path = join(dir, `config-${counter++}.json`);
  writeFileSync(path, JSON.stringify(config));
  return path;
}

afterAll(() => {
  // mkdtemp dirs live under the OS temp dir; leaving them is harmless.
});

describe('loadConfig', () => {
  it('falls back to defaults for an empty config', () => {
    const config = loadConfig({ configPath: writeConfig({}) });
    expect(config.migrationsDir).toBe('./prisma/migrations');
    expect(config.dialect).toBe('postgresql');
    expect(config.failOn).toBe('error');
  });

  it('disables opt-in rules by default and enables safety rules', () => {
    const config = loadConfig({ configPath: writeConfig({}) });
    expect(config.ruleSeverity.get('no-drop-table')).toBe('error');
    expect(config.ruleSeverity.get('require-pii-comment')).toBe('off');
  });

  it('applies string, boolean, and object rule settings', () => {
    const config = loadConfig({
      configPath: writeConfig({
        rules: {
          'no-drop-table': 'warning',
          'no-drop-column': false,
          'require-pii-comment': true,
          'no-set-not-null': { severity: 'error' },
        },
      }),
    });
    expect(config.ruleSeverity.get('no-drop-table')).toBe('warning');
    expect(config.ruleSeverity.get('no-drop-column')).toBe('off');
    expect(config.ruleSeverity.get('require-pii-comment')).toBe('warning'); // its default severity
    expect(config.ruleSeverity.get('no-set-not-null')).toBe('error');
  });

  it('lets explicit overrides win over the config file', () => {
    const config = loadConfig({
      configPath: writeConfig({ migrationsDir: './db/migrations', failOn: 'warning' }),
      overrides: { failOn: 'error' },
    });
    expect(config.migrationsDir).toBe('./db/migrations');
    expect(config.failOn).toBe('error');
  });

  it('rejects an unknown rule name', () => {
    expect(() => loadConfig({ configPath: writeConfig({ rules: { 'no-such-rule': 'error' } }) })).toThrow(ConfigError);
  });

  it('rejects an invalid severity', () => {
    expect(() => loadConfig({ configPath: writeConfig({ rules: { 'no-drop-table': 'fatal' } }) })).toThrow(ConfigError);
  });

  it('rejects an unsupported dialect', () => {
    expect(() => loadConfig({ configPath: writeConfig({ dialect: 'mysql' }) })).toThrow(ConfigError);
  });
});
