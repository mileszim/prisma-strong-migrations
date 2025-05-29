import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noAlterColumnTypeRule: Rule = {
  id: 'no-alter-column-type',
  name: 'No Alter Column Type',
  description: 'Changing column types can cause data loss or conversion errors',
  severity: Severity.ERROR,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Use explicit casting with USING clause or create new column and migrate data',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ALTER COLUMN')) {
      const content = statement.content.toUpperCase();
      
      // Check for type changes without USING clause
      if (content.includes('TYPE') && !content.includes('USING')) {
        violations.push({
          ruleId: 'no-alter-column-type',
          ruleName: 'No Alter Column Type',
          severity: Severity.ERROR,
          message: 'Changing column type without USING clause can cause data loss',
          line: statement.startLine,
          suggestion: 'Add USING clause to specify how to convert existing data, e.g., ALTER COLUMN name TYPE VARCHAR(100) USING name::VARCHAR(100)',
          category: RuleCategory.SCHEMA_SAFETY
        });
      }
    }

    return violations;
  }
}; 