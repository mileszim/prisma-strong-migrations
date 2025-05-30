import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noAddNonNullableColumnRule: Rule = {
  id: 'no-add-non-nullable-column',
  name: 'No Add Non-Nullable Column Without Default',
  description: 'Adding a non-nullable column without a default value might fail if the table is not empty',
  severity: Severity.ERROR,
  category: RuleCategory.DEPLOYMENT_SAFETY,
  enabled: true,
  recommendation: 'Add a DEFAULT value when adding non-nullable columns, or make the column nullable initially and populate it before adding NOT NULL constraint',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD COLUMN')) {
      const content = statement.content.toUpperCase();
      
      // Check if it's adding a column that is explicitly NOT NULL without a DEFAULT
      if (content.includes('NOT NULL') && !content.includes('DEFAULT')) {
        violations.push({
          ruleId: 'no-add-non-nullable-column',
          ruleName: 'No Add Non-Nullable Column Without Default',
          severity: Severity.ERROR,
          message: 'Adding a non-nullable column without a default value will fail if the table contains existing rows',
          line: statement.startLine,
          suggestion: 'Add a DEFAULT value: ALTER TABLE table_name ADD COLUMN column_name type NOT NULL DEFAULT value; or make it nullable initially',
          category: RuleCategory.DEPLOYMENT_SAFETY
        });
      }
    }

    return violations;
  }
}; 