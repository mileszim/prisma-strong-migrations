import { PrismaStrongMigrationsLinter } from '../../core/linter';
import { MigrationScanner } from '../../core/migration-scanner';
import { RuleEngine } from '../../core/rule-engine';
import { ConfigManager } from '../../core/config';
import { GitUtils } from '../../utils/git';
import { getBuiltInRules } from '../../rules';
import { Severity, RuleCategory } from '../../types';

// Mock dependencies
jest.mock('../../core/migration-scanner');
jest.mock('../../core/rule-engine');
jest.mock('../../core/config');
jest.mock('../../utils/git');
jest.mock('../../rules');

const mockMigrationScanner = jest.mocked(MigrationScanner);
const mockRuleEngine = jest.mocked(RuleEngine);
const mockConfigManager = jest.mocked(ConfigManager);
const mockGitUtils = jest.mocked(GitUtils);
const mockGetBuiltInRules = jest.mocked(getBuiltInRules);

describe('PrismaStrongMigrationsLinter', () => {
  let linter: PrismaStrongMigrationsLinter;
  let mockScannerInstance: any;
  let mockRuleEngineInstance: any;
  let mockConfigInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock built-in rules
    mockGetBuiltInRules.mockReturnValue([
      {
        id: 'no-drop-table',
        name: 'No Drop Table',
        description: 'Prevent dropping tables',
        severity: Severity.ERROR,
        category: RuleCategory.SCHEMA_SAFETY,
        enabled: true,
        check: jest.fn(),
        recommendation: 'Consider renaming instead'
      },
      {
        id: 'require-pii-comments',
        name: 'Require PII Comments',
        description: 'Require PII comments',
        severity: Severity.INFO,
        category: RuleCategory.DATA_INTEGRITY,
        enabled: false,
        check: jest.fn()
      }
    ]);

    // Mock config manager
    mockConfigInstance = {
      getConfig: jest.fn().mockReturnValue({
        dialect: 'postgresql',
        migrationsPath: './prisma/migrations',
        rules: {
          'no-drop-table': { enabled: true, severity: Severity.ERROR },
          'require-pii-comments': { enabled: false, severity: Severity.INFO }
        }
      }),
      getMigrationsPath: jest.fn().mockReturnValue('./prisma/migrations'),
      getIncludePatterns: jest.fn().mockReturnValue(['**/*.sql']),
      getExcludePatterns: jest.fn().mockReturnValue(['**/test/**'])
    };
    mockConfigManager.mockImplementation(() => mockConfigInstance);

    // Mock migration scanner
    mockScannerInstance = {
      scanMigrations: jest.fn(),
      getRecentMigrations: jest.fn(),
      getMigrationsSince: jest.fn(),
      scanSingleMigration: jest.fn()
    };
    mockMigrationScanner.mockImplementation(() => mockScannerInstance);

    // Mock rule engine
    mockRuleEngineInstance = {
      addRule: jest.fn(),
      removeRule: jest.fn(),
      enableRule: jest.fn(),
      disableRule: jest.fn(),
      getEnabledRules: jest.fn(),
      getAllRules: jest.fn(),
      analyzeMigrations: jest.fn(),
      analyzeMigration: jest.fn()
    };
    mockRuleEngine.mockImplementation(() => mockRuleEngineInstance);

    linter = new PrismaStrongMigrationsLinter();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(mockConfigManager).toHaveBeenCalledWith(undefined);
      expect(mockMigrationScanner).toHaveBeenCalledWith('postgresql');
      expect(mockRuleEngine).toHaveBeenCalled();
    });

    it('should initialize with custom config path', () => {
      new PrismaStrongMigrationsLinter('./custom-config.js');
      
      expect(mockConfigManager).toHaveBeenCalledWith('./custom-config.js');
    });

    it('should initialize rules from built-in rules', () => {
      expect(mockGetBuiltInRules).toHaveBeenCalled();
      expect(mockRuleEngineInstance.addRule).toHaveBeenCalledTimes(2);
    });

    it('should apply rule configuration overrides', () => {
      const addRuleCalls = mockRuleEngineInstance.addRule.mock.calls;
      
      // Check that rules are configured according to config
      expect(addRuleCalls[0][0]).toMatchObject({
        id: 'no-drop-table',
        enabled: true,
        severity: Severity.ERROR
      });
      
      expect(addRuleCalls[1][0]).toMatchObject({
        id: 'require-pii-comments',
        enabled: false,
        severity: Severity.INFO
      });
    });
  });

  describe('lintMigrations', () => {
    it('should scan and analyze all migrations', async () => {
      const mockMigrations = [
        { id: '001', filename: 'migration1.sql', content: 'CREATE TABLE test;', statements: [] },
        { id: '002', filename: 'migration2.sql', content: 'DROP TABLE old;', statements: [] }
      ];
      
      const mockResult = {
        violations: [],
        totalFiles: 2,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      mockScannerInstance.scanMigrations.mockResolvedValue(mockMigrations);
      mockRuleEngineInstance.analyzeMigrations.mockResolvedValue(mockResult);

      const result = await linter.lintMigrations();

      expect(mockScannerInstance.scanMigrations).toHaveBeenCalledWith(
        './prisma/migrations',
        ['**/*.sql'],
        ['**/test/**']
      );
      expect(mockRuleEngineInstance.analyzeMigrations).toHaveBeenCalledWith(mockMigrations);
      expect(result).toEqual(mockResult);
    });
  });

  describe('lintRecentMigrations', () => {
    it('should scan and analyze recent migrations', async () => {
      const mockMigrations = [
        { id: '003', filename: 'migration3.sql', content: 'ALTER TABLE test;', statements: [] }
      ];
      
      const mockResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      mockScannerInstance.getRecentMigrations.mockResolvedValue(mockMigrations);
      mockRuleEngineInstance.analyzeMigrations.mockResolvedValue(mockResult);

      const result = await linter.lintRecentMigrations(2);

      expect(mockScannerInstance.getRecentMigrations).toHaveBeenCalledWith('./prisma/migrations', 2);
      expect(result).toEqual(mockResult);
    });

    it('should default to 1 recent migration', async () => {
      mockScannerInstance.getRecentMigrations.mockResolvedValue([]);
      mockRuleEngineInstance.analyzeMigrations.mockResolvedValue({
        violations: [], totalFiles: 0, totalViolations: 0, errorCount: 0, warningCount: 0, infoCount: 0
      });

      await linter.lintRecentMigrations();

      expect(mockScannerInstance.getRecentMigrations).toHaveBeenCalledWith('./prisma/migrations', 1);
    });
  });

  describe('lintMigrationsSince', () => {
    it('should scan and analyze migrations since specific ID', async () => {
      const mockMigrations = [
        { id: '002', filename: 'migration2.sql', content: 'CREATE INDEX;', statements: [] }
      ];
      
      const mockResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      mockScannerInstance.getMigrationsSince.mockResolvedValue(mockMigrations);
      mockRuleEngineInstance.analyzeMigrations.mockResolvedValue(mockResult);

      const result = await linter.lintMigrationsSince('001_init');

      expect(mockScannerInstance.getMigrationsSince).toHaveBeenCalledWith('./prisma/migrations', '001_init');
      expect(result).toEqual(mockResult);
    });
  });

  describe('lintFile', () => {
    it('should scan and analyze single migration file', async () => {
      const mockMigration = {
        id: 'single',
        filename: 'single.sql',
        content: 'CREATE TABLE users;',
        statements: []
      };
      
      const mockViolations = [
        {
          ruleId: 'no-drop-table',
          ruleName: 'No Drop Table',
          severity: Severity.ERROR,
          message: 'Dropping tables is dangerous',
          line: 1,
          category: RuleCategory.SCHEMA_SAFETY
        }
      ];

      mockScannerInstance.scanSingleMigration.mockResolvedValue(mockMigration);
      mockRuleEngineInstance.analyzeMigration.mockResolvedValue(mockViolations);

      const result = await linter.lintFile('./test.sql');

      expect(mockScannerInstance.scanSingleMigration).toHaveBeenCalledWith('./test.sql');
      expect(mockRuleEngineInstance.analyzeMigration).toHaveBeenCalledWith(mockMigration);
      expect(result).toEqual({
        violations: mockViolations,
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      });
    });
  });

  describe('lintChangedMigrations', () => {
    beforeEach(() => {
      mockGitUtils.isGitRepository.mockReturnValue(true);
      mockGitUtils.getChangedMigrationFiles.mockReturnValue([
        './prisma/migrations/001_init/migration.sql',
        './prisma/migrations/002_users/migration.sql'
      ]);
    });

    it('should lint changed migration files', async () => {
      const mockMigration = {
        id: '001',
        filename: 'migration.sql',
        content: 'CREATE TABLE test;',
        statements: []
      };

      mockScannerInstance.scanSingleMigration.mockResolvedValue(mockMigration);
      mockRuleEngineInstance.analyzeMigration.mockResolvedValue([]);

      const result = await linter.lintChangedMigrations();

      expect(mockGitUtils.isGitRepository).toHaveBeenCalled();
      expect(mockGitUtils.getChangedMigrationFiles).toHaveBeenCalledWith('./prisma/migrations', {});
      expect(mockScannerInstance.scanSingleMigration).toHaveBeenCalledTimes(2);
      expect(result.totalFiles).toBe(2);
    });

    it('should pass git options to getChangedMigrationFiles', async () => {
      const gitOptions = {
        base: 'origin/develop',
        addedOnly: true
      };

      mockScannerInstance.scanSingleMigration.mockResolvedValue({
        id: '001', filename: 'test.sql', content: '', statements: []
      });
      mockRuleEngineInstance.analyzeMigration.mockResolvedValue([]);

      await linter.lintChangedMigrations(gitOptions);

      expect(mockGitUtils.getChangedMigrationFiles).toHaveBeenCalledWith('./prisma/migrations', gitOptions);
    });

    it('should return empty result when no files changed', async () => {
      mockGitUtils.getChangedMigrationFiles.mockReturnValue([]);

      const result = await linter.lintChangedMigrations();

      expect(result).toEqual({
        violations: [],
        totalFiles: 0,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      });
    });

    it('should throw error when not in git repository', async () => {
      mockGitUtils.isGitRepository.mockReturnValue(false);

      await expect(linter.lintChangedMigrations()).rejects.toThrow(
        'Not in a git repository. Cannot detect changed files.'
      );
    });

    it('should handle file read errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockScannerInstance.scanSingleMigration
        .mockResolvedValueOnce({ id: '001', filename: 'test1.sql', content: '', statements: [] })
        .mockRejectedValueOnce(new Error('File not found'));
      
      mockRuleEngineInstance.analyzeMigration.mockResolvedValue([]);

      const result = await linter.lintChangedMigrations();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not analyze migration file')
      );
      expect(result.totalFiles).toBe(2); // Still counts the file even if it failed
      
      consoleSpy.mockRestore();
    });
  });

  describe('lintChangedMigrationsSinceCommit', () => {
    beforeEach(() => {
      mockGitUtils.isGitRepository.mockReturnValue(true);
      mockGitUtils.getChangedMigrationFilesSinceCommit.mockReturnValue([
        './prisma/migrations/003_new/migration.sql'
      ]);
    });

    it('should lint changed migration files since commit', async () => {
      const mockMigration = {
        id: '003',
        filename: 'migration.sql',
        content: 'ALTER TABLE test;',
        statements: []
      };

      mockScannerInstance.scanSingleMigration.mockResolvedValue(mockMigration);
      mockRuleEngineInstance.analyzeMigration.mockResolvedValue([]);

      const result = await linter.lintChangedMigrationsSinceCommit('abc123');

      expect(mockGitUtils.getChangedMigrationFilesSinceCommit).toHaveBeenCalledWith(
        './prisma/migrations',
        'abc123'
      );
      expect(result.totalFiles).toBe(1);
    });

    it('should throw error when not in git repository', async () => {
      mockGitUtils.isGitRepository.mockReturnValue(false);

      await expect(linter.lintChangedMigrationsSinceCommit('abc123')).rejects.toThrow(
        'Not in a git repository. Cannot detect changed files.'
      );
    });
  });

  describe('rule management', () => {
    it('should add rule', () => {
      const newRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'Custom rule description',
        severity: Severity.WARNING,
        category: RuleCategory.BEST_PRACTICES,
        enabled: true,
        check: jest.fn()
      };

      linter.addRule(newRule);

      expect(mockRuleEngineInstance.addRule).toHaveBeenCalledWith(newRule);
    });

    it('should remove rule', () => {
      linter.removeRule('no-drop-table');

      expect(mockRuleEngineInstance.removeRule).toHaveBeenCalledWith('no-drop-table');
    });

    it('should enable rule', () => {
      linter.enableRule('require-pii-comments');

      expect(mockRuleEngineInstance.enableRule).toHaveBeenCalledWith('require-pii-comments');
    });

    it('should disable rule', () => {
      linter.disableRule('no-drop-table');

      expect(mockRuleEngineInstance.disableRule).toHaveBeenCalledWith('no-drop-table');
    });

    it('should get enabled rules', () => {
      const mockEnabledRules = [
        { id: 'no-drop-table', enabled: true }
      ];
      
      mockRuleEngineInstance.getEnabledRules.mockReturnValue(mockEnabledRules);

      const result = linter.getEnabledRules();

      expect(mockRuleEngineInstance.getEnabledRules).toHaveBeenCalled();
      expect(result).toEqual(mockEnabledRules);
    });

    it('should get all rules', () => {
      const mockAllRules = [
        { id: 'no-drop-table', enabled: true },
        { id: 'require-pii-comments', enabled: false }
      ];
      
      mockRuleEngineInstance.getAllRules.mockReturnValue(mockAllRules);

      const result = linter.getAllRules();

      expect(mockRuleEngineInstance.getAllRules).toHaveBeenCalled();
      expect(result).toEqual(mockAllRules);
    });
  });

  describe('getConfig', () => {
    it('should return config manager instance', () => {
      const result = linter.getConfig();

      expect(result).toBe(mockConfigInstance);
    });
  });

  describe('shouldExit', () => {
    beforeEach(() => {
      mockConfigInstance.getConfig.mockReturnValue({
        failOnError: true,
        failOnWarning: false
      });
    });

    it('should return true when there are errors and failOnError is true', () => {
      const result = {
        violations: [],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      expect(linter.shouldExit(result)).toBe(true);
    });

    it('should return false when there are no errors', () => {
      const result = {
        violations: [],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 0,
        warningCount: 1,
        infoCount: 0
      };

      expect(linter.shouldExit(result)).toBe(false);
    });

    it('should return true when there are warnings and failOnWarning is true', () => {
      mockConfigInstance.getConfig.mockReturnValue({
        failOnError: true,
        failOnWarning: true
      });

      const result = {
        violations: [],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 0,
        warningCount: 1,
        infoCount: 0
      };

      expect(linter.shouldExit(result)).toBe(true);
    });

    it('should return false when failOnError is disabled', () => {
      mockConfigInstance.getConfig.mockReturnValue({
        failOnError: false,
        failOnWarning: false
      });

      const result = {
        violations: [],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };

      expect(linter.shouldExit(result)).toBe(false);
    });
  });
}); 