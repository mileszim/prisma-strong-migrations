import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noUniqueConstraintWithoutIndexRule: Rule = {
  id: 'no-unique-constraint-without-index',
  name: 'No Unique Constraint Without Index',
  description: 'Adding unique constraints can fail if duplicate data exists',
  severity: Severity.WARNING,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Check for duplicates and create supporting index before adding unique constraint',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD CONSTRAINT')) {
      const content = statement.content.toUpperCase();
      
      if (content.includes('UNIQUE')) {
        // Extract the columns from the unique constraint
        const uniqueMatch = content.match(/UNIQUE\s*\(([^)]+)\)/);
        if (uniqueMatch) {
          const columns = uniqueMatch[1].split(',').map(col => col.trim());
          
          // Check if there's a supporting index created in the same migration
          const hasIndex = migration.statements.some(stmt => 
            stmt.type === 'CREATE_INDEX' && 
            columns.some(col => stmt.content.toUpperCase().includes(col))
          );
          
          violations.push({
            ruleId: 'no-unique-constraint-without-index',
            ruleName: 'No Unique Constraint Without Index',
            severity: Severity.WARNING,
            message: `Adding unique constraint on "${columns.join(', ')}" may fail if duplicates exist`,
            line: statement.startLine,
            suggestion: hasIndex 
              ? 'Check for duplicate data before applying this constraint'
              : 'Create index first and check for duplicates before adding unique constraint',
            category: RuleCategory.SCHEMA_SAFETY
          });
        }
      }
    }

    return violations;
  }
}; 