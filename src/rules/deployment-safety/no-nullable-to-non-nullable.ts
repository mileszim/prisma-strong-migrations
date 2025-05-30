import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noNullableToNonNullableRule: Rule = {
  id: 'no-nullable-to-non-nullable',
  name: 'No Nullable To Non-Nullable Column Change',
  description: 'Modifying a nullable column to non-nullable might fail if it contains NULL values',
  severity: Severity.ERROR,
  category: RuleCategory.DEPLOYMENT_SAFETY,
  enabled: true,
  recommendation: 'Backfill NULL values with a default value before adding NOT NULL constraint: UPDATE table SET column = default_value WHERE column IS NULL; then ALTER COLUMN',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE') {
      const content = statement.content.toUpperCase();
      
      // Check for various syntax patterns for modifying column to NOT NULL
      const isModifyingToNotNull = (
        // PostgreSQL/MySQL: ALTER COLUMN name SET NOT NULL
        (content.includes('ALTER COLUMN') && content.includes('SET NOT NULL')) ||
        // MySQL: MODIFY COLUMN name type NOT NULL
        (content.includes('MODIFY COLUMN') && content.includes('NOT NULL')) ||
        // SQL Server: ALTER COLUMN name type NOT NULL
        (content.includes('ALTER COLUMN') && content.includes('NOT NULL') && !content.includes('SET')) ||
        // Generic: CHANGE COLUMN (MySQL)
        (content.includes('CHANGE COLUMN') && content.includes('NOT NULL'))
      );

      if (isModifyingToNotNull) {
        violations.push({
          ruleId: 'no-nullable-to-non-nullable',
          ruleName: 'No Nullable To Non-Nullable Column Change',
          severity: Severity.ERROR,
          message: 'Changing a nullable column to non-nullable will fail if the column contains NULL values',
          line: statement.startLine,
          suggestion: 'First backfill NULL values: UPDATE table_name SET column_name = default_value WHERE column_name IS NULL; then apply the NOT NULL constraint',
          category: RuleCategory.DEPLOYMENT_SAFETY
        });
      }
    }

    return violations;
  }
}; 