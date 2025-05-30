# Prisma Strong Migrations

A linter for Prisma migrations to ensure safe SQL deployments in production environments.

## Overview

Prisma Strong Migrations helps you catch dangerous SQL migration patterns before they reach production. It analyzes your Prisma migration files and reports potential issues like:

- 🚫 **Schema Safety**: Dropping tables/columns without safeguards
- ⚡ **Performance**: Missing indexes on foreign keys
- 🔒 **Data Integrity**: Missing NOT NULL constraints
- 🚀 **Deployment Safety**: Breaking changes that could cause downtime

## Installation

```bash
npm install --save-dev prisma-strong-migrations
```

## Quick Start

1. **Initialize configuration:**
```bash
npx prisma-strong-migrations init
```

2. **Lint all migrations:**
```bash
npx prisma-strong-migrations lint
```

3. **Lint recent migrations only:**
```bash
npx prisma-strong-migrations lint --recent 1
```

4. **Lint only changed migrations (perfect for PRs):**
```bash
npx prisma-strong-migrations lint --changed
```

## CLI Usage

### Lint Commands

```bash
# Lint all migration files
npx prisma-strong-migrations lint

# Lint only changed migration files (compared to main branch)
npx prisma-strong-migrations lint --changed

# Lint changed files compared to a specific branch
npx prisma-strong-migrations lint --changed --base origin/develop

# Lint only added migration files
npx prisma-strong-migrations lint --changed --added-only

# Lint only modified migration files  
npx prisma-strong-migrations lint --changed --modified-only

# Lint changed files since a specific commit
npx prisma-strong-migrations lint --since-commit abc123

# Lint recent migrations only
npx prisma-strong-migrations lint --recent 1

# Lint migrations since a specific migration ID
npx prisma-strong-migrations lint --since 20231201120000_add_users

# Lint a specific file
npx prisma-strong-migrations lint --file ./prisma/migrations/20231201120000_add_users/migration.sql

# Custom output format
npx prisma-strong-migrations lint --format json
npx prisma-strong-migrations lint --format junit
```

### Other Commands

```bash
# Create default configuration file
npx prisma-strong-migrations init

# List all available rules
npx prisma-strong-migrations rules

# Check configuration and setup
npx prisma-strong-migrations check
```

## Configuration

Create a `.prisma-strong-migrations.js` file in your project root:

```javascript
module.exports = {
  migrationsPath: './prisma/migrations',
  failOnError: true,
  failOnWarning: false,
  output: 'text', // 'text', 'json', 'junit'
  rules: {
    'no-drop-table': { enabled: true, severity: 'error' },
    'no-drop-column': { enabled: true, severity: 'error' },
    'no-alter-column-type': { enabled: true, severity: 'error' },
    'no-column-rename': { enabled: true, severity: 'error' },
    'no-table-rename': { enabled: true, severity: 'error' },
    'no-add-column-without-default': { enabled: true, severity: 'warning' },
    'require-foreign-key-cascade': { enabled: true, severity: 'warning' },
    'no-unique-constraint-without-index': { enabled: true, severity: 'warning' },
    'no-drop-foreign-key-constraint': { enabled: true, severity: 'warning' },
    'require-index-for-foreign-key': { enabled: true, severity: 'warning' },
    'no-full-table-scan': { enabled: true, severity: 'warning' },
    'require-not-null-constraint': { enabled: false, severity: 'info' },
    'require-pii-comments': { enabled: false, severity: 'info' },
    'no-data-manipulation': { enabled: true, severity: 'warning' },
    'no-add-non-nullable-column': { enabled: true, severity: 'error' },
    'no-nullable-to-non-nullable': { enabled: true, severity: 'error' },
    'require-transaction-block': { enabled: false, severity: 'info' },
    'require-concurrent-index': { enabled: true, severity: 'error' }
  }
};
```

## Built-in Rules

### Schema Safety

- **`no-drop-table`**: Prevents dropping tables
  - Severity: `error`
  - Recommendation: Rename table first, then drop in later migration

- **`no-drop-column`**: Prevents dropping columns
  - Severity: `error`
  - Recommendation: Make column nullable first, then drop in later migration

- **`no-alter-column-type`**: Prevents changing column types without explicit casting
  - Severity: `error`
  - Recommendation: Use USING clause to specify data conversion

- **`no-column-rename`**: Prevents renaming columns which is backward-incompatible
  - Severity: `error`
  - Recommendation: Use expand-and-contract pattern: add new column, copy data, update code, then drop old column

- **`no-table-rename`**: Prevents renaming tables which is backward-incompatible
  - Severity: `error`
  - Recommendation: Create a view with the old name or use expand-and-contract pattern

- **`no-add-column-without-default`**: Requires default values for new columns
  - Severity: `warning`
  - Recommendation: Add DEFAULT value or make column nullable

- **`require-foreign-key-cascade`**: Requires foreign keys to specify ON DELETE behavior
  - Severity: `warning`
  - Recommendation: Add ON DELETE CASCADE, SET NULL, or RESTRICT

- **`no-unique-constraint-without-index`**: Warns about unique constraints that may fail
  - Severity: `warning`
  - Recommendation: Check for duplicates before adding unique constraints

- **`no-drop-foreign-key-constraint`**: Warns about dropping foreign key constraints
  - Severity: `warning`
  - Recommendation: Ensure data consistency is maintained through application logic if constraint is removed

### Performance

