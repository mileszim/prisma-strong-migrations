#!/usr/bin/env node

import { Command } from 'commander';
import { PrismaStrongMigrationsLinter } from './core/linter';
import { ReporterFactory } from './reporters';
import { ConfigManager } from './core/config';
import { OutputFormat } from './types';
import { GitUtils } from './utils/git';

const program = new Command();

program
  .name('prisma-strong-migrations')
  .description('A linter for Prisma migrations to ensure safe SQL deployments')
  .version('1.0.0');

program
  .command('lint')
  .description('Lint all migration files')
  .option('-c, --config <path>', 'path to configuration file')
  .option('-f, --format <format>', 'output format (text, json, junit)', 'text')
  .option('--recent <count>', 'lint only the most recent N migrations', '0')
  .option('--since <id>', 'lint migrations since the specified migration ID')
  .option('--file <path>', 'lint a specific migration file')
  .option('--changed', 'lint only changed migration files (compared to base branch)')
  .option('--base <branch>', 'base branch to compare against for changed files', 'origin/main')
  .option('--since-commit <sha>', 'lint changed migration files since specific commit')
  .option('--added-only', 'include only added files when using --changed')
  .option('--modified-only', 'include only modified files when using --changed')
  .action(async (options) => {
    try {
      const linter = new PrismaStrongMigrationsLinter(options.config);
      
      let result;
      if (options.file) {
        result = await linter.lintFile(options.file);
      } else if (options.sinceCommit) {
        result = await linter.lintChangedMigrationsSinceCommit(options.sinceCommit);
      } else if (options.changed) {
        // Validate git repository and base branch
        if (!GitUtils.isGitRepository()) {
          console.error('Error: Not in a git repository. Cannot use --changed option.');
          process.exit(1);
        }

        const baseBranch = options.base;
        if (!GitUtils.branchExists(baseBranch)) {
          console.error(`Error: Base branch '${baseBranch}' does not exist.`);
          console.error(`Try: git fetch origin or use a different --base branch`);
          process.exit(1);
        }

        const gitOptions = {
          base: baseBranch,
          addedOnly: options.addedOnly,
          modifiedOnly: options.modifiedOnly,
          includeAll: !options.addedOnly && !options.modifiedOnly
        };

        result = await linter.lintChangedMigrations(gitOptions);
        
        // Provide helpful feedback about what was checked
        if (result.totalFiles === 0) {
          const currentBranch = GitUtils.getCurrentBranch();
          console.log(`No changed migration files found between ${baseBranch} and ${currentBranch}`);
        } else {
          const currentBranch = GitUtils.getCurrentBranch();
          console.log(`Linting ${result.totalFiles} changed migration file(s) between ${baseBranch} and ${currentBranch}`);
        }
      } else if (options.since) {
        result = await linter.lintMigrationsSince(options.since);
      } else if (options.recent && parseInt(options.recent) > 0) {
        result = await linter.lintRecentMigrations(parseInt(options.recent));
      } else {
        result = await linter.lintMigrations();
      }
      
      const format = options.format as OutputFormat;
      const reporter = ReporterFactory.create(format);
      const output = reporter.format(result);
      
      console.log(output);
      
      if (linter.shouldExit(result)) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a default configuration file')
  .option('-f, --force', 'overwrite existing configuration file')
  .action(async (options) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const configFile = '.prisma-strong-migrations.js';
      const configPath = path.join(process.cwd(), configFile);
      
      if (fs.existsSync(configPath) && !options.force) {
        console.error(`Configuration file ${configFile} already exists. Use --force to overwrite.`);
        process.exit(1);
      }
      
      const defaultConfig = ConfigManager.createDefaultConfig();
      fs.writeFileSync(configPath, defaultConfig);
      
      console.log(`Created configuration file: ${configFile}`);
    } catch (error) {
      console.error('Error creating configuration file:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('List all available rules')
  .option('-c, --config <path>', 'path to configuration file')
  .action(async (options) => {
    try {
      const linter = new PrismaStrongMigrationsLinter(options.config);
      const rules = linter.getAllRules();
      
      console.log('Available rules:\n');
      
      for (const rule of rules) {
        const status = rule.enabled ? '✓' : '✗';
        const severity = rule.severity.toUpperCase().padEnd(7);
        
        console.log(`${status} ${rule.id.padEnd(30)} ${severity} ${rule.description}`);
        
        if (rule.recommendation) {
          console.log(`   💡 ${rule.recommendation}`);
        }
        console.log();
      }
    } catch (error) {
      console.error('Error listing rules:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check configuration and setup')
  .option('-c, --config <path>', 'path to configuration file')
  .action(async (options) => {
    try {
      const linter = new PrismaStrongMigrationsLinter(options.config);
      const config = linter.getConfig().getConfig();
      
      console.log('Configuration:');
      console.log(`  Migrations path: ${config.migrationsPath}`);
      console.log(`  Fail on error: ${config.failOnError}`);
      console.log(`  Fail on warning: ${config.failOnWarning}`);
      console.log(`  Output format: ${config.output}`);
      
      const enabledRules = linter.getEnabledRules();
      console.log(`\nEnabled rules: ${enabledRules.length}`);
      
      for (const rule of enabledRules) {
        console.log(`  - ${rule.id} (${rule.severity})`);
      }
      
      // Check if migrations directory exists
      const fs = await import('fs');
      if (fs.existsSync(config.migrationsPath)) {
        console.log(`\n✓ Migrations directory found: ${config.migrationsPath}`);
      } else {
        console.log(`\n✗ Migrations directory not found: ${config.migrationsPath}`);
      }
    } catch (error) {
      console.error('Error checking configuration:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
} 