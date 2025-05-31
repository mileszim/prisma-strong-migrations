import { requireTransactionBlockRule } from '../../rules/best-practices/require-transaction-block';
import { Migration, SQLStatement, Severity, RuleCategory } from '../../types';

describe('Best Practices Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('Require Transaction Block Rule', () => {
    it('should detect migration without transaction blocks when there are multiple operations', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
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
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      // Only the first statement should trigger the violation
      const violations = requireTransactionBlockRule.check(statements[0], migration);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-transaction-block');
      expect(violations[0].ruleName).toBe('Require Transaction Block');
      expect(violations[0].severity).toBe(Severity.INFO);
      expect(violations[0].category).toBe(RuleCategory.BEST_PRACTICES);
      expect(violations[0].message).toBe('Migration with multiple operations should use explicit transaction block');
      expect(violations[0].line).toBe(1);
    });

    it('should NOT trigger for migrations with 2 or fewer operations', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
          startLine: 2,
          endLine: 2
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      statements.forEach(statement => {
        const violations = requireTransactionBlockRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should NOT trigger when transaction block exists', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: 'BEGIN;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX idx_users_email ON users(email);',
          startLine: 4,
          endLine: 4
        },
        {
          type: 'OTHER',
          content: 'COMMIT;',
          startLine: 5,
          endLine: 5
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      statements.forEach(statement => {
        const violations = requireTransactionBlockRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should detect migration with incomplete transaction blocks', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
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
          type: 'OTHER',
          content: 'COMMIT;',
          startLine: 4,
          endLine: 4
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireTransactionBlockRule.check(statements[0], migration);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Migration with multiple operations should use explicit transaction block');
    });

    it('should detect migration with only COMMIT but no BEGIN', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
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
          type: 'OTHER',
          content: 'COMMIT;',
          startLine: 4,
          endLine: 4
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireTransactionBlockRule.check(statements[0], migration);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Migration with multiple operations should use explicit transaction block');
    });

    it('should trigger for DDL statements that benefit from transactions', () => {
      const ddlStatements = [
        'CREATE TABLE test (id SERIAL);',
        'ALTER TABLE test ADD COLUMN name VARCHAR(255);',
        'CREATE INDEX idx_test_name ON test(name);'
      ];

      ddlStatements.forEach((content, index) => {
        const statements: SQLStatement[] = [
          {
            type: 'CREATE_TABLE',
            content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
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
            content,
            startLine: 3,
            endLine: 3
          }
        ];

        const migration = createMockMigration(
          statements.map(s => s.content).join('\n'),
          statements
        );
        const violations = requireTransactionBlockRule.check(statements[0], migration);
        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Migration with multiple operations should use explicit transaction block');
      });
    });

    it('should NOT trigger for data manipulation statements (handled by other rules)', () => {
      const dataStatements: SQLStatement[] = [
        {
          type: 'INSERT',
          content: 'INSERT INTO users (name) VALUES (\'test\');',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'UPDATE',
          content: 'UPDATE users SET active = true;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'DELETE',
          content: 'DELETE FROM users WHERE id = 1;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'SELECT',
          content: 'SELECT COUNT(*) FROM users;',
          startLine: 1,
          endLine: 1
        }
      ];

      dataStatements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = requireTransactionBlockRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should handle mixed transaction markers correctly', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: 'BEGIN;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'OTHER',
          content: 'ROLLBACK;',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'OTHER',
          content: 'START TRANSACTION;',
          startLine: 4,
          endLine: 4
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
          startLine: 5,
          endLine: 5
        },
        {
          type: 'OTHER',
          content: 'COMMIT;',
          startLine: 6,
          endLine: 6
        }
      ];
      
      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      // Both DDL statements should not trigger violations as they're within transaction blocks
      const violations1 = requireTransactionBlockRule.check(statements[1], migration);
      expect(violations1).toHaveLength(0);
      
      const violations2 = requireTransactionBlockRule.check(statements[4], migration);
      expect(violations2).toHaveLength(0);
    });

    it('should handle PostgreSQL-style comments in transaction detection', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: '-- Migration start',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'OTHER',
          content: 'BEGIN; -- Start transaction',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY); -- Create users table',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'OTHER',
          content: 'COMMIT; -- End transaction',
          startLine: 4,
          endLine: 4
        }
      ];
      
      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireTransactionBlockRule.check(statements[2], migration);
      expect(violations).toHaveLength(0);
    });

    it('should have correct rule metadata', () => {
      expect(requireTransactionBlockRule.id).toBe('require-transaction-block');
      expect(requireTransactionBlockRule.name).toBe('Require Transaction Block');
      expect(requireTransactionBlockRule.description).toBe('Multiple operations should be wrapped in explicit transaction blocks');
      expect(requireTransactionBlockRule.severity).toBe(Severity.INFO);
      expect(requireTransactionBlockRule.category).toBe(RuleCategory.BEST_PRACTICES);
      expect(requireTransactionBlockRule.enabled).toBe(true);
    });
  });
}); 