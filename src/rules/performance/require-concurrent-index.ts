import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requireConcurrentIndexRule: Rule = {
  id: 'require-concurrent-index',
  name: 'Require Concurrent Index',
  description: 'Index operations should use CONCURRENTLY to avoid blocking table access',
  severity: Severity.WARNING,
  category: RuleCategory.PERFORMANCE,
  enabled: true,
  recommendation: 'Use CREATE INDEX CONCURRENTLY or DROP INDEX CONCURRENTLY to avoid table locks',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];
    const content = statement.content.toUpperCase();

    // Check CREATE INDEX without CONCURRENTLY
    if (statement.type === 'CREATE_INDEX' && !content.includes('CONCURRENTLY')) {
      violations.push({
        ruleId: 'require-concurrent-index',
        ruleName: 'Require Concurrent Index',
        severity: Severity.WARNING,
        message: 'Creating index without CONCURRENTLY blocks writes during operation',
        line: statement.startLine,
        suggestion: 'Use CREATE INDEX CONCURRENTLY to avoid blocking table writes',
        category: RuleCategory.PERFORMANCE
      });
    }

    // Check DROP INDEX without CONCURRENTLY
    if (statement.type === 'DROP_INDEX' && !content.includes('CONCURRENTLY')) {
      violations.push({
        ruleId: 'require-concurrent-index',
        ruleName: 'Require Concurrent Index',
        severity: Severity.WARNING,
        message: 'Dropping index without CONCURRENTLY blocks all table access during operation',
        line: statement.startLine,
        suggestion: 'Use DROP INDEX CONCURRENTLY to avoid blocking table access',
        category: RuleCategory.PERFORMANCE
      });
    }

    // Check for CONCURRENTLY usage in transaction context
    if ((statement.type === 'CREATE_INDEX' || statement.type === 'DROP_INDEX') && 
        content.includes('CONCURRENTLY')) {
      
      // Check if migration has transaction markers
      const hasTransactionMarkers = migration.statements.some(stmt => {
        const stmtContent = stmt.content.toUpperCase();
        return stmtContent.includes('BEGIN') || 
               stmtContent.includes('START TRANSACTION') ||
               stmtContent.includes('COMMIT') ||
               stmtContent.includes('ROLLBACK');
      });

      if (hasTransactionMarkers) {
        violations.push({
          ruleId: 'require-concurrent-index',
          ruleName: 'Require Concurrent Index',
          severity: Severity.ERROR,
          message: 'CONCURRENTLY operations cannot be run within a transaction',
          line: statement.startLine,
          suggestion: 'Remove transaction markers or add migration directive to disable transaction mode',
          category: RuleCategory.PERFORMANCE
        });
      }
    }

    // Additional check for CREATE UNIQUE INDEX
    if (statement.type === 'CREATE_INDEX' && 
        content.includes('UNIQUE') && 
        !content.includes('CONCURRENTLY')) {
      violations.push({
        ruleId: 'require-concurrent-index',
        ruleName: 'Require Concurrent Index',
        severity: Severity.WARNING,
        message: 'Creating unique index without CONCURRENTLY acquires ACCESS EXCLUSIVE lock',
        line: statement.startLine,
        suggestion: 'Use CREATE UNIQUE INDEX CONCURRENTLY, then add constraint with USING INDEX',
        category: RuleCategory.PERFORMANCE
      });
    }

    return violations;
  }
}; 