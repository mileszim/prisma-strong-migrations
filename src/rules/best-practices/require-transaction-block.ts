import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requireTransactionBlockRule: Rule = {
  id: 'require-transaction-block',
  name: 'Require Transaction Block',
  description: 'Multiple operations should be wrapped in explicit transaction blocks',
  severity: Severity.INFO,
  category: RuleCategory.BEST_PRACTICES,
  enabled: true,
  recommendation: 'Wrap multiple related operations in BEGIN/COMMIT blocks for atomicity',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    // Count DDL statements that modify data
    const modifyingStatements = migration.statements.filter(stmt => 
      ['ALTER_TABLE', 'CREATE_TABLE', 'DROP_TABLE', 'CREATE_INDEX', 'DROP_INDEX'].includes(stmt.type)
    );

    // Check if migration has multiple operations but no transaction block
    if (modifyingStatements.length > 2) {
      const hasTransactionBlock = migration.statements.some(stmt => 
        stmt.content.toUpperCase().includes('BEGIN') || 
        stmt.content.toUpperCase().includes('START TRANSACTION')
      );

      if (!hasTransactionBlock && statement === modifyingStatements[0]) {
        violations.push({
          ruleId: 'require-transaction-block',
          ruleName: 'Require Transaction Block',
          severity: Severity.INFO,
          message: 'Migration with multiple operations should use explicit transaction block',
          line: statement.startLine,
          suggestion: 'Wrap operations in BEGIN; ... COMMIT; block for atomicity',
          category: RuleCategory.BEST_PRACTICES
        });
      }
    }

    return violations;
  }
}; 