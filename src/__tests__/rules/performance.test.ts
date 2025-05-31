import { requireConcurrentIndexRule } from '../../rules/performance/require-concurrent-index';
import { noFullTableScanRule } from '../../rules/performance/no-full-table-scan';
import { requireIndexForForeignKeyRule } from '../../rules/performance/require-index-for-foreign-key';
import { Migration, SQLStatement, Severity, RuleCategory } from '../../types';

describe('Performance Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('Require Concurrent Index Rule', () => {
    it('should detect CREATE INDEX without CONCURRENTLY', () => {
      const statement: SQLStatement = {
        type: 'CREATE_INDEX',
        content: 'CREATE INDEX idx_users_email ON users(email);',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-concurrent-index');
      expect(violations[0].ruleName).toBe('Require Concurrent Index');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.PERFORMANCE);
      expect(violations[0].message).toBe('Creating index without CONCURRENTLY blocks writes during operation');
      expect(violations[0].line).toBe(1);
      expect(violations[0].suggestion).toBe('Use CREATE INDEX CONCURRENTLY to avoid blocking table writes');
    });

    it('should detect DROP INDEX without CONCURRENTLY', () => {
      const statement: SQLStatement = {
        type: 'DROP_INDEX',
        content: 'DROP INDEX idx_users_email;',
        startLine: 2,
        endLine: 2
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-concurrent-index');
      expect(violations[0].message).toBe('Dropping index without CONCURRENTLY blocks all table access during operation');
      expect(violations[0].line).toBe(2);
      expect(violations[0].suggestion).toBe('Use DROP INDEX CONCURRENTLY to avoid blocking table access');
    });

    it('should detect CREATE UNIQUE INDEX without CONCURRENTLY', () => {
      const statement: SQLStatement = {
        type: 'CREATE_INDEX',
        content: 'CREATE UNIQUE INDEX idx_users_email ON users(email);',
        startLine: 3,
        endLine: 3
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(2);
      expect(violations[0].message).toBe('Creating index without CONCURRENTLY blocks writes during operation');
      expect(violations[1].message).toBe('Creating unique index without CONCURRENTLY acquires ACCESS EXCLUSIVE lock');
      expect(violations[1].suggestion).toBe('Use CREATE UNIQUE INDEX CONCURRENTLY, then add constraint with USING INDEX');
    });

    it('should NOT trigger for CREATE INDEX CONCURRENTLY', () => {
      const statement: SQLStatement = {
        type: 'CREATE_INDEX',
        content: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for DROP INDEX CONCURRENTLY', () => {
      const statement: SQLStatement = {
        type: 'DROP_INDEX',
        content: 'DROP INDEX CONCURRENTLY idx_users_email;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect CONCURRENTLY within transaction context', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: 'BEGIN;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'OTHER',
          content: 'COMMIT;',
          startLine: 3,
          endLine: 3
        }
      ];
      
      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireConcurrentIndexRule.check(statements[1], migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-concurrent-index');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].message).toBe('CONCURRENTLY operations cannot be run within a transaction');
      expect(violations[0].suggestion).toBe('Remove transaction markers or add migration directive to disable transaction mode');
    });

    it('should detect START TRANSACTION context', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: 'START TRANSACTION;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'DROP_INDEX',
          content: 'DROP INDEX CONCURRENTLY idx_users_email;',
          startLine: 2,
          endLine: 2
        }
      ];
      
      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireConcurrentIndexRule.check(statements[1], migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].message).toBe('CONCURRENTLY operations cannot be run within a transaction');
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'CREATE_INDEX',
        content: 'create index idx_users_email on users(email);',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireConcurrentIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(requireConcurrentIndexRule.id).toBe('require-concurrent-index');
      expect(requireConcurrentIndexRule.name).toBe('Require Concurrent Index');
      expect(requireConcurrentIndexRule.description).toBe('Index operations should use CONCURRENTLY to avoid blocking table access');
      expect(requireConcurrentIndexRule.severity).toBe(Severity.WARNING);
      expect(requireConcurrentIndexRule.category).toBe(RuleCategory.PERFORMANCE);
      expect(requireConcurrentIndexRule.enabled).toBe(true);
    });
  });

  describe('No Full Table Scan Rule', () => {
    it('should NOT detect queries without WHERE clause', () => {
      const statement: SQLStatement = {
        type: 'OTHER',
        content: 'SELECT * FROM users;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect UPDATE without WHERE clause', () => {
      const statement: SQLStatement = {
        type: 'OTHER',
        content: 'ALTER TABLE users\nUPDATE users SET status = \'active\';',
        startLine: 1,
        endLine: 2
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect DELETE without WHERE clause', () => {
      const statement: SQLStatement = {
        type: 'OTHER',
        content: 'ALTER TABLE users\nDELETE FROM users;',
        startLine: 1,
        endLine: 3
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect ALTER COLUMN SET NOT NULL without DEFAULT', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN email SET NOT NULL;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-full-table-scan');
      expect(violations[0].ruleName).toBe('No Full Table Scan');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.PERFORMANCE);
      expect(violations[0].message).toBe('Setting NOT NULL without DEFAULT may require full table scan');
      expect(violations[0].line).toBe(1);
    });

    it('should detect ADD CHECK constraint without NOT VALID', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD CONSTRAINT check_age CHECK (age >= 0);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Adding CHECK constraint without NOT VALID may require full table scan');
    });

    it('should NOT trigger for ALTER COLUMN SET NOT NULL with DEFAULT', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN email SET DEFAULT \'\', ALTER COLUMN email SET NOT NULL;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for CHECK constraint with NOT VALID', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD CONSTRAINT check_age CHECK (age >= 0) NOT VALID;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users alter column email set not null;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noFullTableScanRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(noFullTableScanRule.id).toBe('no-full-table-scan');
      expect(noFullTableScanRule.name).toBe('No Full Table Scan');
      expect(noFullTableScanRule.description).toBe('Avoid operations that may cause full table scans on large tables');
      expect(noFullTableScanRule.severity).toBe(Severity.WARNING);
      expect(noFullTableScanRule.category).toBe(RuleCategory.PERFORMANCE);
      expect(noFullTableScanRule.enabled).toBe(true);
    });
  });

  describe('Require Index For Foreign Key Rule', () => {
    it('should detect foreign key without corresponding index', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireIndexForForeignKeyRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-index-for-foreign-key');
      expect(violations[0].ruleName).toBe('Require Index for Foreign Key');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.PERFORMANCE);
      expect(violations[0].message).toBe('Foreign key column(s) "CUSTOMER_ID" should have an index');
      expect(violations[0].line).toBe(1);
    });

    it('should detect compound foreign key without matching compound index', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE order_items ADD CONSTRAINT fk_order_product FOREIGN KEY (order_id, product_id) REFERENCES order_products(order_id, product_id);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireIndexForForeignKeyRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Foreign key column(s) "ORDER_ID, PRODUCT_ID" should have an index');
    });

    it('should NOT trigger when corresponding index exists', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX idx_customer_id ON orders (customer_id);',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id);',
          startLine: 2,
          endLine: 2
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = requireIndexForForeignKeyRule.check(statements[1], migration);
      expect(violations).toHaveLength(0);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table orders add constraint fk_customer foreign key (customer_id) references customers(id);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireIndexForForeignKeyRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(requireIndexForForeignKeyRule.id).toBe('require-index-for-foreign-key');
      expect(requireIndexForForeignKeyRule.name).toBe('Require Index for Foreign Key');
      expect(requireIndexForForeignKeyRule.description).toBe('Foreign key columns should have indexes for better query performance');
      expect(requireIndexForForeignKeyRule.severity).toBe(Severity.WARNING);
      expect(requireIndexForForeignKeyRule.category).toBe(RuleCategory.PERFORMANCE);
      expect(requireIndexForForeignKeyRule.enabled).toBe(true);
    });
  });
}); 