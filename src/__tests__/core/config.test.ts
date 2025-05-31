import { ConfigManager } from '../../core/config';
import { OutputFormat, Severity } from '../../types';
import { cosmiconfigSync } from 'cosmiconfig';

// Mock cosmiconfig
jest.mock('cosmiconfig');
const mockCosmiconfigSync = cosmiconfigSync as jest.MockedFunction<typeof cosmiconfigSync>;

// Mock getBuiltInRules
jest.mock('../../rules', () => ({
  getBuiltInRules: jest.fn(() => [
    {
      id: 'no-drop-table',
      name: 'No Drop Table',
      description: 'Prevent dropping tables',
      severity: Severity.ERROR,
      enabled: true,
      category: 'schema-safety',
      check: jest.fn()
    },
    {
      id: 'require-pii-comments',
      name: 'Require PII Comments',
      description: 'Require PII comments',
      severity: Severity.INFO,
      enabled: false,
      category: 'data-integrity',
      check: jest.fn()
    }
  ])
}));

describe('ConfigManager', () => {
  let mockExplorer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockExplorer = {
      search: jest.fn(),
      load: jest.fn()
    };
    
    mockCosmiconfigSync.mockReturnValue(mockExplorer);
  });

  describe('constructor', () => {
    it('should load default config when no config file found', () => {
      mockExplorer.search.mockReturnValue(null);
      
      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      
      expect(config.migrationsPath).toBe('./prisma/migrations');
      expect(config.failOnError).toBe(true);
      expect(config.failOnWarning).toBe(false);
      expect(config.output).toBe(OutputFormat.TEXT);
      expect(config.dialect).toBe('postgresql');
    });

    it('should merge user config with defaults', () => {
      const userConfig = {
        migrationsPath: './custom/migrations',
        failOnWarning: true,
        rules: {
          'no-drop-table': { enabled: false, severity: Severity.WARNING }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      
      expect(config.migrationsPath).toBe('./custom/migrations');
      expect(config.failOnWarning).toBe(true);
      expect(config.failOnError).toBe(true); // Should keep default
      expect(config.rules['no-drop-table'].enabled).toBe(false);
      expect(config.rules['no-drop-table'].severity).toBe(Severity.WARNING);
    });

    it('should load config from specific path when provided', () => {
      const userConfig = {
        migrationsPath: './specific/migrations'
      };
      
      mockExplorer.load.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager('./custom-config.js');
      
      expect(mockExplorer.load).toHaveBeenCalledWith('./custom-config.js');
      expect(configManager.getMigrationsPath()).toBe('./specific/migrations');
    });

    it('should throw error when config loading fails', () => {
      mockExplorer.search.mockImplementation(() => {
        throw new Error('Config file syntax error');
      });
      
      expect(() => new ConfigManager()).toThrow('Failed to load configuration: Error: Config file syntax error');
    });
  });

  describe('getMigrationsPath', () => {
    it('should return configured migrations path', () => {
      mockExplorer.search.mockReturnValue({
        config: { migrationsPath: './custom/path' }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getMigrationsPath()).toBe('./custom/path');
    });
  });

  describe('getRuleConfig', () => {
    it('should return rule configuration when it exists', () => {
      const userConfig = {
        rules: {
          'no-drop-table': { enabled: false, severity: Severity.WARNING }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      const ruleConfig = configManager.getRuleConfig('no-drop-table');
      
      expect(ruleConfig).toEqual({ enabled: false, severity: Severity.WARNING });
    });

    it('should return undefined when rule config does not exist', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      const ruleConfig = configManager.getRuleConfig('nonexistent-rule');
      
      expect(ruleConfig).toBeUndefined();
    });
  });

  describe('isRuleEnabled', () => {
    it('should return true when rule is enabled', () => {
      const userConfig = {
        rules: {
          'no-drop-table': { enabled: true }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      
      expect(configManager.isRuleEnabled('no-drop-table')).toBe(true);
    });

    it('should return false when rule is disabled', () => {
      const userConfig = {
        rules: {
          'no-drop-table': { enabled: false }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      
      expect(configManager.isRuleEnabled('no-drop-table')).toBe(false);
    });

    it('should return false when rule config does not exist', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.isRuleEnabled('nonexistent-rule')).toBe(false);
    });
  });

  describe('getRuleSeverity', () => {
    it('should return configured severity', () => {
      const userConfig = {
        rules: {
          'no-drop-table': { enabled: true, severity: Severity.WARNING }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getRuleSeverity('no-drop-table')).toBe(Severity.WARNING);
    });

    it('should return undefined when rule has no severity configured', () => {
      const userConfig = {
        rules: {
          'no-drop-table': { enabled: true }
        }
      };
      
      mockExplorer.search.mockReturnValue({ config: userConfig });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getRuleSeverity('no-drop-table')).toBeUndefined();
    });
  });

  describe('shouldFailOnWarning', () => {
    it('should return true when failOnWarning is enabled', () => {
      mockExplorer.search.mockReturnValue({
        config: { failOnWarning: true }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.shouldFailOnWarning()).toBe(true);
    });

    it('should return false by default', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.shouldFailOnWarning()).toBe(false);
    });
  });

  describe('shouldFailOnError', () => {
    it('should return true by default', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.shouldFailOnError()).toBe(true);
    });

    it('should return false when explicitly disabled', () => {
      mockExplorer.search.mockReturnValue({
        config: { failOnError: false }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.shouldFailOnError()).toBe(false);
    });
  });

  describe('getOutputFormat', () => {
    it('should return configured output format', () => {
      mockExplorer.search.mockReturnValue({
        config: { output: OutputFormat.JSON }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getOutputFormat()).toBe(OutputFormat.JSON);
    });

    it('should return TEXT format by default', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getOutputFormat()).toBe(OutputFormat.TEXT);
    });
  });

  describe('getIncludePatterns', () => {
    it('should return configured include patterns', () => {
      const patterns = ['**/*.sql', '**/*.prisma'];
      mockExplorer.search.mockReturnValue({
        config: { include: patterns }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getIncludePatterns()).toEqual(patterns);
    });

    it('should return undefined when not configured', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getIncludePatterns()).toBeUndefined();
    });
  });

  describe('getExcludePatterns', () => {
    it('should return configured exclude patterns', () => {
      const patterns = ['**/test/**', '**/node_modules/**'];
      mockExplorer.search.mockReturnValue({
        config: { exclude: patterns }
      });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getExcludePatterns()).toEqual(patterns);
    });

    it('should return undefined when not configured', () => {
      mockExplorer.search.mockReturnValue({ config: {} });
      
      const configManager = new ConfigManager();
      
      expect(configManager.getExcludePatterns()).toBeUndefined();
    });
  });

  describe('createDefaultConfig', () => {
    it('should return a valid default configuration string', () => {
      const defaultConfig = ConfigManager.createDefaultConfig();
      
      expect(defaultConfig).toContain('module.exports = {');
      expect(defaultConfig).toContain('migrationsPath: \'./prisma/migrations\'');
      expect(defaultConfig).toContain('failOnError: true');
      expect(defaultConfig).toContain('failOnWarning: false');
      expect(defaultConfig).toContain('no-drop-table');
      expect(defaultConfig).toContain('require-pii-comments');
    });
  });
}); 