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
    'require-index-for-foreign-key': { enabled: true, severity: 'warning' },
    'no-full-table-scan': { enabled: true, severity: 'warning' },
    'require-not-null-constraint': { enabled: false, severity: 'info' },
    'require-pii-comments': { enabled: false, severity: 'info' },
    'no-data-manipulation': { enabled: true, severity: 'warning' },
    'require-transaction-block': { enabled: false, severity: 'info' },
    'require-concurrent-index': { enabled: true, severity: 'warning' }
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

### Best Practices

- **`require-transaction-block`**: Encourages transaction blocks for multiple operations
  - Severity: `info`
  - Recommendation: Wrap multiple operations in BEGIN/COMMIT blocks

## CLI Commands

### `lint`
Lint migration files:

```bash
# Lint all migrations
npx prisma-strong-migrations lint

# Lint recent migrations
npx prisma-strong-migrations lint --recent 3

# Lint since specific migration
npx prisma-strong-migrations lint --since 20231201120000

# Lint specific file
npx prisma-strong-migrations lint --file ./prisma/migrations/20231201120000_add_users/migration.sql

# Output as JSON
npx prisma-strong-migrations lint --format json

# Output as JUnit XML (for CI)
npx prisma-strong-migrations lint --format junit
```

### `rules`
List all available rules:

```bash
npx prisma-strong-migrations rules
```

### `check`
Check configuration and setup:

```bash
npx prisma-strong-migrations check
```

### `init`
Create default configuration file:

```bash
npx prisma-strong-migrations init
```

## CI/CD Integration

### GitHub Actions

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

### GitLab CI

```yaml
migration-lint:
  stage: test
  script:
    - npm install
    - npx prisma-strong-migrations lint --format junit
  artifacts:
    reports:
      junit: junit.xml
```

## Programmatic Usage

```typescript
import { PrismaStrongMigrationsLinter } from 'prisma-strong-migrations';

const linter = new PrismaStrongMigrationsLinter();

// Lint all migrations
const result = await linter.lintMigrations();

// Lint recent migrations
const recentResult = await linter.lintRecentMigrations(1);

// Check if should exit with error code
if (linter.shouldExit(result)) {
  process.exit(1);
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