- **`require-index-for-foreign-key`**: Requires indexes on foreign key columns
  - Severity: `warning`
  - Recommendation: Create index on foreign key columns

- **`no-full-table-scan`**: Warns about operations that may cause full table scans
  - Severity: `warning`
  - Recommendation: Add indexes or use WHERE clauses to limit scope

- **`require-concurrent-index`**: Requires CONCURRENTLY for index operations (PostgreSQL)
  - Severity: `warning`
  - Recommendation: Use CONCURRENTLY to avoid table locks during index operations

### Data Integrity

- **`require-not-null-constraint`**: Encourages explicit NOT NULL constraints
  - Severity: `info`
  - Recommendation: Explicitly specify NOT NULL for required columns

- **`require-pii-comments`**: Requires comments on PII columns for compliance
  - Severity: `info`
  - Recommendation: Add COMMENT containing "PII" to personal data columns

### Deployment Safety

- **`no-data-manipulation`**: Prevents data manipulation in schema migrations
  - Severity: `warning`
  - Recommendation: Move INSERT/UPDATE/DELETE to separate data migrations

- **`no-add-non-nullable-column`**: Prevents adding non-nullable columns without defaults
  - Severity: `error`
  - Recommendation: Add a DEFAULT value when adding non-nullable columns, or make the column nullable initially

- **`no-nullable-to-non-nullable`**: Prevents changing nullable columns to non-nullable
  - Severity: `error`  
  - Recommendation: First backfill NULL values before adding NOT NULL constraint

### Best Practices

- **`require-transaction-block`**: Encourages transaction blocks for multiple operations
  - Severity: `info`
  - Recommendation: Wrap multiple operations in BEGIN/COMMIT blocks

## CI/CD Integration

### GitHub Actions (Recommended for PRs)

For the most efficient CI workflow, lint only the migration files that have changed in your PR:

```yaml
name: Migration Safety Check
on: [pull_request]

jobs:
  migration-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          # Fetch enough history to compare with base branch
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      # Lint only changed migration files
      - run: npx prisma-strong-migrations lint --changed --format junit
```

### GitHub Actions (Lint all migrations)

If you prefer to lint all migrations on every run:

```yaml
name: Migration Safety Check
on: [pull_request]

jobs:
  migration-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx prisma-strong-migrations lint --format junit
```

### Advanced GitHub Actions with Different Base Branch

```yaml
name: Migration Safety Check
on: [pull_request]

jobs:
  migration-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      # Use a different base branch
      - run: npx prisma-strong-migrations lint --changed --base origin/develop --format junit
```

### GitLab CI

```yaml
migration-lint:
  stage: test
  before_script:
    # Fetch origin to ensure we have the base branch
    - git fetch origin
  script:
    - npm install
    # Lint only changed files compared to main branch
    - npx prisma-strong-migrations lint --changed --base origin/main --format junit
  artifacts:
    reports:
      junit: junit.xml
```

## Programmatic Usage

```typescript
import { PrismaStrongMigrationsLinter, GitUtils } from 'prisma-strong-migrations';

const linter = new PrismaStrongMigrationsLinter();

// Lint all migrations
const result = await linter.lintMigrations();

// Lint recent migrations
const recentResult = await linter.lintRecentMigrations(1);

// Lint only changed migration files (perfect for CI/CD)
const changedResult = await linter.lintChangedMigrations({
  base: 'origin/main',
  addedOnly: false,
  modifiedOnly: false
});

// Lint changed files since a specific commit
const sinceCommitResult = await linter.lintChangedMigrationsSinceCommit('abc123');

// Check if should exit with error code
if (linter.shouldExit(result)) {
  process.exit(1);
}

// Direct git utilities usage
if (GitUtils.isGitRepository()) {
  const currentBranch = GitUtils.getCurrentBranch();
  const changedFiles = GitUtils.getChangedMigrationFiles('./prisma/migrations', {
    base: 'origin/main'
  });
  console.log(`Changed migration files in ${currentBranch}:`, changedFiles);
}
```

## Creating Custom Rules

```typescript
import { createCustomRule, Severity, RuleCategory } from 'prisma-strong-migrations';

const customRule = createCustomRule({
  id: 'no-varchar-without-length',
  name: 'No VARCHAR without length',
  description: 'VARCHAR columns should specify a length',
  severity: Severity.WARNING,
  category: RuleCategory.BEST_PRACTICES,
  check: (statement, migration) => {
    const violations = [];
    if (statement.content.includes('VARCHAR') && !statement.content.includes('VARCHAR(')) {
      violations.push({
        ruleId: 'no-varchar-without-length',
        ruleName: 'No VARCHAR without length',
        severity: Severity.WARNING,
        message: 'VARCHAR columns should specify a length',
        line: statement.startLine,
        suggestion: 'Specify a length for VARCHAR column, e.g., VARCHAR(255)',
        category: RuleCategory.BEST_PRACTICES
      });
    }
    return violations;
  }
});

// Add to linter
linter.addRule(customRule);
```

## Example Output

```
prisma/migrations/20231201120000_add_users/migration.sql
  ✖ 5:1   Dropping columns can cause irreversible data loss  no-drop-column
      💡 Consider making the column nullable first, then dropping it in a later migration
  ⚠ 8:1   Foreign key column "user_id" should have an index  require-index-for-foreign-key
      💡 Create an index on column(s): user_id

2 problems (1 error, 1 warning) (1 file linted)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new rules
4. Submit a pull request

## License

MIT License - see LICENSE file for details 