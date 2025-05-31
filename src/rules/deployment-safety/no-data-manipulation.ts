import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noDataManipulationRule: Rule = {
  id: 'no-data-manipulation',
  name: 'No Data Manipulation',
  description: 'Schema migrations should not contain data manipulation statements',
  severity: Severity.WARNING,
  category: RuleCategory.DEPLOYMENT_SAFETY,
  enabled: true,
  recommendation: 'Move INSERT/UPDATE/DELETE statements to data migration scripts',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    // Check by statement type first (most reliable)
    if (['INSERT', 'UPDATE', 'DELETE'].includes(statement.type)) {
      violations.push({
        ruleId: 'no-data-manipulation',
        ruleName: 'No Data Manipulation',
        severity: Severity.WARNING,
        message: `${statement.type} statements should not be in schema migrations`,
        line: statement.startLine,
        suggestion: 'Move data manipulation to separate data migration scripts for better separation of concerns',
        category: RuleCategory.DEPLOYMENT_SAFETY
      });
    }
    // Also check content for OTHER statements that might contain data manipulation
    else if (statement.type === 'OTHER') {
      const upperContent = statement.content.trim().toUpperCase();
      const dataManipulationPatterns = [
        /^\s*INSERT\s+/,
        /^\s*UPDATE\s+/,
        /^\s*DELETE\s+/
      ];
      
      for (const pattern of dataManipulationPatterns) {
        if (pattern.test(upperContent)) {
          const statementType = upperContent.match(/^\s*(\w+)/)?.[1] || 'DATA_MANIPULATION';
          violations.push({
            ruleId: 'no-data-manipulation',
            ruleName: 'No Data Manipulation',
            severity: Severity.WARNING,
            message: `${statementType} statements should not be in schema migrations`,
            line: statement.startLine,
            suggestion: 'Move data manipulation to separate data migration scripts for better separation of concerns',
            category: RuleCategory.DEPLOYMENT_SAFETY
          });
          break; // Only report once per statement
        }
      }
    }

    return violations;
  }
}; 