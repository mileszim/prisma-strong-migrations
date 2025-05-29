import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noColumnRenameRule: Rule = {
  id: 'no-column-rename',
  name: 'No Column Rename',
  description: 'Column renaming is a backward-incompatible change that can cause errors during deployment',
  severity: Severity.ERROR,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Use expand-and-contract pattern: add new column, copy data, update code, then drop old column',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];
    const content = statement.content.toUpperCase();

    // Check for column renaming operations - must include "RENAME COLUMN"
    if (statement.type === 'ALTER_TABLE' && content.includes('RENAME COLUMN')) {
      
      // Extract table and column information for better error message using original case
      const renameMatch = statement.content.match(/ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+RENAME\s+COLUMN\s+["`]?(\w+)["`]?\s+TO\s+["`]?(\w+)["`]?/i);
      
      if (renameMatch) {
        const [, tableName, oldColumn, newColumn] = renameMatch;
        violations.push({
          ruleId: 'no-column-rename',
          ruleName: 'No Column Rename',
          severity: Severity.ERROR,
          message: `Renaming column "${oldColumn}" to "${newColumn}" in table "${tableName}" is backward-incompatible`,
          line: statement.startLine,
          suggestion: `Use expand-and-contract pattern: 
1. ALTER TABLE ${tableName} ADD COLUMN ${newColumn} <type>;
2. UPDATE ${tableName} SET ${newColumn} = ${oldColumn};
3. Update application code to use ${newColumn}
4. ALTER TABLE ${tableName} DROP COLUMN ${oldColumn};`,
          category: RuleCategory.SCHEMA_SAFETY
        });
      } else {
        // Generic column rename detection
        violations.push({
          ruleId: 'no-column-rename',
          ruleName: 'No Column Rename',
          severity: Severity.ERROR,
          message: 'Column renaming is backward-incompatible and can cause deployment errors',
          line: statement.startLine,
          suggestion: 'Use expand-and-contract pattern: add new column, copy data, update code references, then drop old column',
          category: RuleCategory.SCHEMA_SAFETY
        });
      }
    }

    return violations;
  }
}; 