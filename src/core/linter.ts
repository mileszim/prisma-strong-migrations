import { Migration, LintResult, Rule } from '../types';
import { MigrationScanner } from './migration-scanner';
import { RuleEngine } from './rule-engine';
import { ConfigManager } from './config';
import { getBuiltInRules } from '../rules';

export class PrismaStrongMigrationsLinter {
  private scanner: MigrationScanner;
  private ruleEngine: RuleEngine;
  private configManager: ConfigManager;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    this.scanner = new MigrationScanner(this.configManager.getConfig().dialect);
    this.ruleEngine = new RuleEngine();
    
    this.initializeRules();
  }

  private initializeRules(): void {
    const builtInRules = getBuiltInRules();
    const config = this.configManager.getConfig();

    for (const rule of builtInRules) {
      const ruleConfig = config.rules[rule.id];
      
      if (ruleConfig) {
        // Override rule settings with configuration
        const configuredRule: Rule = {
          ...rule,
          enabled: ruleConfig.enabled,
          severity: ruleConfig.severity || rule.severity
        };
        this.ruleEngine.addRule(configuredRule);
      } else {
        this.ruleEngine.addRule(rule);
      }
    }
  }

  async lintMigrations(): Promise<LintResult> {
    const migrationsPath = this.configManager.getMigrationsPath();
    const includePatterns = this.configManager.getIncludePatterns();
    const excludePatterns = this.configManager.getExcludePatterns();

    const migrations = await this.scanner.scanMigrations(
      migrationsPath,
      includePatterns,
      excludePatterns
    );

    return this.ruleEngine.analyzeMigrations(migrations);
  }

  async lintRecentMigrations(count: number = 1): Promise<LintResult> {
    const migrationsPath = this.configManager.getMigrationsPath();
    const migrations = await this.scanner.getRecentMigrations(migrationsPath, count);
    
    return this.ruleEngine.analyzeMigrations(migrations);
  }

  async lintMigrationsSince(sinceId: string): Promise<LintResult> {
    const migrationsPath = this.configManager.getMigrationsPath();
    const migrations = await this.scanner.getMigrationsSince(migrationsPath, sinceId);
    
    return this.ruleEngine.analyzeMigrations(migrations);
  }

  async lintFile(filePath: string): Promise<LintResult> {
    const migration = await this.scanner.scanSingleMigration(filePath);
    const violations = await this.ruleEngine.analyzeMigration(migration);

    return {
      violations,
      totalFiles: 1,
      totalViolations: violations.length,
      errorCount: violations.filter(v => v.severity === 'error').length,
      warningCount: violations.filter(v => v.severity === 'warning').length,
      infoCount: violations.filter(v => v.severity === 'info').length
    };
  }

  addRule(rule: Rule): void {
    this.ruleEngine.addRule(rule);
  }

  removeRule(ruleId: string): void {
    this.ruleEngine.removeRule(ruleId);
  }

  enableRule(ruleId: string): void {
    this.ruleEngine.enableRule(ruleId);
  }

  disableRule(ruleId: string): void {
    this.ruleEngine.disableRule(ruleId);
  }

  getEnabledRules(): Rule[] {
    return this.ruleEngine.getEnabledRules();
  }

  getAllRules(): Rule[] {
    return this.ruleEngine.getAllRules();
  }

  getConfig(): ConfigManager {
    return this.configManager;
  }

  shouldExit(result: LintResult): boolean {
    const config = this.configManager.getConfig();
    
    if (config.failOnError && result.errorCount > 0) {
      return true;
    }
    
    if (config.failOnWarning && result.warningCount > 0) {
      return true;
    }
    
    return false;
  }
} 