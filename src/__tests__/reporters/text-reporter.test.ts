import { TextReporter } from '../../reporters/text-reporter';
import { LintResult, Severity, Violation, RuleCategory } from '../../types';
import { stripVTControlCharacters } from 'util';

describe('TextReporter', () => {
  let reporter: TextReporter;

  beforeEach(() => {
    reporter = new TextReporter();
  });

  describe('format', () => {
    it('should return success message when no violations found', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 5,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('✓ No violations found in migration files');
    });

    it('should format single error violation correctly', () => {
      const violation: Violation = {
        ruleId: 'no-drop-table',
        ruleName: 'No Drop Table',
        severity: Severity.ERROR,
        message: 'Dropping tables is dangerous and can cause data loss',
        line: 5,
        column: 1,
        suggestion: 'Consider renaming the table instead',
        category: RuleCategory.SCHEMA_SAFETY
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

      expect(output).toContain('migration');
      expect(output).toContain('5:1');
      expect(output).toContain('Dropping tables is dangerous and can cause data loss');
      expect(output).toContain('no-drop-table');
      expect(output).toContain('💡 Consider renaming the table instead');
      expect(output).toContain('1 error');
    });

    it('should format multiple violations with different severities', () => {
      const violations: Violation[] = [
        {
          ruleId: 'no-drop-table',
          ruleName: 'No Drop Table',
          severity: Severity.ERROR,
          message: 'Error message',
          line: 5,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        },
        {
          ruleId: 'no-add-column-without-default',
          ruleName: 'No Add Column Without Default',
          severity: Severity.WARNING,
          message: 'Warning message',
          line: 10,
          column: 1,
          category: RuleCategory.DEPLOYMENT_SAFETY
        },
        {
          ruleId: 'require-pii-comments',
          ruleName: 'Require PII Comments',
          severity: Severity.INFO,
          message: 'Info message',
          line: 15,
          column: 1,
          category: RuleCategory.DATA_INTEGRITY
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 3,
        errorCount: 1,
        warningCount: 1,
        infoCount: 1
      };

      const output = reporter.format(result);

      expect(output).toContain('5:1'); // Error line
      expect(output).toContain('10:1'); // Warning line
      expect(output).toContain('15:1'); // Info line
      expect(stripVTControlCharacters(output)).toMatch(/1 error, 1 warning, 1 info \(1 file linted\)/);
    });

    it('should format violations without suggestions', () => {
      const violation: Violation = {
        ruleId: 'no-drop-table',
        ruleName: 'No Drop Table',
        severity: Severity.ERROR,
        message: 'Dropping tables is dangerous',
        line: 5,
        column: 1,
        category: RuleCategory.SCHEMA_SAFETY
        // No suggestion provided
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

      expect(output).not.toContain('💡');
      expect(output).toContain('Dropping tables is dangerous');
    });

    it('should format summary with only errors', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 2,
        totalViolations: 3,
        errorCount: 3,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('3 errors');
      expect(output).toContain('2 files linted');
    });

    it('should format summary with only warnings', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 2,
        errorCount: 0,
        warningCount: 2,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('2 warnings');
      expect(output).toContain('1 file linted');
    });

    it('should format summary with mixed violations and singular/plural forms', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 3,
        errorCount: 1,
        warningCount: 1,
        infoCount: 1
      };

      const output = reporter.format(result);

      expect(stripVTControlCharacters(output)).toMatch(/1 error, 1 warning, 1 info \(1 file linted\)/);
      expect(output).toContain('1 file linted');
    });

    it('should format summary with plural forms', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 3,
        totalViolations: 6,
        errorCount: 2,
        warningCount: 3,
        infoCount: 1
      };

      const output = reporter.format(result);

      expect(stripVTControlCharacters(output)).toMatch(/2 errors, 3 warnings, 1 info \(3 files linted\)/);
      expect(output).toContain('3 files linted');
    });

    it('should handle zero violations with proper summary', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 2,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('✓ No violations found in migration files');
    });
  });

  describe('getSeverityColor', () => {
    it('should use correct colors for different severities', () => {
      const violation: Violation = {
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        severity: Severity.ERROR,
        message: 'Test message',
        line: 1,
        column: 1,
        category: RuleCategory.SCHEMA_SAFETY
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
      // The actual color codes are applied by chalk, but we can verify structure
      expect(output).toContain('✖'); // Error icon
    });
  });

  describe('getSeverityIcon', () => {
    it('should use correct icons for different severities', () => {
      const violations: Violation[] = [
        {
          ruleId: 'error-rule',
          ruleName: 'Error Rule',
          severity: Severity.ERROR,
          message: 'Error',
          line: 1,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        },
        {
          ruleId: 'warning-rule',
          ruleName: 'Warning Rule',
          severity: Severity.WARNING,
          message: 'Warning',
          line: 2,
          column: 1,
          category: RuleCategory.PERFORMANCE
        },
        {
          ruleId: 'info-rule',
          ruleName: 'Info Rule',
          severity: Severity.INFO,
          message: 'Info',
          line: 3,
          column: 1,
          category: RuleCategory.BEST_PRACTICES
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 3,
        errorCount: 1,
        warningCount: 1,
        infoCount: 1
      };

      const output = reporter.format(result);

      expect(output).toContain('✖'); // Error icon
      expect(output).toContain('⚠'); // Warning icon
      expect(output).toContain('ℹ'); // Info icon
    });
  });
}); 