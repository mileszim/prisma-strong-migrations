import { execSync } from 'child_process';
import * as path from 'path';

export interface GitOptions {
  /** Base branch to compare against (default: origin/main) */
  base?: string;
  /** Include only added files */
  addedOnly?: boolean;
  /** Include only modified files */
  modifiedOnly?: boolean;
  /** Include both added and modified files (default: true) */
  includeAll?: boolean;
}

export class GitUtils {
  /**
   * Get the list of changed migration files compared to the base branch
   */
  static getChangedMigrationFiles(migrationsPath: string, options: GitOptions = {}): string[] {
    const {
      base = 'origin/main',
      addedOnly = false,
      modifiedOnly = false,
      includeAll = true
    } = options;

    try {
      // Ensure we have the latest refs
      this.fetchOrigin();

      let statusFilter = '';
      if (addedOnly) {
        statusFilter = '--diff-filter=A';
      } else if (modifiedOnly) {
        statusFilter = '--diff-filter=M';
      } else if (includeAll) {
        statusFilter = '--diff-filter=AM';
      }

      // Get changed files compared to base branch
      const cmd = `git diff ${statusFilter} --name-only ${base}...HEAD`;
      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      
      if (!output) {
        return [];
      }

      const changedFiles = output.split('\n');
      
      // Filter for migration files in the specified migrations path
      const migrationFiles = changedFiles.filter(file => {
        // Check if file is in migrations directory and is a SQL file
        const normalizedMigrationsPath = path.normalize(migrationsPath);
        const normalizedFile = path.normalize(file);
        
        return normalizedFile.startsWith(normalizedMigrationsPath) && 
               normalizedFile.endsWith('.sql');
      });

      // Convert to absolute paths
      return migrationFiles.map(file => path.resolve(file));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get changed migration files: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get changed migration files since a specific commit
   */
  static getChangedMigrationFilesSinceCommit(migrationsPath: string, commitSha: string): string[] {
    try {
      const cmd = `git diff --diff-filter=AM --name-only ${commitSha}...HEAD`;
      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      
      if (!output) {
        return [];
      }

      const changedFiles = output.split('\n');
      
      // Filter for migration files
      const migrationFiles = changedFiles.filter(file => {
        const normalizedMigrationsPath = path.normalize(migrationsPath);
        const normalizedFile = path.normalize(file);
        
        return normalizedFile.startsWith(normalizedMigrationsPath) && 
               normalizedFile.endsWith('.sql');
      });

      return migrationFiles.map(file => path.resolve(file));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get changed migration files since commit: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if we're in a git repository
   */
  static isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  static getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get current branch: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a base branch exists
   */
  static branchExists(branchName: string): boolean {
    try {
      execSync(`git rev-parse --verify ${branchName}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch origin to ensure we have latest refs
   */
  private static fetchOrigin(): void {
    try {
      execSync('git fetch origin', { stdio: 'ignore' });
    } catch {
      // Ignore fetch errors - might be in CI or no network
    }
  }

  /**
   * Get the merge base between current branch and base branch
   */
  static getMergeBase(baseBranch: string): string {
    try {
      return execSync(`git merge-base HEAD ${baseBranch}`, { encoding: 'utf8' }).trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get merge base: ${error.message}`);
      }
      throw error;
    }
  }
} 