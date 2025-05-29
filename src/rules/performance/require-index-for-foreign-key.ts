import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requireIndexForForeignKeyRule: Rule = {
  id: 'require-index-for-foreign-key',
  name: 'Require Index for Foreign Key',
  description: 'Foreign key columns should have indexes for better query performance',
  severity: Severity.WARNING,
  category: RuleCategory.PERFORMANCE,
  enabled: true,
  recommendation: 'Create an index on the foreign key column(s) for better query performance',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD CONSTRAINT')) {
      const content = statement.content.toUpperCase();
      
      if (content.includes('FOREIGN KEY')) {
        // Extract table name and foreign key column(s)
        const foreignKeyMatch = content.match(/FOREIGN KEY\s*\(([^)]+)\)/);
        if (foreignKeyMatch) {
          const columns = foreignKeyMatch[1].split(',').map(col => col.trim());
          
          // Check if there's a corresponding index creation in the same migration
          const hasIndex = migration.statements.some(stmt => 
            stmt.type === 'CREATE_INDEX' && 
            columns.some(col => stmt.content.toUpperCase().includes(col))
          );
          
          if (!hasIndex) {
            violations.push({
              ruleId: 'require-index-for-foreign-key',
              ruleName: 'Require Index for Foreign Key',
              severity: Severity.WARNING,
              message: `Foreign key column(s) "${columns.join(', ')}" should have an index`,
              line: statement.startLine,
              suggestion: `Create an index on column(s): ${columns.join(', ')}`,
              category: RuleCategory.PERFORMANCE
            });
          }
        }
      }
    }

    return violations;
  }
}; 