import { cosmiconfigSync } from 'cosmiconfig';
import type { Dialect, ReportedSeverity, Severity } from './types';
import { ALL_RULES, getRule } from './rules';

/** A per-rule override: a severity, a boolean toggle, or an object form. */
export type RuleSetting = Severity | boolean | { severity?: Severity; enabled?: boolean };

/** The shape users write in their config file. All fields optional. */
export interface UserConfig {
  /** Directory holding Prisma migrations. Default: `./prisma/migrations`. */
  migrationsDir?: string;
  /** SQL dialect of the migrations. Default: `postgresql`. */
  dialect?: Dialect;
  /** Lowest severity that should fail the run. Default: `error`. */
  failOn?: ReportedSeverity;
  /** Per-rule overrides, keyed by rule name. */
  rules?: Record<string, RuleSetting>;
}

export interface ResolvedConfig {
  migrationsDir: string;
  dialect: Dialect;
  failOn: ReportedSeverity;
  /** Effective severity for every rule (`off` means disabled). */
  ruleSeverity: Map<string, Severity>;
  /** Path of the config file that was loaded, if any. */
  filepath?: string;
}

const DEFAULTS = {
  migrationsDir: './prisma/migrations',
  dialect: 'postgresql' as Dialect,
  failOn: 'error' as ReportedSeverity,
};

const SEVERITIES: ReadonlySet<string> = new Set(['error', 'warning', 'off']);

/**
 * Load and validate configuration, layering an optional config file and
 * explicit overrides on top of the built-in defaults.
 */
export function loadConfig(options: {
  configPath?: string;
  overrides?: Partial<UserConfig>;
  cwd?: string;
} = {}): ResolvedConfig {
  const explorer = cosmiconfigSync('prisma-strong-migrations', {
    searchStrategy: 'global',
  });

  const found = options.configPath
    ? explorer.load(options.configPath)
    : explorer.search(options.cwd);

  const fileConfig = (found?.config ?? {}) as UserConfig;
  validateUserConfig(fileConfig, found?.filepath ?? 'config');

  const merged: UserConfig = {
    ...fileConfig,
    ...stripUndefined(options.overrides ?? {}),
    rules: { ...fileConfig.rules, ...options.overrides?.rules },
  };

  return {
    migrationsDir: merged.migrationsDir ?? DEFAULTS.migrationsDir,
    dialect: merged.dialect ?? DEFAULTS.dialect,
    failOn: merged.failOn ?? DEFAULTS.failOn,
    ruleSeverity: resolveRuleSeverities(merged.rules ?? {}),
    filepath: found?.filepath,
  };
}

/** Build the effective severity map: defaults, then user overrides. */
function resolveRuleSeverities(overrides: Record<string, RuleSetting>): Map<string, Severity> {
  const severities = new Map<string, Severity>();
  for (const rule of ALL_RULES) {
    severities.set(rule.name, rule.enabledByDefault ? rule.defaultSeverity : 'off');
  }

  for (const [name, setting] of Object.entries(overrides)) {
    const rule = getRule(name);
    if (!rule) {
      throw new ConfigError(`Unknown rule "${name}" in configuration.`);
    }
    severities.set(name, resolveSetting(name, setting, rule.defaultSeverity));
  }

  return severities;
}

function resolveSetting(name: string, setting: RuleSetting, fallback: Severity): Severity {
  if (typeof setting === 'boolean') return setting ? fallback : 'off';
  if (typeof setting === 'string') {
    if (!SEVERITIES.has(setting)) {
      throw new ConfigError(`Invalid severity "${setting}" for rule "${name}". Use error, warning, or off.`);
    }
    return setting;
  }
  if (setting && typeof setting === 'object') {
    if (setting.enabled === false) return 'off';
    if (setting.severity) return resolveSetting(name, setting.severity, fallback);
    return fallback;
  }
  throw new ConfigError(`Invalid setting for rule "${name}".`);
}

function validateUserConfig(config: UserConfig, source: string): void {
  if (config.failOn && config.failOn !== 'error' && config.failOn !== 'warning') {
    throw new ConfigError(`Invalid failOn "${config.failOn}" in ${source}. Use error or warning.`);
  }
  if (config.dialect && config.dialect !== 'postgresql') {
    throw new ConfigError(`Unsupported dialect "${config.dialect}" in ${source}. Only postgresql is supported.`);
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
