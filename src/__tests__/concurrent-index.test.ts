import { requireConcurrentIndexRule } from '../rules/performance/require-concurrent-index';
import { Migration, SQLStatement } from '../types';

describe('Concurrent Index Rule', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

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
    expect(violations[0].message).toContain('Creating index without CONCURRENTLY blocks writes');
    expect(violations[0].suggestion).toContain('CREATE INDEX CONCURRENTLY');
  });

  it('should detect DROP INDEX without CONCURRENTLY', () => {
    const statement: SQLStatement = {
      type: 'DROP_INDEX',
      content: 'DROP INDEX idx_users_email;',
      startLine: 1,
      endLine: 1
    };
    
    const migration = createMockMigration(statement.content, [statement]);
    const violations = requireConcurrentIndexRule.check(statement, migration);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Dropping index without CONCURRENTLY blocks all table access');
    expect(violations[0].suggestion).toContain('DROP INDEX CONCURRENTLY');
  });

  it('should detect UNIQUE INDEX without CONCURRENTLY', () => {
    const statement: SQLStatement = {
      type: 'CREATE_INDEX',
      content: 'CREATE UNIQUE INDEX idx_users_email ON users(email);',
      startLine: 1,
      endLine: 1
    };
    
    const migration = createMockMigration(statement.content, [statement]);
    const violations = requireConcurrentIndexRule.check(statement, migration);
    
    expect(violations).toHaveLength(2); // Both regular and unique index violations
    expect(violations.some(v => v.message.includes('unique index'))).toBe(true);
  });

  it('should detect CONCURRENTLY with transaction markers', () => {
    const statements: SQLStatement[] = [
      {
        type: 'UNKNOWN',
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
        type: 'UNKNOWN',
        content: 'COMMIT;',
        startLine: 3,
        endLine: 3
      }
    ];
    
    const migration = createMockMigration('BEGIN;\nCREATE INDEX CONCURRENTLY idx_users_email ON users(email);\nCOMMIT;', statements);
    const violations = requireConcurrentIndexRule.check(statements[1], migration);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('CONCURRENTLY operations cannot be run within a transaction');
    expect(violations[0].severity).toBe('error');
  });

  it('should not report violations for correct CONCURRENTLY usage', () => {
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

  it('should allow CONCURRENTLY with no-transaction directive', () => {
    const statement: SQLStatement = {
      type: 'CREATE_INDEX',
      content: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
      startLine: 2,
      endLine: 2
    };
    
    const migrationContent = '-- disable-transaction\nCREATE INDEX CONCURRENTLY idx_users_email ON users(email);';
    const migration = createMockMigration(migrationContent, [statement]);
    const violations = requireConcurrentIndexRule.check(statement, migration);
    
    expect(violations).toHaveLength(0);
  });
}); 