import { noColumnRenameRule } from '../rules/schema-safety/no-column-rename';
import { noTableRenameRule } from '../rules/schema-safety/no-table-rename';
import { Migration, SQLStatement } from '../types';

describe('Backward Compatibility Rules', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('No Column Rename Rule', () => {
    it('should detect column renaming with RENAME COLUMN', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME COLUMN user_name TO name;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Renaming column "user_name" to "name"');
      expect(violations[0].message).toContain('backward-incompatible');
      expect(violations[0].suggestion).toContain('expand-and-contract pattern');
      expect(violations[0].suggestion).toContain('ADD COLUMN name');
      expect(violations[0].suggestion).toContain('UPDATE users SET name = user_name');
    });

    it('should detect column renaming with quoted identifiers', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE "users" RENAME COLUMN "user_name" TO "full_name";',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('user_name');
      expect(violations[0].message).toContain('full_name');
    });

    it('should not trigger for non-rename ALTER TABLE statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });

    it('should not trigger for table renames', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME TO new_users;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noColumnRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0); // Should not trigger for table renames
    });
  });

  describe('No Table Rename Rule', () => {
    it('should detect table renaming', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME TO customers;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Renaming table "users" to "customers"');
      expect(violations[0].message).toContain('backward-incompatible');
      expect(violations[0].suggestion).toContain('CREATE VIEW users');
      expect(violations[0].suggestion).toContain('expand-and-contract');
    });

    it('should detect table renaming with quoted identifiers', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE `old_table` RENAME TO `new_table`;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('old_table');
      expect(violations[0].message).toContain('new_table');
    });

    it('should not trigger for column renames', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users RENAME COLUMN old_name TO new_name;',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0); // Should not trigger for column renames
    });

    it('should not trigger for non-rename ALTER TABLE statements', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
        startLine: 1,
        endLine: 1
      };
      
      const migration = createMockMigration(statement.content, [statement]);
      const violations = noTableRenameRule.check(statement, migration);
      
      expect(violations).toHaveLength(0);
    });
  });
}); 