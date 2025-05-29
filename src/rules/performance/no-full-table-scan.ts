import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noFullTableScanRule: Rule = {
  id: 'no-full-table-scan',
  name: 'No Full Table Scan',
  description: 'Avoid operations that may cause full table scans on large tables',
  severity: Severity.WARNING,
  category: RuleCategory.PERFORMANCE,
  enabled: true,
  recommendation: 'Add indexes before operations or use WHERE clauses to limit scope',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    const content = statement.content.toUpperCase();

    // Check for potentially expensive operations
    if (statement.type === 'ALTER_TABLE') {
      // Adding NOT NULL without DEFAULT can require table scan
      if (content.includes('ALTER COLUMN') && 
          content.includes('SET NOT NULL') && 
          !content.includes('DEFAULT')) {
        violations.push({
          ruleId: 'no-full-table-scan',
          ruleName: 'No Full Table Scan',
          severity: Severity.WARNING,
          message: 'Setting NOT NULL without DEFAULT may require full table scan',
          line: statement.startLine,
          suggestion: 'Add DEFAULT value first, then set NOT NULL, or use CHECK constraint with NOT VALID',
          category: RuleCategory.PERFORMANCE
        });
      }

      // Adding CHECK constraints can be expensive
      if (content.includes('ADD CONSTRAINT') && 
          content.includes('CHECK') && 
          !content.includes('NOT VALID')) {
        violations.push({
          ruleId: 'no-full-table-scan',
          ruleName: 'No Full Table Scan',
          severity: Severity.WARNING,
          message: 'Adding CHECK constraint without NOT VALID may require full table scan',
          line: statement.startLine,
          suggestion: 'Add CHECK constraint with NOT VALID, then VALIDATE CONSTRAINT in separate step',
          category: RuleCategory.PERFORMANCE
        });
      }
    }

    // Warn about UPDATE/DELETE without WHERE (though we discourage data manipulation anyway)
    if ((statement.type === 'UPDATE' || statement.type === 'DELETE') && 
        !content.includes('WHERE')) {
      violations.push({
        ruleId: 'no-full-table-scan',
        ruleName: 'No Full Table Scan',
        severity: Severity.WARNING,
        message: `${statement.type} without WHERE clause will scan entire table`,
        line: statement.startLine,
        suggestion: 'Add WHERE clause to limit scope of operation',
        category: RuleCategory.PERFORMANCE
      });
    }

    return violations;
  }
}; 