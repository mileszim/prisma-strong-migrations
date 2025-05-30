import { noDropForeignKeyConstraintRule } from '../rules/schema-safety/no-drop-foreign-key-constraint';
import { Migration, SQLStatement, Severity, RuleCategory } from '../types';

describe('Schema Safety Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('No Drop Foreign Key Constraint Rule', () => {
    it('should detect standard DROP CONSTRAINT for foreign key', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
      expect(violations[0].ruleName).toBe('No Drop Foreign Key Constraint');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Dropping foreign key constraints removes referential integrity protection');
      expect(violations[0].line).toBe(1);
      expect(violations[0].suggestion).toContain('data consistency');
    });

    it('should detect MySQL DROP FOREIGN KEY syntax', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer_id;',
        startLine: 2,
        endLine: 2
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
      expect(violations[0].line).toBe(2);
    });

    it('should detect DROP INDEX for foreign key indexes', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders DROP INDEX FK_orders_customer_id;',
        startLine: 3,
        endLine: 3
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
      expect(violations[0].line).toBe(3);
    });

    it('should detect DROP CONSTRAINT with FK_ naming pattern', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders DROP CONSTRAINT FK_orders_product;',
        startLine: 4,
        endLine: 4
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
      expect(violations[0].line).toBe(4);
    });

    it('should detect DROP CONSTRAINT with _FK suffix pattern', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders DROP CONSTRAINT orders_customer_FK;',
        startLine: 5,
        endLine: 5
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
      expect(violations[0].line).toBe(5);
    });

    it('should handle case insensitive SQL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table orders drop constraint fk_orders_customer_id;',
        startLine: 6,
        endLine: 6
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropForeignKeyConstraintRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-foreign-key-constraint');
    });

    it('should NOT trigger for non-foreign key constraint drops', () => {
      const statements: SQLStatement[] = [
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users DROP CONSTRAINT check_age_positive;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users DROP CONSTRAINT unique_email;',
          startLine: 2,
          endLine: 2
        }
      ];

      statements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = noDropForeignKeyConstraintRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should NOT trigger for other ALTER TABLE operations', () => {
      const statements: SQLStatement[] = [
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id);',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users MODIFY COLUMN name VARCHAR(100);',
          startLine: 3,
          endLine: 3
        }
      ];

      statements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = noDropForeignKeyConstraintRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should have correct rule metadata', () => {
      expect(noDropForeignKeyConstraintRule.id).toBe('no-drop-foreign-key-constraint');
      expect(noDropForeignKeyConstraintRule.name).toBe('No Drop Foreign Key Constraint');
      expect(noDropForeignKeyConstraintRule.description).toBe('Dropping foreign key constraints removes referential integrity checks and can lead to data inconsistencies');
      expect(noDropForeignKeyConstraintRule.severity).toBe(Severity.WARNING);
      expect(noDropForeignKeyConstraintRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noDropForeignKeyConstraintRule.enabled).toBe(true);
      expect(noDropForeignKeyConstraintRule.recommendation).toBe('Consider if dropping the foreign key constraint is necessary. Ensure proper data validation in application code if removed.');
    });
  });
}); 