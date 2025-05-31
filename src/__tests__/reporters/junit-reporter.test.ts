import { JunitReporter } from '../../reporters/junit-reporter';
import { LintResult, Severity, Violation, RuleCategory } from '../../types';

describe('JunitReporter', () => {
  let reporter: JunitReporter;

  beforeEach(() => {
    reporter = new JunitReporter();
  });

  describe('format', () => {
    it('should generate valid XML with no violations', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 3,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(output).toContain('name="prisma-strong-migrations"');
      expect(output).toContain('tests="0"');
      expect(output).toContain('failures="0"');
      expect(output).toContain('errors="0"');
      expect(output).toContain('<testsuite name="migration-lint"');
      expect(output).toContain('</testsuites>');
    });

    it('should generate XML with error violations as failures', () => {
      const violations: Violation[] = [
        {
          ruleId: 'no-drop-table',
          ruleName: 'No Drop Table',
          severity: Severity.ERROR,
          message: 'Dropping tables is dangerous',
          line: 5,
          column: 1,
          suggestion: 'Consider renaming instead',
          category: RuleCategory.SCHEMA_SAFETY
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('tests="1"');
      expect(output).toContain('failures="1"');
      expect(output).toContain('<testcase name="no-drop-table at line 5"');
      expect(output).toContain('classname="schema-safety"');
      expect(output).toContain('<failure type="error"');
      expect(output).toContain('message="Dropping tables is dangerous"');
      expect(output).toContain('Suggestion: Consider renaming instead');
    });

    it('should generate XML with warning violations as failures', () => {
      const violations: Violation[] = [
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
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 0,
        warningCount: 1,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('failures="1"');
      expect(output).toContain('<failure type="warning"');
      expect(output).toContain('message="Adding column without default can lock table"');
    });

    it('should not treat info violations as failures', () => {
      const violations: Violation[] = [
        {
          ruleId: 'require-pii-comments',
          ruleName: 'Require PII Comments',
          severity: Severity.INFO,
          message: 'Consider adding PII comments',
          line: 15,
          column: 1,
          category: RuleCategory.DATA_INTEGRITY
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 0,
        warningCount: 0,
        infoCount: 1
      };

      const output = reporter.format(result);

      expect(output).toContain('tests="1"');
      expect(output).toContain('failures="0"'); // Info should not be counted as failure
      expect(output).toContain('<testcase name="require-pii-comments at line 15"');
      expect(output).not.toContain('<failure');
    });

    it('should handle mixed severity violations correctly', () => {
      const violations: Violation[] = [
        {
          ruleId: 'error-rule',
          ruleName: 'Error Rule',
          severity: Severity.ERROR,
          message: 'Error message',
          line: 1,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        },
        {
          ruleId: 'warning-rule',
          ruleName: 'Warning Rule',
          severity: Severity.WARNING,
          message: 'Warning message',
          line: 2,
          column: 1,
          category: RuleCategory.PERFORMANCE
        },
        {
          ruleId: 'info-rule',
          ruleName: 'Info Rule',
          severity: Severity.INFO,
          message: 'Info message',
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

      expect(output).toContain('tests="3"');
      expect(output).toContain('failures="2"'); // Only error and warning count as failures
      expect(output).toContain('<failure type="error"');
      expect(output).toContain('<failure type="warning"');
    });

    it('should properly escape XML special characters', () => {
      const violations: Violation[] = [
        {
          ruleId: 'test-rule',
          ruleName: 'Test Rule',
          severity: Severity.ERROR,
          message: 'Message with <tags> & "quotes" and \'apostrophes\'',
          line: 1,
          column: 1,
          suggestion: 'Suggestion with <>&"\' characters',
          category: RuleCategory.SCHEMA_SAFETY
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('&lt;tags&gt; &amp; &quot;quotes&quot; and &apos;apostrophes&apos;');
      expect(output).toContain('Suggestion with &lt;&gt;&amp;&quot;&apos; characters');
      expect(output).not.toContain('<tags>');
      expect(output).not.toContain('"quotes"');
    });

    it('should handle violations without suggestions', () => {
      const violations: Violation[] = [
        {
          ruleId: 'no-suggestion-rule',
          ruleName: 'No Suggestion Rule',
          severity: Severity.ERROR,
          message: 'Error without suggestion',
          line: 5,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
          // No suggestion provided
        }
      ];

      const result: LintResult = {
        violations,
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('<failure type="error"');
      expect(output).toContain('Error without suggestion');
      expect(output).not.toContain('Suggestion:');
    });

    it('should use migration-lint as default classname when category is undefined', () => {
      const violations: Violation[] = [
        {
          ruleId: 'test-rule',
          ruleName: 'Test Rule',
          severity: Severity.ERROR,
          message: 'Test message',
          line: 1,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        }
      ];

      // Simulate missing category by creating a violation without it
      const violationWithoutCategory = { ...violations[0] };
      delete (violationWithoutCategory as any).category;

      const result: LintResult = {
        violations: [violationWithoutCategory as Violation],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toContain('classname="migration-lint"');
    });

    it('should include timestamp in XML output', () => {
      const result: LintResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      const output = reporter.format(result);

      expect(output).toMatch(/timestamp="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/);
    });

    it('should generate well-formed XML for large results', () => {
      const violations: Violation[] = [];
      for (let i = 0; i < 50; i++) {
        violations.push({
          ruleId: `rule-${i}`,
          ruleName: `Rule ${i}`,
          severity: i % 3 === 0 ? Severity.ERROR : i % 3 === 1 ? Severity.WARNING : Severity.INFO,
          message: `Message ${i}`,
          line: i + 1,
          column: 1,
          category: RuleCategory.SCHEMA_SAFETY
        });
      }

      const result: LintResult = {
        violations,
        totalFiles: 5,
        totalViolations: 50,
        errorCount: 17, // Roughly 1/3
        warningCount: 17, // Roughly 1/3
        infoCount: 16 // Roughly 1/3
      };

      const output = reporter.format(result);

      expect(output).toContain('tests="50"');
      expect(output).toContain('failures="34"'); // errors + warnings
      expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(output).toContain('</testsuites>');
      
      // Verify it contains all test cases
      for (let i = 0; i < 50; i++) {
        expect(output).toContain(`rule-${i} at line ${i + 1}`);
      }
    });
  });
}); 