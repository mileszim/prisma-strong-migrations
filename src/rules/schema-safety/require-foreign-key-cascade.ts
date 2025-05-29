import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requireForeignKeyCascadeRule: Rule = {
  id: 'require-foreign-key-cascade',
  name: 'Require Foreign Key Cascade',
  description: 'Foreign keys should specify ON DELETE behavior to prevent orphaned data',
  severity: Severity.WARNING,
  category: RuleCategory.DATA_INTEGRITY,
  enabled: true,
  recommendation: 'Add ON DELETE CASCADE, SET NULL, or RESTRICT to foreign key constraints',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD CONSTRAINT')) {
      const content = statement.content.toUpperCase();
      
      if (content.includes('FOREIGN KEY')) {
        // Check if ON DELETE clause is specified
        if (!content.includes('ON DELETE')) {
          violations.push({
            ruleId: 'require-foreign-key-cascade',
            ruleName: 'Require Foreign Key Cascade',
            severity: Severity.WARNING,
            message: 'Foreign key constraint should specify ON DELETE behavior',
            line: statement.startLine,
            suggestion: 'Add ON DELETE CASCADE, SET NULL, or RESTRICT to prevent orphaned data',
            category: RuleCategory.DATA_INTEGRITY
          });
        }
      }
    }

    return violations;
  }
}; 