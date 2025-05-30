import { noDataManipulationRule } from '../rules/deployment-safety/no-data-manipulation';
import { noAddNonNullableColumnRule } from '../rules/deployment-safety/no-add-non-nullable-column';
import { noNullableToNonNullableRule } from '../rules/deployment-safety/no-nullable-to-non-nullable';
import { Migration, SQLStatement, Severity, RuleCategory } from '../types';

describe('Deployment Safety Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('No Data Manipulation Rule', () => {
    it('should detect INSERT statements in migrations', () => {
      const statement: SQLStatement = {
        type: 'INSERT',
        content: 'INSERT INTO users (name, email) VALUES (\'John Doe\', \'john@example.com\');',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDataManipulationRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-data-manipulation');
      expect(violations[0].ruleName).toBe('No Data Manipulation');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.DEPLOYMENT_SAFETY);
      expect(violations[0].message).toBe('INSERT statements should not be in schema migrations');
      expect(violations[0].line).toBe(1);
      expect(violations[0].suggestion).toContain('Move data manipulation to separate data migration scripts');
    });

    it('should detect UPDATE statements in migrations', () => {
      const statement: SQLStatement = {
        type: 'UPDATE',
        content: 'UPDATE users SET active = true WHERE created_at < \'2023-01-01\';',
        startLine: 3,
        endLine: 3
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDataManipulationRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-data-manipulation');
      expect(violations[0].message).toBe('UPDATE statements should not be in schema migrations');
      expect(violations[0].line).toBe(3);
      expect(violations[0].severity).toBe(Severity.WARNING);
    });

    it('should detect DELETE statements in migrations', () => {
      const statement: SQLStatement = {
        type: 'DELETE',
        content: 'DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 90 DAY;',
        startLine: 5,
        endLine: 5
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDataManipulationRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-data-manipulation');
      expect(violations[0].message).toBe('DELETE statements should not be in schema migrations');
      expect(violations[0].line).toBe(5);
      expect(violations[0].severity).toBe(Severity.WARNING);
    });

    it('should detect multiple data manipulation statements', () => {
      const statements: SQLStatement[] = [
        {
          type: 'INSERT',
          content: 'INSERT INTO roles (name) VALUES (\'admin\');',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'UPDATE',
          content: 'UPDATE users SET role_id = 1 WHERE email = \'admin@example.com\';',
          startLine: 2,
          endLine: 2
        }
      ];
      
      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      // Test first statement
      const violations1 = noDataManipulationRule.check(statements[0], migration);
      expect(violations1).toHaveLength(1);
      expect(violations1[0].message).toBe('INSERT statements should not be in schema migrations');

      // Test second statement
      const violations2 = noDataManipulationRule.check(statements[1], migration);
      expect(violations2).toHaveLength(1);
      expect(violations2[0].message).toBe('UPDATE statements should not be in schema migrations');
    });

    it('should NOT trigger for schema-only statements', () => {
      const schemaStatements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255));',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX idx_users_email ON users(email);',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'DROP_INDEX',
          content: 'DROP INDEX idx_users_old;',
          startLine: 4,
          endLine: 4
        },
        {
          type: 'DROP_TABLE',
          content: 'DROP TABLE old_table;',
          startLine: 5,
          endLine: 5
        }
      ];

      const migration = createMockMigration(
        schemaStatements.map(s => s.content).join('\n'),
        schemaStatements
      );

      schemaStatements.forEach(statement => {
        const violations = noDataManipulationRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should NOT trigger for SELECT statements', () => {
      const statement: SQLStatement = {
        type: 'SELECT',
        content: 'SELECT COUNT(*) FROM users;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDataManipulationRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should have correct rule metadata', () => {
      expect(noDataManipulationRule.id).toBe('no-data-manipulation');
      expect(noDataManipulationRule.name).toBe('No Data Manipulation');
      expect(noDataManipulationRule.description).toBe('Schema migrations should not contain data manipulation statements');
      expect(noDataManipulationRule.severity).toBe(Severity.WARNING);
      expect(noDataManipulationRule.category).toBe(RuleCategory.DEPLOYMENT_SAFETY);
      expect(noDataManipulationRule.enabled).toBe(true);
      expect(noDataManipulationRule.recommendation).toBe('Move INSERT/UPDATE/DELETE statements to data migration scripts');
    });

    it('should provide helpful recommendations in complex scenarios', () => {
      const statement: SQLStatement = {
        type: 'INSERT',
        content: 'INSERT INTO config_settings (key, value) VALUES (\'feature_flag_new_ui\', \'true\');',
        startLine: 10,
        endLine: 10
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDataManipulationRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toContain('separate data migration scripts');
      expect(violations[0].suggestion).toContain('separation of concerns');
    });
  });

  describe('No Add Non-Nullable Column Rule', () => {
    it('should detect adding non-nullable column without default', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER NOT NULL;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddNonNullableColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-add-non-nullable-column');
      expect(violations[0].ruleName).toBe('No Add Non-Nullable Column Without Default');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.DEPLOYMENT_SAFETY);
      expect(violations[0].message).toBe('Adding a non-nullable column without a default value will fail if the table contains existing rows');
      expect(violations[0].line).toBe(1);
      expect(violations[0].suggestion).toContain('Add a DEFAULT value');
    });

    it('should NOT trigger when adding non-nullable column with default', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER NOT NULL DEFAULT 0;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddNonNullableColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger when adding nullable column', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddNonNullableColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle case insensitive SQL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users add column status varchar(50) not null;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddNonNullableColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-add-non-nullable-column');
    });
  });

  describe('No Nullable To Non-Nullable Rule', () => {
    it('should detect PostgreSQL ALTER COLUMN SET NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN email SET NOT NULL;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noNullableToNonNullableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-nullable-to-non-nullable');
      expect(violations[0].ruleName).toBe('No Nullable To Non-Nullable Column Change');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.DEPLOYMENT_SAFETY);
      expect(violations[0].message).toBe('Changing a nullable column to non-nullable will fail if the column contains NULL values');
      expect(violations[0].line).toBe(1);
      expect(violations[0].suggestion).toContain('First backfill NULL values');
    });

    it('should detect MySQL MODIFY COLUMN NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noNullableToNonNullableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-nullable-to-non-nullable');
    });

    it('should detect SQL Server ALTER COLUMN NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN email NVARCHAR(255) NOT NULL;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noNullableToNonNullableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-nullable-to-non-nullable');
    });

    it('should detect MySQL CHANGE COLUMN NOT NULL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users CHANGE COLUMN old_email email VARCHAR(255) NOT NULL;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noNullableToNonNullableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-nullable-to-non-nullable');
    });

    it('should handle case insensitive SQL', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users alter column email set not null;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noNullableToNonNullableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-nullable-to-non-nullable');
    });

    it('should NOT trigger for other ALTER COLUMN operations', () => {
      const statements: SQLStatement[] = [
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(300);',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ALTER COLUMN email SET DEFAULT \'unknown@example.com\';',
          startLine: 2,
          endLine: 2
        }
      ];

      statements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = noNullableToNonNullableRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });
  });

  // Future deployment safety rules can be added here, such as:
  // - no-concurrent-schema-and-data-changes
  // - require-transaction-isolation
  // - no-long-running-operations
  // - require-rollback-plan
  // etc.
}); 