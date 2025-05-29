import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noDropTableRule: Rule = {
  id: 'no-drop-table',
  name: 'No Drop Table',
  description: 'Prevents dropping tables as it can cause data loss',
  severity: Severity.ERROR,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Consider renaming the table first, then dropping it in a later migration after confirming data is not needed',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'DROP_TABLE') {
      violations.push({
        ruleId: 'no-drop-table',
        ruleName: 'No Drop Table',
        severity: Severity.ERROR,
        message: 'Dropping tables can cause irreversible data loss',
        line: statement.startLine,
        suggestion: 'Consider renaming the table first, then dropping it in a later migration after confirming data is not needed',
        category: RuleCategory.SCHEMA_SAFETY
      });
    }

    return violations;
  }
}; 