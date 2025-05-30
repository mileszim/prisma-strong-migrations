import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const noDropForeignKeyConstraintRule: Rule = {
  id: 'no-drop-foreign-key-constraint',
  name: 'No Drop Foreign Key Constraint',
  description: 'Dropping foreign key constraints removes referential integrity checks and can lead to data inconsistencies',
  severity: Severity.WARNING,
  category: RuleCategory.SCHEMA_SAFETY,
  enabled: true,
  recommendation: 'Consider if dropping the foreign key constraint is necessary. Ensure proper data validation in application code if removed.',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'ALTER_TABLE') {
      const content = statement.content.toUpperCase();
      
      // Check for different syntax patterns for dropping foreign key constraints
      const isDroppingForeignKey = (
        // MySQL specific: DROP FOREIGN KEY constraint_name
        (content.includes('DROP FOREIGN KEY')) ||
        // Some databases: DROP INDEX constraint_name (for foreign key indexes with FK naming)
        (content.includes('DROP INDEX') && content.includes('FK_')) ||
        // Generic pattern for foreign key constraint names with FK prefix or suffix
        (content.includes('DROP CONSTRAINT') && (content.includes('FK_') || content.includes('_FK')))
      );

      if (isDroppingForeignKey) {
        violations.push({
          ruleId: 'no-drop-foreign-key-constraint',
          ruleName: 'No Drop Foreign Key Constraint',
          severity: Severity.WARNING,
          message: 'Dropping foreign key constraints removes referential integrity protection',
          line: statement.startLine,
          suggestion: 'Ensure data consistency is maintained through application logic or consider if the constraint drop is truly necessary',
          category: RuleCategory.SCHEMA_SAFETY
        });
      }
    }

    return violations;
  }
}; 