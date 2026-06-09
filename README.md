# Prisma Strong Migrations

Lint the SQL in your Prisma migrations for patterns that are dangerous to apply
to a live production database — **before** they merge.

Prisma generates a `migration.sql` file for every migration. Most are harmless,
but a few patterns can take your database down, lose data, or break the app
mid-deploy. This tool reads those SQL files, understands them via a real SQL
parser (not string matching), and flags the dangerous ones with an explanation
and a safer alternative. It runs as a **GitHub Action** on your pull requests, or
as a **CLI** anywhere.

It's the [`strong_migrations`](https://github.com/ankane/strong_migrations) /
[Squawk](https://squawkhq.com) idea, tuned to the SQL Prisma emits and to how
Prisma applies migrations.

> **Scope:** PostgreSQL today. The architecture is dialect-aware so more engines
> can be added; until then non-Postgres projects aren't supported.

## What it catches

Every rule maps to a real way a migration hurts you in production:

| Failure mode | Example | Why it's dangerous |
| --- | --- | --- |
| **Destructive** | `DROP TABLE`, `DROP COLUMN` | Data is gone, and old code still reading it errors. |
| **Backwards-incompatible** | renames, column type changes | The previously-deployed app breaks during the rolling deploy. |
| **Locking** | `CREATE INDEX`, `SET NOT NULL`, validating constraints | Heavy locks or full-table scans stall reads/writes. |
| **Correctness** | `ADD COLUMN ... NOT NULL` with no default | The migration fails outright on a non-empty table. |

See the [full rule list](#rules) below.

## Quick start (GitHub Action)

Add a workflow that runs on pull requests. Findings show up as inline
annotations on the diff.

```yaml
# .github/workflows/migration-safety.yml
name: Migration Safety
on: pull_request

permissions:
  contents: read

jobs:
  lint-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # needed for changed-only detection
      - uses: mileszim/prisma-strong-migrations@v1
        with:
          changed-only: true # only lint migrations added in this PR
```

### Action inputs

| Input | Default | Description |
| --- | --- | --- |
| `migrations-dir` | `./prisma/migrations` | Where your migrations live. |
| `changed-only` | `false` | Only lint migrations changed in this event. On a PR it diffs the base branch; on a push it diffs the pre-push commit. Use `fetch-depth: 0` for the most precise comparison. |
| `base` | auto | Git ref to diff against for `changed-only`. Defaults to the PR base branch (PRs) or the pre-push commit (pushes). |
| `fail-on` | `error` | Severity that fails the check: `error` or `warning`. |
| `reporter` | `github` | `github` (inline annotations), `stylish`, or `json`. |
| `config` | _auto_ | Path to a config file. |
| `working-directory` | `.` | Directory containing the Prisma project. |
| `node-version` | `20` | Node.js version used to run the linter. |

## Quick start (CLI)

```bash
npm install --save-dev prisma-strong-migrations

# Lint every migration
npx prisma-strong-migrations lint

# Lint only what changed versus a base branch (great locally and in CI)
npx prisma-strong-migrations lint --changed --base origin/main

# Lint specific files
npx prisma-strong-migrations lint prisma/migrations/20240101_init/migration.sql

# Other reporters
npx prisma-strong-migrations lint --reporter json

# See every rule and its default
npx prisma-strong-migrations list-rules

# Write a starter config
npx prisma-strong-migrations init
```

The CLI exits non-zero when it finds an issue at or above `--fail-on` (default
`error`), so it fails CI on its own.

Example output:

```
prisma/migrations/20240201_risky/migration.sql
  2:20  error    Dropping column "bio" from "User" is destructive.  no-drop-column
                 why: The column data is lost, and any deployed code that still selects it will error until redeployed.
                 fix: Remove the field from your Prisma schema and deploy that first, then drop the column in a follow-up migration.

✖ 1 problem (1 error)
```

## Configuration

Configuration is optional — the defaults are sensible. To customize, run
`prisma-strong-migrations init` or create a `prisma-strong-migrations.config.js`
(also supports `.cjs`, `.json`, an `.prisma-strong-migrationsrc`, or a
`"prisma-strong-migrations"` key in `package.json`):

```js
/** @type {import('prisma-strong-migrations').UserConfig} */
module.exports = {
  migrationsDir: './prisma/migrations',
  dialect: 'postgresql',
  failOn: 'error', // 'error' | 'warning'
  rules: {
    // Set a severity...
    'no-data-manipulation': 'error',
    // ...turn a rule off...
    'require-concurrent-index': 'off',
    // ...or enable an opt-in rule.
    'require-pii-comment': 'warning',
  },
};
```

Each rule can be set to `'error'`, `'warning'`, `'off'`, `true` (its default
severity), `false` (off), or `{ severity, enabled }`.

## Rules

Run `prisma-strong-migrations list-rules` for the live list. Rules marked
**opt-in** are off by default; enable them in config.

### Destructive

- **`no-drop-table`** (error) — Dropping a table deletes its data and breaks code still reading it.
- **`no-drop-column`** (error) — Dropping a column deletes its data; Prisma keeps selecting every scalar field, so old code errors.

### Backwards-incompatible

- **`no-rename-column`** (error) — A rename is a drop + add to the running app; old code queries a column that's gone. Use expand-and-contract.
- **`no-rename-table`** (error) — The deployed app keeps querying the old name. Use `@@map` or expand-and-contract.
- **`no-change-column-type`** (error) — Usually rewrites the table under an exclusive lock and may break the running app. A `USING` clause doesn't make it safe.

### Correctness

- **`no-add-not-null-column-without-default`** (error) — `ADD COLUMN ... NOT NULL` with no default aborts on a table that already has rows.

### Locking

- **`no-set-not-null`** (warning) — `SET NOT NULL` scans the whole table under an exclusive lock and fails if any value is null. Use a validated `CHECK (... IS NOT NULL)` first.
- **`require-concurrent-index`** (warning) — `CREATE INDEX` without `CONCURRENTLY` blocks writes while it builds.
- **`constraint-missing-not-valid`** (warning) — Adding a `CHECK` or `FOREIGN KEY` validates every existing row under a lock. Add it `NOT VALID`, then `VALIDATE` separately.
- **`no-data-manipulation`** (warning) — `INSERT`/`UPDATE`/`DELETE` inside a schema migration runs under the migration lock and can stall the deploy.

### Opinionated (opt-in)

- **`require-explicit-not-null`** (off) — Require new columns to declare `NULL` or `NOT NULL` explicitly.
- **`require-pii-comment`** (off) — Flag columns whose names look like personal data, for a compliance review.
- **`no-unindexed-foreign-key`** (off) — Flag foreign keys whose referencing column has no covering index in the same migration.

### A note on `CREATE INDEX CONCURRENTLY` and Prisma

Prisma wraps each migration in a transaction, and `CREATE INDEX CONCURRENTLY`
cannot run inside one. To follow `require-concurrent-index`, put the concurrent
index in its own migration and apply it outside the transactional batch (for
example with `prisma db execute`). The rule's suggestion text spells this out.

## Programmatic API

```ts
import { lintProject, shouldFail, stylish } from 'prisma-strong-migrations';

const { result, config } = lintProject({
  overrides: { migrationsDir: './prisma/migrations' },
  changedSince: 'origin/main', // optional
});

console.log(stylish(result));
process.exit(shouldFail(result, config.failOn) ? 1 : 0);
```

Lower-level building blocks are exported too: `parseSql`, `loadMigrations`,
`lint`, `loadConfig`, `ALL_RULES`, and the reporters.

## How it works

1. Find every `migration.sql` under `migrationsDir` (or just the changed ones).
2. Parse each file with [`sql-parser-cst`](https://github.com/nene/sql-parser-cst)
   into a concrete syntax tree. Statements that don't parse are reported, never
   silently skipped.
3. Run each enabled rule against the tree. Rules read the structure of the SQL
   (statement kind, table, columns, clauses) — not substrings — so they don't
   trip over identifiers that happen to contain keywords.
4. Report findings with the configured severity, sorted by location.

## Limitations

- **PostgreSQL only** for now.
- Static analysis can't know table size or row contents, so locking/correctness
  rules flag the _pattern_; whether it actually causes pain depends on your data.
  Tune severities per rule.

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

Each rule is a small module in `src/rules/` that reads facts from the parsed
tree via helpers in `src/rules/ast.ts` and calls `ctx.report(...)`. Add a rule by
creating the module, registering it in `src/rules/index.ts`, and adding a test in
`test/rules.test.ts`.

## License

MIT — see [LICENSE](LICENSE).
