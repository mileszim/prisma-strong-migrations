import { cosmiconfigSync } from 'cosmiconfig';
import { Config, RuleConfig, Severity, OutputFormat } from '../types';
import { getBuiltInRules } from '../rules';

const DEFAULT_CONFIG: Config = {
  migrationsPath: './prisma/migrations',
  rules: {},
  failOnError: true,
  failOnWarning: false,
  output: OutputFormat.TEXT,
  dialect: 'postgresql',
};

export class ConfigManager {
  private config: Config;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): Config {
    const explorer = cosmiconfigSync('prisma-strong-migrations');
    
    try {
      let result;
      if (configPath) {
        result = explorer.load(configPath);
      } else {
        result = explorer.search();
      }

      const userConfig = result?.config || {};
      return this.mergeWithDefaults(userConfig);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  private mergeWithDefaults(userConfig: Partial<Config>): Config {
    const config: Config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      rules: {
        ...this.getDefaultRuleConfig(),
        ...userConfig.rules
      }
    };

    return config;
  }

  private getDefaultRuleConfig(): Record<string, RuleConfig> {
    const builtInRules = getBuiltInRules();
    const defaultRules: Record<string, RuleConfig> = {};

    for (const rule of builtInRules) {
      defaultRules[rule.id] = {
        enabled: rule.enabled,
        severity: rule.severity
      };
    }

    return defaultRules;
  }

  getConfig(): Config {
    return this.config;
  }

  getMigrationsPath(): string {
    return this.config.migrationsPath;
  }

  getRuleConfig(ruleId: string): RuleConfig | undefined {
    return this.config.rules[ruleId];
  }

  isRuleEnabled(ruleId: string): boolean {
    const ruleConfig = this.getRuleConfig(ruleId);
    return ruleConfig?.enabled ?? false;
  }

  getRuleSeverity(ruleId: string): Severity | undefined {
    return this.getRuleConfig(ruleId)?.severity;
  }

  shouldFailOnWarning(): boolean {
    return this.config.failOnWarning ?? false;
  }

  shouldFailOnError(): boolean {
    return this.config.failOnError ?? true;
  }

  getOutputFormat(): OutputFormat {
    return this.config.output ?? OutputFormat.TEXT;
  }

  getIncludePatterns(): string[] | undefined {
    return this.config.include;
  }

  getExcludePatterns(): string[] | undefined {
    return this.config.exclude;
  }

  static createDefaultConfig(): string {
    return `module.exports = {
  migrationsPath: './prisma/migrations',
  dialect: 'postgresql',
  failOnError: true,
  failOnWarning: false,
  output: 'text',
  rules: {
    // Schema Safety Rules - High severity for potentially dangerous operations
    'no-drop-table': { enabled: true, severity: 'error' },
    'no-drop-column': { enabled: true, severity: 'error' },
    'no-alter-column-type': { enabled: true, severity: 'error' },
    'no-column-rename': { enabled: true, severity: 'error' },
    'no-table-rename': { enabled: true, severity: 'error' },
    'no-add-column-without-default': { enabled: true, severity: 'warning' },
    'require-foreign-key-cascade': { enabled: true, severity: 'warning' },
    'no-unique-constraint-without-index': { enabled: true, severity: 'warning' },
    
    // Performance Rules - Warnings for potential performance issues
    'require-index-for-foreign-key': { enabled: true, severity: 'warning' },
    'no-full-table-scan': { enabled: true, severity: 'warning' },
    'require-concurrent-index': { enabled: true, severity: 'error' },
    
    // Data Integrity Rules - Info level for best practices
    'require-not-null-constraint': { enabled: false, severity: 'info' },
    'require-pii-comments': { enabled: false, severity: 'info' },
    
    // Deployment Safety Rules - Errors for migration failures
    'no-data-manipulation': { enabled: true, severity: 'warning' },
    'no-add-non-nullable-column': { enabled: true, severity: 'error' },
    'no-nullable-to-non-nullable': { enabled: true, severity: 'error' },
    
    // Best Practices Rules - Info level suggestions
    'require-transaction-block': { enabled: false, severity: 'info' }
  }
};`;
  }
} 