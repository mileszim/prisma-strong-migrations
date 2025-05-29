import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requireNotNullConstraintRule: Rule = {
  id: 'require-not-null-constraint',
  name: 'Require NOT NULL Constraint',
  description: 'Columns should explicitly specify NOT NULL constraints for data integrity',
  severity: Severity.INFO,
  category: RuleCategory.DATA_INTEGRITY,
  enabled: true,
  recommendation: 'Explicitly specify NOT NULL for columns that should not accept null values',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'CREATE_TABLE') {
      const content = statement.content;
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip if it's not a column definition or already has NOT NULL/NULL
        if (!line.includes(' ') || 
            line.toUpperCase().includes('NOT NULL') || 
            line.toUpperCase().includes('NULL') ||
            line.startsWith('--') ||
            line.includes('PRIMARY KEY') ||
            line.includes('FOREIGN KEY') ||
            line.includes('CONSTRAINT')) {
          continue;
        }
        
        // Simple heuristic: if it looks like a column definition without NULL specification
        const columnPattern = /^\s*(\w+)\s+\w+/;
        if (columnPattern.test(line)) {
          violations.push({
            ruleId: 'require-not-null-constraint',
            ruleName: 'Require NOT NULL Constraint',
            severity: Severity.INFO,
            message: 'Column should explicitly specify NULL or NOT NULL constraint',
            line: statement.startLine + i,
            suggestion: 'Add NOT NULL if the column should not accept null values',
            category: RuleCategory.DATA_INTEGRITY
          });
        }
      }
    }

    return violations;
  }
}; 