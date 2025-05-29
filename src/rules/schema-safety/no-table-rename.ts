import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noTableRenameRule: Rule = {
  id: 'no-table-rename',
  name: 'No Table Rename',
  description: 'Table renaming is a backward-incompatible change that can cause errors during deployment',
  severity: Severity.ERROR,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Use expand-and-contract pattern or create a view with the old name temporarily',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];
    const content = statement.content.toUpperCase();

    // Check for table renaming operations
    if (statement.type === 'ALTER_TABLE' && content.includes('RENAME TO')) {
      
      // Check if this is a column rename (already handled by another rule)
      if (!content.includes('RENAME COLUMN')) {
        // Extract table names for better error message using original case
        const renameMatch = statement.content.match(/ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+RENAME\s+TO\s+["`]?(\w+)["`]?/i);
        
        if (renameMatch) {
          const [, oldTable, newTable] = renameMatch;
          violations.push({
            ruleId: 'no-table-rename',
            ruleName: 'No Table Rename',
            severity: Severity.ERROR,
            message: `Renaming table "${oldTable}" to "${newTable}" is backward-incompatible`,
            line: statement.startLine,
            suggestion: `Consider alternatives:
1. Create a view: CREATE VIEW ${oldTable} AS SELECT * FROM ${newTable};
2. Use expand-and-contract: create new table, migrate data, update code, drop old table
3. Configure ORM to use new table name while keeping entity name unchanged`,
            category: RuleCategory.SCHEMA_SAFETY
          });
        } else {
          // Generic table rename detection
          violations.push({
            ruleId: 'no-table-rename',
            ruleName: 'No Table Rename',
            severity: Severity.ERROR,
            message: 'Table renaming is backward-incompatible and can cause deployment errors',
            line: statement.startLine,
            suggestion: 'Consider using a view with the old name or expand-and-contract pattern',
            category: RuleCategory.SCHEMA_SAFETY
          });
        }
      }
    }

    return violations;
  }
}; 