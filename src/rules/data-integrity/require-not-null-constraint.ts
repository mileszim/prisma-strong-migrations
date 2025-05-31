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
        const upperLine = line.toUpperCase();
        
        // Skip if it's not a column definition line
        if (!line.includes(' ') || 
            line.startsWith('--') ||
            line.startsWith('CREATE') ||
            line.startsWith('(') ||
            line.startsWith(')') ||
            upperLine.includes('CONSTRAINT') ||
            upperLine.includes('FOREIGN KEY') ||
            upperLine.includes('INDEX')) {
          continue;
        }
        
        // Remove trailing comma and parenthesis for easier parsing
        const cleanLine = line.replace(/[,);]/g, '').trim();
        
        // Check if this looks like a column definition (has column name and data type)
        const columnPattern = /^\s*(\w+)\s+(\w+(?:\(\d+(?:,\s*\d+)?\))?)/;
        const match = columnPattern.exec(cleanLine);
        
        if (match) {
          // Skip if line already has PRIMARY KEY (implicitly NOT NULL)
          if (upperLine.includes('PRIMARY KEY')) {
            continue;
          }
          
          // Skip if line already explicitly specifies NULL or NOT NULL
          if (upperLine.includes('NOT NULL') || 
              upperLine.match(/\bNULL\b/) && !upperLine.includes('NOT NULL')) {
            continue;
          }
          
          // This is a column definition without explicit NULL specification
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