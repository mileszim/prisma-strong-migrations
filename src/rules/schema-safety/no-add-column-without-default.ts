import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noAddColumnWithoutDefaultRule: Rule = {
  id: 'no-add-column-without-default',
  name: 'No Add Column Without Default',
  description: 'New columns should have default values to avoid breaking existing applications',
  severity: Severity.WARNING,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Add a DEFAULT value or make the column nullable when adding new columns',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD COLUMN')) {
      const content = statement.content.toUpperCase();
      
      // Check if it's adding a column without DEFAULT and without NULL
      if (!content.includes('DEFAULT') && !content.includes('NULL')) {
        violations.push({
          ruleId: 'no-add-column-without-default',
          ruleName: 'No Add Column Without Default',
          severity: Severity.WARNING,
          message: 'Adding a column without a default value may break existing applications',
          line: statement.startLine,
          suggestion: 'Add a DEFAULT value or make the column nullable',
          category: RuleCategory.SCHEMA_SAFETY
        });
      }
    }

    return violations;
  }
}; 