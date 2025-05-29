import { PrismaStrongMigrationsLinter } from '../core/linter';
import { getBuiltInRules } from '../rules';

describe('Prisma Strong Migrations Linter', () => {
  it('should load all built-in rules', () => {
    const rules = getBuiltInRules();
    
    expect(rules.length).toBeGreaterThan(5);
    expect(rules.find(r => r.id === 'no-drop-table')).toBeDefined();
    expect(rules.find(r => r.id === 'no-alter-column-type')).toBeDefined();
    expect(rules.find(r => r.id === 'require-foreign-key-cascade')).toBeDefined();
    expect(rules.find(r => r.id === 'require-pii-comments')).toBeDefined();
    expect(rules.find(r => r.id === 'no-data-manipulation')).toBeDefined();
  });

  it('should create linter instance with default config', () => {
    const linter = new PrismaStrongMigrationsLinter();
    const enabledRules = linter.getEnabledRules();
    
    expect(enabledRules.length).toBeGreaterThan(0);
    expect(enabledRules.find(r => r.id === 'no-drop-table')?.enabled).toBe(true);
  });

  it('should detect DROP TABLE violations', async () => {
    const linter = new PrismaStrongMigrationsLinter();
    
    // Mock migration content
    const mockMigration = {
      id: '20231201120000',
      filename: 'test-migration.sql',
      content: 'DROP TABLE users;',
      statements: [{
        type: 'DROP_TABLE',
        content: 'DROP TABLE users;',
        startLine: 1,
        endLine: 1
      }]
    };

    const violations = await linter.getConfig().getConfig();
    const rule = linter.getAllRules().find(r => r.id === 'no-drop-table');
    
    expect(rule).toBeDefined();
    if (rule) {
      const ruleViolations = rule.check(mockMigration.statements[0], mockMigration);
      expect(ruleViolations.length).toBe(1);
      expect(ruleViolations[0].ruleId).toBe('no-drop-table');
      expect(ruleViolations[0].severity).toBe('error');
    }
  });
}); 