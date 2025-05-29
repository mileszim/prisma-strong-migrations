import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noDropColumnRule: Rule = {
  id: 'no-drop-column',
  name: 'No Drop Column',
  description: 'Prevents dropping columns as it can cause data loss',
  severity: Severity.ERROR,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Consider making the column nullable first, then dropping it in a later migration',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('DROP COLUMN')) {
      violations.push({
        ruleId: 'no-drop-column',
        ruleName: 'No Drop Column',
        severity: Severity.ERROR,
        message: 'Dropping columns can cause irreversible data loss',
        line: statement.startLine,
        suggestion: 'Consider making the column nullable first, then dropping it in a later migration',
        category: RuleCategory.SCHEMA_SAFETY
      });
    }

    return violations;
  }
}; 