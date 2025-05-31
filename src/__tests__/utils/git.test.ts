import { GitUtils } from '../../utils/git';
import { execSync } from 'child_process';

// Mock execSync for testing
jest.mock('child_process');
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('GitUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true when in a git repository', () => {
      mockExecSync.mockReturnValue('');
      
      const result = GitUtils.isGitRepository();
      
      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'ignore' });
    });

    it('should return false when not in a git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      const result = GitUtils.isGitRepository();
      
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', () => {
      mockExecSync.mockReturnValue('feature/test-branch\n');
      
      const result = GitUtils.getCurrentBranch();
      
      expect(result).toBe('feature/test-branch');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' });
    });

    it('should throw error when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      expect(() => GitUtils.getCurrentBranch()).toThrow('Failed to get current branch');
    });
  });

  describe('branchExists', () => {
    it('should return true when branch exists', () => {
      mockExecSync.mockReturnValue('');
      
      const result = GitUtils.branchExists('origin/main');
      
      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --verify origin/main', { stdio: 'ignore' });
    });

    it('should return false when branch does not exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Branch not found');
      });
      
      const result = GitUtils.branchExists('nonexistent-branch');
      
      expect(result).toBe(false);
    });
  });

  describe('getChangedMigrationFiles', () => {
    it('should return changed migration files', () => {
      // Mock fetch origin (silent)
      mockExecSync.mockReturnValueOnce('');
      
      // Mock git diff output
      const gitOutput = 'prisma/migrations/001_init/migration.sql\nprisma/migrations/002_add_users/migration.sql\nsrc/other-file.ts';
      mockExecSync.mockReturnValueOnce(gitOutput);
      
      const result = GitUtils.getChangedMigrationFiles('prisma/migrations');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('001_init/migration.sql');
      expect(result[1]).toContain('002_add_users/migration.sql');
    });

    it('should return empty array when no migration files changed', () => {
      // Mock fetch origin (silent)
      mockExecSync.mockReturnValueOnce('');
      
      // Mock git diff output with no migration files
      const gitOutput = 'src/other-file.ts\nREADME.md';
      mockExecSync.mockReturnValueOnce(gitOutput);
      
      const result = GitUtils.getChangedMigrationFiles('prisma/migrations');
      
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no files changed', () => {
      // Mock fetch origin (silent)
      mockExecSync.mockReturnValueOnce('');
      
      // Mock git diff output with empty result
      mockExecSync.mockReturnValueOnce('');
      
      const result = GitUtils.getChangedMigrationFiles('prisma/migrations');
      
      expect(result).toHaveLength(0);
    });

    it('should use correct git command with options', () => {
      // Mock fetch origin (silent)
      mockExecSync.mockReturnValueOnce('');
      
      // Mock git diff output
      mockExecSync.mockReturnValueOnce('');
      
      GitUtils.getChangedMigrationFiles('prisma/migrations', {
        base: 'origin/develop',
        addedOnly: true
      });
      
      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff --diff-filter=A --name-only origin/develop...HEAD',
        { encoding: 'utf8' }
      );
    });

    it('should throw error when git command fails', () => {
      // Mock fetch origin (silent)
      mockExecSync.mockReturnValueOnce('');
      
      // Mock git diff failure
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed');
      });
      
      expect(() => GitUtils.getChangedMigrationFiles('prisma/migrations')).toThrow(
        'Failed to get changed migration files'
      );
    });
  });

  describe('getChangedMigrationFilesSinceCommit', () => {
    it('should return changed migration files since commit', () => {
      const gitOutput = 'prisma/migrations/001_init/migration.sql\nprisma/migrations/002_add_users/migration.sql';
      mockExecSync.mockReturnValue(gitOutput);
      
      const result = GitUtils.getChangedMigrationFilesSinceCommit('prisma/migrations', 'abc123');
      
      expect(result).toHaveLength(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff --diff-filter=AM --name-only abc123...HEAD',
        { encoding: 'utf8' }
      );
    });
  });

  describe('getMergeBase', () => {
    it('should return the merge base commit', () => {
      mockExecSync.mockReturnValue('abc123def456\n');
      
      const result = GitUtils.getMergeBase('origin/main');
      
      expect(result).toBe('abc123def456');
      expect(mockExecSync).toHaveBeenCalledWith('git merge-base HEAD origin/main', { encoding: 'utf8' });
    });

    it('should throw error when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No merge base found');
      });
      
      expect(() => GitUtils.getMergeBase('origin/main')).toThrow('Failed to get merge base');
    });
  });
}); 