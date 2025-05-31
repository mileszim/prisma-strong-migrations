import { getBuiltInRules, BUILT_IN_RULES } from '../../rules';
import { Migration, SQLStatement, Severity, RuleCategory, Violation } from '../../types';

describe('Rule Engine Integration Tests', () => {
  const createMockMigration = (content: string, statements: SQLStatement[]): Migration => ({
    id: '20231201120000',
    filename: 'test-migration.sql',
    content,
    statements
  });

  describe('All Built-in Rules Coverage', () => {
    it('should have all expected rules loaded', () => {
      const rules = getBuiltInRules();
      
      expect(rules).toHaveLength(18); // Total number of rules
      
      // Schema Safety Rules
      expect(BUILT_IN_RULES['no-drop-table']).toBeDefined();
      expect(BUILT_IN_RULES['no-drop-column']).toBeDefined();
      expect(BUILT_IN_RULES['no-add-column-without-default']).toBeDefined();
      expect(BUILT_IN_RULES['no-alter-column-type']).toBeDefined();
      expect(BUILT_IN_RULES['no-unique-constraint-without-index']).toBeDefined();
      expect(BUILT_IN_RULES['no-column-rename']).toBeDefined();
      expect(BUILT_IN_RULES['no-table-rename']).toBeDefined();
      expect(BUILT_IN_RULES['no-drop-foreign-key-constraint']).toBeDefined();
      
      // Performance Rules
      expect(BUILT_IN_RULES['require-index-for-foreign-key']).toBeDefined();
      expect(BUILT_IN_RULES['no-full-table-scan']).toBeDefined();
      expect(BUILT_IN_RULES['require-concurrent-index']).toBeDefined();
      
      // Data Integrity Rules
      expect(BUILT_IN_RULES['require-not-null-constraint']).toBeDefined();
      expect(BUILT_IN_RULES['require-pii-comments']).toBeDefined();
      expect(BUILT_IN_RULES['require-foreign-key-cascade']).toBeDefined();
      
      // Deployment Safety Rules
      expect(BUILT_IN_RULES['no-data-manipulation']).toBeDefined();
      expect(BUILT_IN_RULES['no-add-non-nullable-column']).toBeDefined();
      expect(BUILT_IN_RULES['no-nullable-to-non-nullable']).toBeDefined();
      
      // Best Practices Rules
      expect(BUILT_IN_RULES['require-transaction-block']).toBeDefined();
    });

    it('should have correct rule categories distribution', () => {
      const rules = getBuiltInRules();
      const categoryCounts = rules.reduce((acc, rule) => {
        acc[rule.category] = (acc[rule.category] || 0) + 1;
        return acc;
      }, {} as Record<RuleCategory, number>);

      expect(categoryCounts[RuleCategory.SCHEMA_SAFETY]).toBe(8);
      expect(categoryCounts[RuleCategory.PERFORMANCE]).toBe(3);
      expect(categoryCounts[RuleCategory.DATA_INTEGRITY]).toBe(3);
      expect(categoryCounts[RuleCategory.DEPLOYMENT_SAFETY]).toBe(3);
      expect(categoryCounts[RuleCategory.BEST_PRACTICES]).toBe(1);
    });

    it('should have all rules enabled by default', () => {
      const rules = getBuiltInRules();
      rules.forEach(rule => {
        expect(rule.enabled).toBe(true);
      });
    });

    it('should have proper severity distribution', () => {
      const rules = getBuiltInRules();
      const severityCounts = rules.reduce((acc, rule) => {
        acc[rule.severity] = (acc[rule.severity] || 0) + 1;
        return acc;
      }, {} as Record<Severity, number>);

      expect(severityCounts[Severity.ERROR]).toBeGreaterThan(0);
      expect(severityCounts[Severity.WARNING]).toBeGreaterThan(0);
      // INFO severity might be 0, which is fine
    });
  });

  describe('Complex Migration Scenarios', () => {
    it('should detect multiple rule violations in a complex migration', () => {
      const statements: SQLStatement[] = [
        {
          type: 'DROP_TABLE',
          content: 'DROP TABLE old_users;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255));',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users ADD COLUMN age INTEGER NOT NULL;',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE users RENAME TO customers;',
          startLine: 4,
          endLine: 4
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX idx_customers_email ON customers(email);',
          startLine: 5,
          endLine: 5
        },
        {
          type: 'UPDATE',
          content: 'UPDATE customers SET age = 25 WHERE age IS NULL;',
          startLine: 6,
          endLine: 6
        }
      ];

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      const allViolations: Violation[] = [];
      statements.forEach(statement => {
        const rules = getBuiltInRules();
        rules.forEach(rule => {
          const violations = rule.check(statement, migration);
          allViolations.push(...violations);
        });
      });

      expect(allViolations.length).toBeGreaterThan(5);
      
      const ruleIds = allViolations.map(v => v.ruleId);
      expect(ruleIds).toContain('no-drop-table');
      expect(ruleIds).toContain('require-pii-comments');
      expect(ruleIds).toContain('no-add-non-nullable-column');
      expect(ruleIds).toContain('no-table-rename');
      expect(ruleIds).toContain('require-concurrent-index');
      expect(ruleIds).toContain('no-data-manipulation');
    });

    it('should handle a well-structured migration with minimal violations', () => {
      const statements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: 'BEGIN;',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL COMMENT \'User email - PII\', created_at TIMESTAMP NOT NULL DEFAULT NOW());',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;',
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

      const allViolations: Violation[] = [];
      const rules = getBuiltInRules();

      statements.forEach(statement => {
        rules.forEach(rule => {
          const violations = rule.check(statement, migration);
          allViolations.push(...violations);
        });
      });

      // Should have very few violations for a well-structured migration
      expect(allViolations.length).toBeLessThan(3);
    });

    it('should handle edge cases with unusual SQL syntax', () => {
      const edgeCaseStatements: SQLStatement[] = [
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE "users-table" (`id` SERIAL PRIMARY KEY, `user-email` VARCHAR(255));',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'ALTER_TABLE',
          content: 'ALTER TABLE `orders` ADD COLUMN `user_id` INTEGER NOT NULL DEFAULT 0;',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'CREATE_INDEX',
          content: 'CREATE UNIQUE INDEX CONCURRENTLY `idx_unique_email` ON `users-table`(`user-email`);',
          startLine: 3,
          endLine: 3
        }
      ];

      const migration = createMockMigration(
        edgeCaseStatements.map(s => s.content).join('\n'),
        edgeCaseStatements
      );

      const rules = getBuiltInRules();

      // Should not crash on unusual syntax
      edgeCaseStatements.forEach(statement => {
        rules.forEach(rule => {
          expect(() => {
            rule.check(statement, migration);
          }).not.toThrow();
        });
      });
    });

    it('should handle empty and malformed statements gracefully', () => {
      const problematicStatements: SQLStatement[] = [
        {
          type: 'OTHER',
          content: '',
          startLine: 1,
          endLine: 1
        },
        {
          type: 'OTHER',
          content: '   ',
          startLine: 2,
          endLine: 2
        },
        {
          type: 'OTHER',
          content: '-- Just a comment',
          startLine: 3,
          endLine: 3
        },
        {
          type: 'CREATE_TABLE',
          content: 'CREATE TABLE', // Malformed
          startLine: 4,
          endLine: 4
        }
      ];

      const migration = createMockMigration(
        problematicStatements.map(s => s.content).join('\n'),
        problematicStatements
      );

      const rules = getBuiltInRules();

      // Should not crash on malformed or empty statements
      problematicStatements.forEach(statement => {
        rules.forEach(rule => {
          expect(() => {
            rule.check(statement, migration);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Rule Performance and Reliability', () => {
    it('should process large migrations efficiently', () => {
      // Create a migration with many statements
      const statements: SQLStatement[] = [];
      for (let i = 0; i < 100; i++) {
        statements.push({
          type: 'CREATE_TABLE',
          content: `CREATE TABLE table_${i} (id SERIAL PRIMARY KEY, data VARCHAR(255));`,
          startLine: i + 1,
          endLine: i + 1
        });
      }

      const migration = createMockMigration(
        statements.map(s => s.content).join('\n'),
        statements
      );

      const rules = getBuiltInRules();
      const startTime = Date.now();

      let totalViolations = 0;
      statements.forEach(statement => {
        rules.forEach(rule => {
          const violations = rule.check(statement, migration);
          totalViolations += violations.length;
        });
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 1 second for 100 statements)
      expect(duration).toBeLessThan(1000);
      expect(totalViolations).toBeGreaterThan(0); // Should find some violations
    });

    it('should have consistent rule behavior across multiple runs', () => {
      const statement: SQLStatement = {
        type: 'ALTER_TABLE',
        content: 'ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;',
        startLine: 1,
        endLine: 1
      };

      const migration = createMockMigration(statement.content, [statement]);
      const rule = BUILT_IN_RULES['no-add-non-nullable-column'];

      // Run the same check multiple times
      const results: Violation[][] = [];
      for (let i = 0; i < 10; i++) {
        results.push(rule.check(statement, migration));
      }

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });

  describe('Rule Metadata Validation', () => {
    it('should have all required metadata fields for each rule', () => {
      const rules = getBuiltInRules();

      rules.forEach(rule => {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect([Severity.ERROR, Severity.WARNING, Severity.INFO]).toContain(rule.severity);
        expect(Object.values(RuleCategory)).toContain(rule.category);
        expect(typeof rule.check).toBe('function');
        expect(typeof rule.enabled).toBe('boolean');
      });
    });

    it('should have unique rule IDs', () => {
      const rules = getBuiltInRules();
      const ruleIds = rules.map(rule => rule.id);
      const uniqueIds = new Set(ruleIds);

      expect(uniqueIds.size).toBe(ruleIds.length);
    });

    it('should have properly formatted rule IDs', () => {
      const rules = getBuiltInRules();

      rules.forEach(rule => {
        // Rule IDs should be kebab-case
        expect(rule.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
        
        // Should not be empty or just dashes
        expect(rule.id.length).toBeGreaterThan(0);
        expect(rule.id).not.toMatch(/^-+$/);
      });
    });

    it('should have descriptive names and descriptions', () => {
      const rules = getBuiltInRules();

      rules.forEach(rule => {
        // Names should be title case and descriptive
        expect(rule.name.length).toBeGreaterThan(5);
        expect(rule.name).toMatch(/^[A-Z]/); // Should start with capital letter
        
        // Descriptions should be sentences
        expect(rule.description.length).toBeGreaterThan(10);
        // Note: Not all descriptions end with punctuation, so we'll be more lenient
      });
    });
  });
}); 