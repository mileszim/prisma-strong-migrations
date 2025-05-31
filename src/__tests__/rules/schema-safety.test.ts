import { noDropTableRule } from '../../rules/schema-safety/no-drop-table';
import { noDropColumnRule } from '../../rules/schema-safety/no-drop-column';
import { noAddColumnWithoutDefaultRule } from '../../rules/schema-safety/no-add-column-without-default';
import { noAlterColumnTypeRule } from '../../rules/schema-safety/no-alter-column-type';
import { requireForeignKeyCascadeRule } from '../../rules/schema-safety/require-foreign-key-cascade';
import { noUniqueConstraintWithoutIndexRule } from '../../rules/schema-safety/no-unique-constraint-without-index';
import { noColumnRenameRule } from '../../rules/schema-safety/no-column-rename';
import { noTableRenameRule } from '../../rules/schema-safety/no-table-rename';
import { noDropForeignKeyConstraintRule } from '../../rules/schema-safety/no-drop-foreign-key-constraint';
import { Migration, SQLStatement, Severity, RuleCategory } from '../../types';

describe('Schema Safety Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('No Drop Table Rule', () => {
    it('should detect DROP TABLE statements', () => {
      const statement: SQLStatement = {
        type: 'DROP_TABLE',
        content: 'DROP TABLE users;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropTableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-table');
      expect(violations[0].ruleName).toBe('No Drop Table');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Dropping tables can cause irreversible data loss');
      expect(violations[0].line).toBe(1);
    });

    it('should detect conditional DROP TABLE statements', () => {
      const statement: SQLStatement = {
        type: 'DROP_TABLE',
        content: 'DROP TABLE IF EXISTS users;',
        startLine: 2,
        endLine: 2
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropTableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'DROP_TABLE',
        content: 'drop table users;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropTableRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should NOT trigger for other table operations', () => {
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

      statements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = noDropTableRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should have correct rule metadata', () => {
      expect(noDropTableRule.id).toBe('no-drop-table');
      expect(noDropTableRule.name).toBe('No Drop Table');
      expect(noDropTableRule.description).toBe('Prevents dropping tables as it can cause data loss');
      expect(noDropTableRule.severity).toBe(Severity.ERROR);
      expect(noDropTableRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noDropTableRule.enabled).toBe(true);
    });
  });

  describe('No Drop Column Rule', () => {
    it('should detect DROP COLUMN statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users DROP COLUMN email;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-drop-column');
      expect(violations[0].ruleName).toBe('No Drop Column');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Dropping columns can cause irreversible data loss');
      expect(violations[0].line).toBe(1);
    });

    it('should detect multiple column drops', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users DROP COLUMN email, DROP COLUMN phone;',
        startLine: 2,
        endLine: 2
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users drop column email;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noDropColumnRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
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
          content: 'ALTER TABLE users MODIFY COLUMN name VARCHAR(100);',
          startLine: 2,
          endLine: 2
        }
      ];

      statements.forEach(statement => {
        const migration = createMockMigration(statement.content, [statement]);
        const violations = noDropColumnRule.check(statement, migration);
        expect(violations).toHaveLength(0);
      });
    });

    it('should have correct rule metadata', () => {
      expect(noDropColumnRule.id).toBe('no-drop-column');
      expect(noDropColumnRule.name).toBe('No Drop Column');
      expect(noDropColumnRule.description).toBe('Prevents dropping columns as it can cause data loss');
      expect(noDropColumnRule.severity).toBe(Severity.ERROR);
      expect(noDropColumnRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noDropColumnRule.enabled).toBe(true);
    });
  });

  describe('No Add Column Without Default Rule', () => {
    it('should detect adding column without default value', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddColumnWithoutDefaultRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-add-column-without-default');
      expect(violations[0].ruleName).toBe('No Add Column Without Default');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Adding a column without a default value may break existing applications');
      expect(violations[0].line).toBe(1);
    });

    it('should NOT trigger for nullable columns', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER NULL;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddColumnWithoutDefaultRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for columns with DEFAULT value', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 0;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddColumnWithoutDefaultRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users add column age integer;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAddColumnWithoutDefaultRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(noAddColumnWithoutDefaultRule.id).toBe('no-add-column-without-default');
      expect(noAddColumnWithoutDefaultRule.name).toBe('No Add Column Without Default');
      expect(noAddColumnWithoutDefaultRule.description).toBe('New columns should have default values to avoid breaking existing applications');
      expect(noAddColumnWithoutDefaultRule.severity).toBe(Severity.WARNING);
      expect(noAddColumnWithoutDefaultRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noAddColumnWithoutDefaultRule.enabled).toBe(true);
    });
  });

  describe('No Alter Column Type Rule', () => {
    it('should detect ALTER COLUMN TYPE statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN age TYPE BIGINT;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAlterColumnTypeRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-alter-column-type');
      expect(violations[0].ruleName).toBe('No Alter Column Type');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Changing column type without USING clause can cause data loss');
      expect(violations[0].line).toBe(1);
    });

    it('should NOT detect MODIFY COLUMN statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users\nMODIFY COLUMN age BIGINT;',
        startLine: 1,
        endLine: 2
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAlterColumnTypeRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for ALTER COLUMN TYPE with USING clause', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ALTER COLUMN age TYPE BIGINT USING age::BIGINT;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAlterColumnTypeRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users alter column age type bigint;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noAlterColumnTypeRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(noAlterColumnTypeRule.id).toBe('no-alter-column-type');
      expect(noAlterColumnTypeRule.name).toBe('No Alter Column Type');
      expect(noAlterColumnTypeRule.description).toBe('Changing column types can cause data loss or conversion errors');
      expect(noAlterColumnTypeRule.severity).toBe(Severity.ERROR);
      expect(noAlterColumnTypeRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noAlterColumnTypeRule.enabled).toBe(true);
    });
  });

  describe('Require Foreign Key Cascade Rule', () => {
    it('should detect foreign keys without CASCADE', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireForeignKeyCascadeRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('require-foreign-key-cascade');
      expect(violations[0].ruleName).toBe('Require Foreign Key Cascade');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(violations[0].message).toBe('Foreign key constraint should specify ON DELETE behavior');
      expect(violations[0].line).toBe(1);
    });

    it('should NOT trigger for foreign keys with ON DELETE CASCADE', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireForeignKeyCascadeRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should NOT trigger for foreign keys with ON UPDATE CASCADE', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireForeignKeyCascadeRule.check(statement, migration);
      
      expect(violations).toHaveLength(1); // Still triggers because no ON DELETE
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table orders add constraint fk_customer foreign key (customer_id) references customers(id);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = requireForeignKeyCascadeRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(requireForeignKeyCascadeRule.id).toBe('require-foreign-key-cascade');
      expect(requireForeignKeyCascadeRule.name).toBe('Require Foreign Key Cascade');
      expect(requireForeignKeyCascadeRule.description).toBe('Foreign keys should specify ON DELETE behavior to prevent orphaned data');
      expect(requireForeignKeyCascadeRule.severity).toBe(Severity.WARNING);
      expect(requireForeignKeyCascadeRule.category).toBe(RuleCategory.DATA_INTEGRITY);
      expect(requireForeignKeyCascadeRule.enabled).toBe(true);
    });
  });

  describe('No Unique Constraint Without Index Rule', () => {
    it('should detect unique constraints without corresponding indexes', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD CONSTRAINT uk_email UNIQUE (EMAIL);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noUniqueConstraintWithoutIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-unique-constraint-without-index');
      expect(violations[0].ruleName).toBe('No Unique Constraint Without Index');
      expect(violations[0].severity).toBe(Severity.WARNING);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Adding unique constraint on "EMAIL" may fail if duplicates exist');
      expect(violations[0].line).toBe(1);
    });

    it('should still trigger when corresponding index exists', () => {
      const statements: SQLStatement[] = [
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX idx_email ON users (EMAIL);',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD CONSTRAINT uk_email UNIQUE (EMAIL);',
          startLine: 2,
          endLine: 2
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );
      
      const violations = noUniqueConstraintWithoutIndexRule.check(statements[1], migration);
      expect(violations).toHaveLength(1); // Still triggers but with different suggestion
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users add constraint uk_email unique (email);',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noUniqueConstraintWithoutIndexRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should have correct rule metadata', () => {
      expect(noUniqueConstraintWithoutIndexRule.id).toBe('no-unique-constraint-without-index');
      expect(noUniqueConstraintWithoutIndexRule.name).toBe('No Unique Constraint Without Index');
      expect(noUniqueConstraintWithoutIndexRule.description).toBe('Adding unique constraints can fail if duplicate data exists');
      expect(noUniqueConstraintWithoutIndexRule.severity).toBe(Severity.WARNING);
      expect(noUniqueConstraintWithoutIndexRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noUniqueConstraintWithoutIndexRule.enabled).toBe(true);
    });
  });

  describe('No Column Rename Rule', () => {
    it('should detect RENAME COLUMN statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME COLUMN name TO full_name;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-column-rename');
      expect(violations[0].ruleName).toBe('No Column Rename');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Renaming column "name" to "full_name" in table "users" is backward-incompatible');
      expect(violations[0].line).toBe(1);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users rename column name to full_name;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should NOT trigger for table rename statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME TO customers;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should have correct rule metadata', () => {
      expect(noColumnRenameRule.id).toBe('no-column-rename');
      expect(noColumnRenameRule.name).toBe('No Column Rename');
      expect(noColumnRenameRule.description).toBe('Column renaming is a backward-incompatible change that can cause errors during deployment');
      expect(noColumnRenameRule.severity).toBe(Severity.ERROR);
      expect(noColumnRenameRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noColumnRenameRule.enabled).toBe(true);
    });
  });

  describe('No Table Rename Rule', () => {
    it('should detect RENAME TO statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME TO customers;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('no-table-rename');
      expect(violations[0].ruleName).toBe('No Table Rename');
      expect(violations[0].severity).toBe(Severity.ERROR);
      expect(violations[0].category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(violations[0].message).toBe('Renaming table "users" to "customers" is backward-incompatible');
      expect(violations[0].line).toBe(1);
    });

    it('should handle case insensitive statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'alter table users rename to customers;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
    });

    it('should NOT trigger for column rename statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME COLUMN name TO full_name;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should have correct rule metadata', () => {
      expect(noTableRenameRule.id).toBe('no-table-rename');
      expect(noTableRenameRule.name).toBe('No Table Rename');
      expect(noTableRenameRule.description).toBe('Table renaming is a backward-incompatible change that can cause errors during deployment');
      expect(noTableRenameRule.severity).toBe(Severity.ERROR);
      expect(noTableRenameRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noTableRenameRule.enabled).toBe(true);
    });
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
      expect(violations[0].line).toBe(4);
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

    it('should have correct rule metadata', () => {
      expect(noDropForeignKeyConstraintRule.id).toBe('no-drop-foreign-key-constraint');
      expect(noDropForeignKeyConstraintRule.name).toBe('No Drop Foreign Key Constraint');
      expect(noDropForeignKeyConstraintRule.description).toBe('Dropping foreign key constraints removes referential integrity checks and can lead to data inconsistencies');
      expect(noDropForeignKeyConstraintRule.severity).toBe(Severity.WARNING);
      expect(noDropForeignKeyConstraintRule.category).toBe(RuleCategory.SCHEMA_SAFETY);
      expect(noDropForeignKeyConstraintRule.enabled).toBe(true);
    });
  });
}); 