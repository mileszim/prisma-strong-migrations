import { requireNotNullConstraintRule } from '../../rules/data-integrity/require-not-null-constraint';
import { requirePiiCommentsRule } from '../../rules/data-integrity/require-pii-comments';
import { Migration, SQLStatement, Severity, RuleCategory } from '../../types';

describe('Data Integrity Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('Require Not Null Constraint Rule', () => {
    it('should detect columns without NOT NULL constraint in CREATE TABLE', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255)\n);',
        startLine: 1,
        endLine: 3
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-not-null-constraint');
      expect(violations[0].ruleName).toBe('Require NOT NULL Constraint');
      expect(violations[0].severity).toBe(Severity.INFO);
      expect(violations[0].category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(violations[0].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
      expect(violations[0].line).toBe(3); // Line with the email column
    });

    it('should detect multiple nullable columns', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255),\n  name VARCHAR(100)\n);',
        startLine: 1,
        endLine: 4
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(2);
      expect(violations[0].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
      expect(violations[1].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
    });

    it('should NOT detect ADD COLUMN without NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users\nADD COLUMN phone VARCHAR(20);',
        startLine: 1,
        endLine: 2
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(0); // This rule only works on CREATE_TABLE
    });

    it('should NOT trigger for columns with NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL,\n  name VARCHAR(100) NULL\n);',
        startLine: 1,
        endLine: 4
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for PRIMARY KEY columns', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  user_id INTEGER PRIMARY KEY\n);',
        startLine: 1,
        endLine: 3
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle different data types', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  price DECIMAL(10,2),\n  description TEXT,\n  created_at TIMESTAMP\n);',
        startLine: 1,
        endLine: 5
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireNotNullConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(3);
      expect(violations[0].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
      expect(violations[1].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
      expect(violations[2].message).toBe('Column should explicitly specify NULL or NOT NULL constraint');
    });

    it('should have correct rule metadata', () => {
      expect(requireNotNullConstraintRule.id).toBe('require-not-null-constraint');
      expect(requireNotNullConstraintRule.name).toBe('Require NOT NULL Constraint');
      expect(requireNotNullConstraintRule.description).toBe('Columns should explicitly specify NOT NULL constraints for data integrity');
      expect(requireNotNullConstraintRule.severity).toBe(Severity.INFO);
      expect(requireNotNullConstraintRule.category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(requireNotNullConstraintRule.enabled).toBe(true);
    });
  });

  describe('Require PII Comments Rule', () => {
    it('should detect PII columns without comments', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255));',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-pii-comments');
      expect(violations[0].ruleName).toBe('Require PII Comments');
      expect(violations[0].severity).toBe(Severity.INFO);
      expect(violations[0].category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(violations[0].message).toBe('Column appears to contain PII but lacks proper comment');
      expect(violations[0].line).toBe(1);
    });

    it('should detect multiple PII columns without comments', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (name VARCHAR(100), email VARCHAR(255), phone VARCHAR(20), address TEXT);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(1); // Only detects one violation per statement
      expect(violations[0].message).toBe('Column appears to contain PII but lacks proper comment');
    });

    it('should detect ADD COLUMN for PII data without comments', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users\nADD COLUMN ssn VARCHAR(11);',
        startLine: 1,
        endLine: 2
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Column appears to contain PII but lacks proper comment');
      expect(violations[0].line).toBe(2);
    });

    it('should NOT trigger for PII columns with comments', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) COMMENT \'PII: User email address\');',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for non-PII columns', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE products (id SERIAL PRIMARY KEY, title VARCHAR(255), price DECIMAL(10,2));',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect all common PII column names', () => {
      const piiColumns = ['name', 'email', 'phone', 'address', 'ssn', 'dob', 'ip_address'];
      
      piiColumns.forEach(columnName => {
        const statement: SQLStatement = {
          type: 'CREATE_TABLE',
          content: `CREATE TABLE test (${columnName} VARCHAR(255));`,
          startLine: 1,
          endLine: 1
        };
        
        const migration = createMockMigration(statement.content, [statement]);
        const violations = requirePiiCommentsRule.check(statement, migration);
        
        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Column appears to contain PII but lacks proper comment');
      });
    });

    it('should handle case insensitive column names', () => {
      const statement: SQLStatement = {
        type: 'CREATE_TABLE',
        content: 'CREATE TABLE users (EMAIL VARCHAR(255), Name VARCHAR(100));',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requirePiiCommentsRule.check(statement, migration);
      
      expect(violations).toHaveLength(1); // Only detects one violation per statement
      expect(violations[0].message).toBe('Column appears to contain PII but lacks proper comment');
    });

    it('should have correct rule metadata', () => {
      expect(requirePiiCommentsRule.id).toBe('require-pii-comments');
      expect(requirePiiCommentsRule.name).toBe('Require PII Comments');
      expect(requirePiiCommentsRule.description).toBe('Columns containing PII should have comments for compliance tracking');
      expect(requirePiiCommentsRule.severity).toBe(Severity.INFO);
      expect(requirePiiCommentsRule.category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(requirePiiCommentsRule.enabled).toBe(true);
    });
  });
}); 