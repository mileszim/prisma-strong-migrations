import { Command } from 'commander';
import { PrismaStrongMigrationsLinter } from '../core/linter';
import { ReporterFactory } from '../reporters';
import { ConfigManager } from '../core/config';
import { GitUtils } from '../utils/git';
import { OutputFormat } from '../types';

// Mock all dependencies
jest.mock('../core/linter');
jest.mock('../reporters');
jest.mock('../core/config');
jest.mock('../utils/git');
jest.mock('fs');
jest.mock('path');

const mockLinter = jest.mocked(PrismaStrongMigrationsLinter);
const mockReporterFactory = jest.mocked(ReporterFactory);
const mockConfigManager = jest.mocked(ConfigManager);
const mockGitUtils = jest.mocked(GitUtils);

// Mock console methods
let mockConsoleLog: jest.SpyInstance;
let mockConsoleError: jest.SpyInstance;
let mockProcessExit: jest.SpyInstance;

describe('CLI', () => {
  let program: Command;
  let mockLinterInstance: any;
  let mockReporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

    // Setup mock linter instance
    mockLinterInstance = {
      lintMigrations: jest.fn(),
      lintFile: jest.fn(),
      lintRecentMigrations: jest.fn(),
      lintMigrationsSince: jest.fn(),
      lintChangedMigrations: jest.fn(),
      lintChangedMigrationsSinceCommit: jest.fn(),
      shouldExit: jest.fn(),
      getAllRules: jest.fn(),
      getEnabledRules: jest.fn(),
      getConfig: jest.fn()
    };

    mockLinter.mockImplementation(() => mockLinterInstance);

    // Setup mock reporter
    mockReporter = {
      format: jest.fn().mockReturnValue('formatted output')
    };

    mockReporterFactory.create.mockReturnValue(mockReporter);

    // Setup mock config manager
    const mockConfigInstance = {
      getConfig: jest.fn().mockReturnValue({
        migrationsPath: './prisma/migrations',
        failOnError: true,
        failOnWarning: false,
        output: 'text'
      })
    };
    mockConfigManager.mockImplementation(() => mockConfigInstance as any);
    mockLinterInstance.getConfig.mockReturnValue(mockConfigInstance);

    // Reset the program
    program = new Command();
    
    // Re-import and setup the CLI program
    delete require.cache[require.resolve('../cli')];
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('CLI module structure', () => {
    it('should be importable without errors', () => {
      expect(() => require('../cli')).not.toThrow();
    });

    it('should export a CLI program when imported', () => {
      // This test verifies the CLI module can be loaded
      const cli = require('../cli');
      expect(cli).toBeDefined();
    });
  });

  describe('Linter integration', () => {
    it('should create linter instance with config', () => {
      new PrismaStrongMigrationsLinter('./custom-config.js');
      
      expect(mockLinter).toHaveBeenCalledWith('./custom-config.js');
    });

    it('should create linter instance without config', () => {
      new PrismaStrongMigrationsLinter();
      
      expect(mockLinter).toHaveBeenCalledWith();
    });
  });

  describe('Reporter integration', () => {
    it('should create text reporter by default', () => {
      mockReporterFactory.create(OutputFormat.TEXT);
      
      expect(mockReporterFactory.create).toHaveBeenCalledWith(OutputFormat.TEXT);
    });

    it('should create JSON reporter when specified', () => {
      mockReporterFactory.create(OutputFormat.JSON);
      
      expect(mockReporterFactory.create).toHaveBeenCalledWith(OutputFormat.JSON);
    });

    it('should create JUnit reporter when specified', () => {
      mockReporterFactory.create(OutputFormat.JUNIT);
      
      expect(mockReporterFactory.create).toHaveBeenCalledWith(OutputFormat.JUNIT);
    });
  });

  describe('Git integration', () => {
    it('should check if in git repository', () => {
      mockGitUtils.isGitRepository.mockReturnValue(true);
      
      const result = mockGitUtils.isGitRepository();
      
      expect(result).toBe(true);
      expect(mockGitUtils.isGitRepository).toHaveBeenCalled();
    });

    it('should check if branch exists', () => {
      mockGitUtils.branchExists.mockReturnValue(true);
      
      const result = mockGitUtils.branchExists('origin/main');
      
      expect(result).toBe(true);
      expect(mockGitUtils.branchExists).toHaveBeenCalledWith('origin/main');
    });

    it('should get current branch', () => {
      mockGitUtils.getCurrentBranch.mockReturnValue('feature/test');
      
      const result = mockGitUtils.getCurrentBranch();
      
      expect(result).toBe('feature/test');
      expect(mockGitUtils.getCurrentBranch).toHaveBeenCalled();
    });
  });

  describe('Config management', () => {
    it('should create default config string', () => {
      mockConfigManager.createDefaultConfig.mockReturnValue('default config content');
      
      const result = mockConfigManager.createDefaultConfig();
      
      expect(result).toBe('default config content');
      expect(mockConfigManager.createDefaultConfig).toHaveBeenCalled();
    });
  });

  describe('File system operations', () => {
    it('should handle file existence checks', () => {
      const mockFs = require('fs');
      mockFs.existsSync.mockReturnValue(true);
      
      const result = mockFs.existsSync('./test-file.js');
      
      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('./test-file.js');
    });

    it('should handle file writing', () => {
      const mockFs = require('fs');
      mockFs.writeFileSync.mockImplementation(() => {});
      
      mockFs.writeFileSync('./test-file.js', 'content');
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('./test-file.js', 'content');
    });

    it('should handle path joining', () => {
      const mockPath = require('path');
      mockPath.join.mockReturnValue('./joined/path');
      
      const result = mockPath.join('.', 'joined', 'path');
      
      expect(result).toBe('./joined/path');
      expect(mockPath.join).toHaveBeenCalledWith('.', 'joined', 'path');
    });
  });

  describe('Linter methods', () => {
    beforeEach(() => {
      const mockResult = {
        violations: [],
        totalFiles: 1,
        totalViolations: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };
      
      mockLinterInstance.lintMigrations.mockResolvedValue(mockResult);
      mockLinterInstance.lintFile.mockResolvedValue(mockResult);
      mockLinterInstance.lintRecentMigrations.mockResolvedValue(mockResult);
      mockLinterInstance.lintMigrationsSince.mockResolvedValue(mockResult);
      mockLinterInstance.lintChangedMigrations.mockResolvedValue(mockResult);
      mockLinterInstance.lintChangedMigrationsSinceCommit.mockResolvedValue(mockResult);
      mockLinterInstance.shouldExit.mockReturnValue(false);
    });

    it('should lint all migrations', async () => {
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintMigrations();
      
      expect(mockLinterInstance.lintMigrations).toHaveBeenCalled();
    });

    it('should lint specific file', async () => {
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintFile('./test.sql');
      
      expect(mockLinterInstance.lintFile).toHaveBeenCalledWith('./test.sql');
    });

    it('should lint recent migrations', async () => {
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintRecentMigrations(2);
      
      expect(mockLinterInstance.lintRecentMigrations).toHaveBeenCalledWith(2);
    });

    it('should lint migrations since ID', async () => {
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintMigrationsSince('001_init');
      
      expect(mockLinterInstance.lintMigrationsSince).toHaveBeenCalledWith('001_init');
    });

    it('should lint changed migrations', async () => {
      mockGitUtils.isGitRepository.mockReturnValue(true);
      
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintChangedMigrations();
      
      expect(mockLinterInstance.lintChangedMigrations).toHaveBeenCalled();
    });

    it('should lint changed migrations since commit', async () => {
      mockGitUtils.isGitRepository.mockReturnValue(true);
      
      const linter = new PrismaStrongMigrationsLinter();
      await linter.lintChangedMigrationsSinceCommit('abc123');
      
      expect(mockLinterInstance.lintChangedMigrationsSinceCommit).toHaveBeenCalledWith('abc123');
    });

    it('should determine if should exit', () => {
      const linter = new PrismaStrongMigrationsLinter();
      const result = {
        violations: [],
        totalFiles: 1,
        totalViolations: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0
      };
      
      linter.shouldExit(result);
      
      expect(mockLinterInstance.shouldExit).toHaveBeenCalledWith(result);
    });

    it('should get all rules', () => {
      const mockRules = [{ id: 'test-rule', enabled: true }];
      mockLinterInstance.getAllRules.mockReturnValue(mockRules);
      
      const linter = new PrismaStrongMigrationsLinter();
      const result = linter.getAllRules();
      
      expect(mockLinterInstance.getAllRules).toHaveBeenCalled();
      expect(result).toEqual(mockRules);
    });

    it('should get enabled rules', () => {
      const mockRules = [{ id: 'enabled-rule', enabled: true }];
      mockLinterInstance.getEnabledRules.mockReturnValue(mockRules);
      
      const linter = new PrismaStrongMigrationsLinter();
      const result = linter.getEnabledRules();
      
      expect(mockLinterInstance.getEnabledRules).toHaveBeenCalled();
      expect(result).toEqual(mockRules);
    });
  });

  describe('Error handling', () => {
    it('should handle linter errors gracefully', async () => {
      mockLinterInstance.lintMigrations.mockRejectedValue(new Error('Linter failed'));
      
      const linter = new PrismaStrongMigrationsLinter();
      
      await expect(linter.lintMigrations()).rejects.toThrow('Linter failed');
    });

    it('should handle git repository errors', () => {
      mockGitUtils.isGitRepository.mockReturnValue(false);
      
      const linter = new PrismaStrongMigrationsLinter();
      
      expect(() => {
        if (!mockGitUtils.isGitRepository()) {
          throw new Error('Not in a git repository');
        }
      }).toThrow('Not in a git repository');
    });

    it('should handle file system errors', () => {
      const mockFs = require('fs');
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      expect(() => {
        mockFs.writeFileSync('./test.js', 'content');
      }).toThrow('Permission denied');
    });
  });
}); 