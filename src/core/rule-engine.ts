import { Rule, Migration, Violation, LintResult, Severity } from '../types';

export class RuleEngine {
  private rules: Rule[] = [];

  constructor(rules: Rule[] = []) {
    this.rules = rules;
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  async analyzeMigrations(migrations: Migration[]): Promise<LintResult> {
    const allViolations: Violation[] = [];

    for (const migration of migrations) {
      const violations = await this.analyzeMigration(migration);
      allViolations.push(...violations);
    }

    return this.generateLintResult(allViolations, migrations.length);
  }

  async analyzeMigration(migration: Migration): Promise<Violation[]> {
    const violations: Violation[] = [];

    for (const statement of migration.statements) {
      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        try {
          const ruleViolations = rule.check(statement, migration);
          violations.push(...ruleViolations);
        } catch (error) {
          // Log rule execution error but continue with other rules
          console.warn(`Rule ${rule.id} failed to execute:`, error);
        }
      }
    }

    return violations;
  }

  private generateLintResult(violations: Violation[], totalFiles: number): LintResult {
    const errorCount = violations.filter(v => v.severity === Severity.ERROR).length;
    const warningCount = violations.filter(v => v.severity === Severity.WARNING).length;
    const infoCount = violations.filter(v => v.severity === Severity.INFO).length;

    return {
      violations,
      totalFiles,
      totalViolations: violations.length,
      errorCount,
      warningCount,
      infoCount
    };
  }

  getEnabledRules(): Rule[] {
    return this.rules.filter(rule => rule.enabled);
  }

  getAllRules(): Rule[] {
    return [...this.rules];
  }

  getRuleById(ruleId: string): Rule | undefined {
    return this.rules.find(rule => rule.id === ruleId);
  }
} 