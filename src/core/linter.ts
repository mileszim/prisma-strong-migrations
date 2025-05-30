import { LintResult, Rule } from '../types';
import { MigrationScanner } from './migration-scanner';
import { RuleEngine } from './rule-engine';
import { ConfigManager } from './config';
import { getBuiltInRules } from '../rules';
import { GitUtils, GitOptions } from '../utils/git';

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

  async lintChangedMigrations(options: GitOptions = {}): Promise<LintResult> {
    // Check if we're in a git repository
    if (!GitUtils.isGitRepository()) {
      throw new Error('Not in a git repository. Cannot detect changed files.');
    }

    const migrationsPath = this.configManager.getMigrationsPath();
    
    // Get changed migration files
    const changedFiles = GitUtils.getChangedMigrationFiles(migrationsPath, options);
    
    if (changedFiles.length === 0) {
      return {
        violations: [],
        totalFiles: 0,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };
    }

    // Lint each changed file
    const allViolations = [];
    for (const filePath of changedFiles) {
      try {
        const migration = await this.scanner.scanSingleMigration(filePath);
        const violations = await this.ruleEngine.analyzeMigration(migration);
        allViolations.push(...violations);
      } catch (error) {
        // Skip files that can't be read (e.g., deleted files)
        console.warn(`Warning: Could not analyze migration file: ${filePath}`);
      }
    }

    return {
      violations: allViolations,
      totalFiles: changedFiles.length,
      totalViolations: allViolations.length,
      errorCount: allViolations.filter(v => v.severity === 'error').length,
      warningCount: allViolations.filter(v => v.severity === 'warning').length,
      infoCount: allViolations.filter(v => v.severity === 'info').length
    };
  }

  async lintChangedMigrationsSinceCommit(commitSha: string): Promise<LintResult> {
    // Check if we're in a git repository
    if (!GitUtils.isGitRepository()) {
      throw new Error('Not in a git repository. Cannot detect changed files.');
    }

    const migrationsPath = this.configManager.getMigrationsPath();
    
    // Get changed migration files since commit
    const changedFiles = GitUtils.getChangedMigrationFilesSinceCommit(migrationsPath, commitSha);
    
    if (changedFiles.length === 0) {
      return {
        violations: [],
        totalFiles: 0,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };
    }

    // Lint each changed file
    const allViolations = [];
    for (const filePath of changedFiles) {
      try {
        const migration = await this.scanner.scanSingleMigration(filePath);
        const violations = await this.ruleEngine.analyzeMigration(migration);
        allViolations.push(...violations);
      } catch (error) {
        // Skip files that can't be read (e.g., deleted files)
        console.warn(`Warning: Could not analyze migration file: ${filePath}`);
      }
    }

    return {
      violations: allViolations,
      totalFiles: changedFiles.length,
      totalViolations: allViolations.length,
      errorCount: allViolations.filter(v => v.severity === 'error').length,
      warningCount: allViolations.filter(v => v.severity === 'warning').length,
      infoCount: allViolations.filter(v => v.severity === 'info').length
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