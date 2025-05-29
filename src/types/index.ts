import type { DialectName } from 'sql-parser-cst';

export interface Migration {
  id: string;
  filename: string;
  content: string;
  statements: SQLStatement[];
}

export interface SQLStatement {
  type: string;
  content: string;
  startLine: number;
  endLine: number;
  ast?: any;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  check: (statement: SQLStatement, migration: Migration) => Violation[];
  recommendation?: string;
  autoFix?: (statement: SQLStatement) => string;
  enabled: boolean;
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  message: string;
  line: number;
  column?: number;
  suggestion?: string;
  autoFix?: string;
  category: RuleCategory;
}

export interface Config {
  rules: Record<string, RuleConfig>;
  migrationsPath: string;
  exclude?: string[];
  include?: string[];
  failOnWarning?: boolean;
  failOnError?: boolean;
  output?: OutputFormat;
  dialect: DialectName;
}

export interface RuleConfig {
  enabled: boolean;
  severity?: Severity;
  options?: Record<string, any>;
}

export enum Severity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum RuleCategory {
  SCHEMA_SAFETY = 'schema-safety',
  PERFORMANCE = 'performance',
  DATA_INTEGRITY = 'data-integrity',
  DEPLOYMENT_SAFETY = 'deployment-safety',
  BEST_PRACTICES = 'best-practices'
}

export enum OutputFormat {
  JSON = 'json',
  TEXT = 'text',
  JUNIT = 'junit'
}

export interface LintResult {
  violations: Violation[];
  totalFiles: number;
  totalViolations: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface MigrationContext {
  prismaSchema?: string;
  databaseUrl?: string;
  currentSchema?: DatabaseSchema;
}

export interface DatabaseSchema {
  tables: Table[];
  indexes: Index[];
  constraints: Constraint[];
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface Index {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
}

export interface Constraint {
  name: string;
  type: string;
  tableName: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
} 