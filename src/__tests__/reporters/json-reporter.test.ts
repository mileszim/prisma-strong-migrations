import { JsonReporter } from '../../reporters/json-reporter';
import { LintResult, Severity, Violation, RuleCategory } from '../../types';

describe('JsonReporter', () => {
  let reporter: JsonReporter;

  beforeEach(() => {
    reporter = new JsonReporter();
  });

  describe('format', () => {
    it('should format result with no violations as valid JSON', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 5,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual(result);
      expect(parsed.violations).toHaveLength(0);
      expect(parsed.totalFiles).toBe(5);
      expect(parsed.totalViolations).toBe(0);
    });

    it('should format result with violations as valid JSON', () => {
      const violations: Violation[] = [
        {
          ruleId: 'no-drop-table',
          ruleName: 'No Drop Table',
          severity: Severity.ERROR,
          message: 'Dropping tables is dangerous',
          line: 5,
          column: 1,
          suggestion: 'Consider renaming the table instead',
          category: RuleCategory.SCHEMA_SAFETY
        },
        {
          ruleId: 'no-add-column-without-default',
          ruleName: 'No Add Column Without Default',
          severity: Severity.WARNING,
          message: 'Adding column without default can lock table',
          line: 10,
          column: 1,
          category: RuleCategory.DEPLOYMENT_SAFETY
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 2,
        totalViolations: 2,
        errorCount: 1,
        warningCount: 1,
        infoCount: 0
      };

      const output = reporter.format(result);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual(result);
      expect(parsed.violations).toHaveLength(2);
      expect(parsed.violations[0].ruleId).toBe('no-drop-table');
      expect(parsed.violations[0].severity).toBe('error');
      expect(parsed.violations[1].ruleId).toBe('no-add-column-without-default');
      expect(parsed.violations[1].severity).toBe('warning');
    });

    it('should format JSON with proper indentation', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      // Check that it's formatted with 2 spaces indentation
      expect(output).toContain('{\n  "violations": [],');
      expect(output).toContain('  "totalFiles": 1,');
      expect(output).toContain('  "totalViolations": 0');
    });

    it('should preserve all violation properties in JSON', () => {
      const violation: Violation = {
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        severity: Severity.INFO,
        message: 'Test message with "quotes" and special chars: <>&',
        line: 42,
        column: 15,
        suggestion: 'Test suggestion with special chars: <>&"',
        autoFix: 'ALTER TABLE test ADD COLUMN fixed_column VARCHAR(255)',
        category: RuleCategory.BEST_PRACTICES
      };

      const result: LintResult = {
        violations: [violation],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 0,
        warningCount: 0,
        infoCount: 1
      };

      const output = reporter.format(result);
      const parsed = JSON.parse(output);

      expect(parsed.violations[0]).toEqual(violation);
      expect(parsed.violations[0].message).toBe('Test message with "quotes" and special chars: <>&');
      expect(parsed.violations[0].suggestion).toBe('Test suggestion with special chars: <>&"');
      expect(parsed.violations[0].autoFix).toBe('ALTER TABLE test ADD COLUMN fixed_column VARCHAR(255)');
    });

    it('should handle violations without optional properties', () => {
      const violation: Violation = {
        ruleId: 'minimal-rule',
        ruleName: 'Minimal Rule',
        severity: Severity.ERROR,
        message: 'Minimal violation',
        line: 1,
        category: RuleCategory.SCHEMA_SAFETY
        // No column, suggestion, or autoFix
      };

      const result: LintResult = {
        violations: [violation],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);
      const parsed = JSON.parse(output);

      expect(parsed.violations[0]).toEqual(violation);
      expect(parsed.violations[0].column).toBeUndefined();
      expect(parsed.violations[0].suggestion).toBeUndefined();
      expect(parsed.violations[0].autoFix).toBeUndefined();
    });

    it('should handle large results efficiently', () => {
      const violations: Violation[] = [];
      for (let i = 0; i < 100; i++) {
        violations.push({
          ruleId: `rule-${i}`,
          ruleName: `Rule ${i}`,
          severity: i % 2 === 0 ? Severity.ERROR : Severity.WARNING,
          message: `Message ${i}`,
          line: i + 1,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        });
      }

      const result: LintResult = {
        violations,
        totalFiles: 10,
        totalViolations: 100,
        errorCount: 50,
        warningCount: 50,
        infoCount: 0
      };

      const output = reporter.format(result);
      const parsed = JSON.parse(output);

      expect(parsed.violations).toHaveLength(100);
      expect(parsed.totalViolations).toBe(100);
      expect(parsed.errorCount).toBe(50);
      expect(parsed.warningCount).toBe(50);
    });
  });
}); 