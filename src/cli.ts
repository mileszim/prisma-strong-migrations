#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Command, CommanderError } from 'commander';
import pc from 'picocolors';
import { ConfigError, type UserConfig } from './config';
import { lintProject, shouldFail } from './lint';
import { getReporter, isReporterName, type ReporterName } from './reporters';
import { ALL_RULES } from './rules';
import type { ReportedSeverity } from './types';

/** Read the package version from package.json so it never drifts from the build. */
function packageVersion(): string {
  try {
    const pkg = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
    return JSON.parse(pkg).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = packageVersion();

interface LintFlags {
  config?: string;
  migrationsDir?: string;
  dialect?: string;
  changed?: boolean;
  base?: string;
  reporter?: string;
  failOn?: string;
}

/** Parse argv and run the CLI. Returns the process exit code. */
export async function run(argv: string[]): Promise<number> {
  let exitCode = 0;
  const program = new Command();

  program
    .name('prisma-strong-migrations')
    .description('Lint Prisma migrations for unsafe SQL before it reaches production.')
    .version(VERSION)
    .exitOverride();

  program
    .command('lint', { isDefault: true })
    .description('Lint migration files for unsafe patterns')
    .argument('[files...]', 'specific migration.sql files to lint')
    .option('-c, --config <path>', 'path to a config file')
    .option('-d, --migrations-dir <dir>', 'directory containing Prisma migrations')
    .option('--dialect <dialect>', 'SQL dialect (postgresql)')
    .option('--changed', 'lint only migrations changed versus the base ref')
    .option('--base <ref>', 'base git ref for --changed (default: origin/<PR base> or origin/main)')
    .option('-r, --reporter <name>', 'output format: stylish, json, or github')
    .option('--fail-on <severity>', 'severity that fails the run: error or warning')
    .action(async (files: string[], flags: LintFlags) => {
      exitCode = await runLint(files, flags);
    });

  program
    .command('list-rules')
    .description('List all built-in rules')
    .option('--json', 'output as JSON')
    .action((flags: { json?: boolean }) => {
      exitCode = runListRules(Boolean(flags.json));
    });

  program
    .command('init')
    .description('Write a starter config file')
    .option('-f, --force', 'overwrite an existing config file')
    .action((flags: { force?: boolean }) => {
      exitCode = runInit(Boolean(flags.force));
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      // Help and version are not failures; parse errors carry their own code.
      return error.exitCode;
    }
    printError(error);
    return 1;
  }

  return exitCode;
}

async function runLint(files: string[], flags: LintFlags): Promise<number> {
  const reporterName = resolveReporter(flags.reporter);
  if (!reporterName) {
    console.error(pc.red(`Unknown reporter "${flags.reporter}". Use stylish, json, or github.`));
    return 1;
  }

  const overrides: Partial<UserConfig> = {};
  if (flags.migrationsDir) overrides.migrationsDir = flags.migrationsDir;
  if (flags.dialect) overrides.dialect = flags.dialect as UserConfig['dialect'];
  if (flags.failOn) overrides.failOn = flags.failOn as ReportedSeverity;

  try {
    const { result, config } = lintProject({
      configPath: flags.config,
      overrides,
      files: files.length > 0 ? files : undefined,
      changedSince: flags.changed ? resolveBase(flags.base) : undefined,
    });

    console.log(getReporter(reporterName)(result));
    return shouldFail(result, config.failOn) ? 1 : 0;
  } catch (error) {
    printError(error);
    return 1;
  }
}

function runListRules(asJson: boolean): number {
  if (asJson) {
    console.log(
      JSON.stringify(
        ALL_RULES.map((r) => ({
          name: r.name,
          category: r.category,
          defaultSeverity: r.defaultSeverity,
          enabledByDefault: r.enabledByDefault,
          description: r.description,
        })),
        null,
        2,
      ),
    );
    return 0;
  }

  const width = Math.max(...ALL_RULES.map((r) => r.name.length));
  let lastCategory = '';
  for (const rule of ALL_RULES) {
    if (rule.category !== lastCategory) {
      console.log(`\n${pc.bold(rule.category)}`);
      lastCategory = rule.category;
    }
    const state = rule.enabledByDefault
      ? pc.green(rule.defaultSeverity.padEnd(7))
      : pc.dim('off    ');
    console.log(`  ${rule.name.padEnd(width)}  ${state}  ${pc.dim(rule.description)}`);
  }
  return 0;
}

function runInit(force: boolean): number {
  const name = 'prisma-strong-migrations.config.cjs';
  const file = resolve(process.cwd(), name);
  if (existsSync(file) && !force) {
    console.error(pc.red(`${name} already exists. Use --force to overwrite.`));
    return 1;
  }
  writeFileSync(file, starterConfig());
  console.log(pc.green(`Created ${name}`));
  return 0;
}

function starterConfig(): string {
  const ruleLines = ALL_RULES.map((rule) => {
    const value = rule.enabledByDefault ? `'${rule.defaultSeverity}'` : `'off'`;
    return `    '${rule.name}': ${value},${rule.enabledByDefault ? '' : ' // opt-in'}`;
  }).join('\n');

  return `/** @type {import('prisma-strong-migrations').UserConfig} */
module.exports = {
  migrationsDir: './prisma/migrations',
  dialect: 'postgresql',
  // Lowest severity that fails the run: 'error' or 'warning'.
  failOn: 'error',
  rules: {
${ruleLines}
  },
};
`;
}

/** Choose a reporter: explicit flag, else github inside Actions, else stylish. */
function resolveReporter(flag: string | undefined): ReporterName | null {
  if (flag) return isReporterName(flag) ? flag : null;
  return process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'stylish';
}

/** Resolve the base ref for --changed, honoring GitHub's PR base when present. */
function resolveBase(base: string | undefined): string {
  if (base) return base;
  const prBase = process.env.GITHUB_BASE_REF;
  return prBase ? `origin/${prBase}` : 'origin/main';
}

function printError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = error instanceof ConfigError ? 'Configuration error' : 'Error';
  console.error(pc.red(`${prefix}: ${message}`));
}

if (require.main === module) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      printError(error);
      process.exit(1);
    },
  );
}
