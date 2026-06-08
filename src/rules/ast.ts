/**
 * Helpers for reading the facts rules care about out of the sql-parser-cst CST.
 *
 * All CST-shape knowledge lives here so that rules never touch raw node
 * internals and a parser upgrade only needs changes in one place. Nodes are
 * typed loosely (`any`) because the full CST union is large; the helpers below
 * are the typed, tested boundary around it.
 */
import type { ParsedStatement } from '../types';

type AnyNode = any;

/** Resolve an identifier / quoted identifier / schema-qualified name to a string. */
export function identifierName(node: AnyNode): string | undefined {
  if (!node) return undefined;
  switch (node.type) {
    case 'identifier':
      return node.name;
    case 'member_expr':
      // schema.table → the table part is the property.
      return identifierName(node.property);
    case 'string_literal':
      return node.value;
    default:
      return typeof node.name === 'string' ? node.name : undefined;
  }
}

/** Statements that parsed successfully, narrowed to those with a CST node. */
export function* parsedStatements(
  statements: ParsedStatement[],
): Generator<ParsedStatement & { node: NonNullable<ParsedStatement['node']> }> {
  for (const statement of statements) {
    if (statement.node) yield statement as ParsedStatement & { node: NonNullable<ParsedStatement['node']> };
  }
}

export interface AlterAction {
  statement: ParsedStatement;
  /** The table being altered. */
  table: string | undefined;
  /** A single `alter_action_*` CST node. */
  action: AnyNode;
}

/** Yield every action of every `ALTER TABLE` statement, flattened. */
export function* alterActions(statements: ParsedStatement[]): Generator<AlterAction> {
  for (const statement of parsedStatements(statements)) {
    const node = statement.node as AnyNode;
    if (node.type !== 'alter_table_stmt') continue;
    const table = identifierName(node.table);
    for (const action of node.actions?.items ?? []) {
      yield { statement, table, action };
    }
  }
}

export interface ColumnInfo {
  name: string | undefined;
  notNull: boolean;
  hasDefault: boolean;
  generated: boolean;
  primaryKey: boolean;
}

/** Read a `column_definition` node (from CREATE TABLE or ADD COLUMN). */
export function columnInfo(column: AnyNode): ColumnInfo {
  const constraints: AnyNode[] = column?.constraints ?? [];
  return {
    name: identifierName(column?.name),
    notNull: constraints.some((c) => c.type === 'constraint_not_null'),
    hasDefault: constraints.some((c) => c.type === 'constraint_default'),
    generated: constraints.some((c) => c.type === 'constraint_generated'),
    primaryKey: constraints.some((c) => c.type === 'constraint_primary_key'),
  };
}

/** True if an `alter_action_alter_column` changes the column's data type. */
export function isSetDataType(action: AnyNode): boolean {
  return action?.type === 'alter_action_alter_column' && action.action?.type === 'alter_action_set_data_type';
}

/** True if a `SET DATA TYPE` action carries a `USING` conversion clause. */
export function hasUsingClause(action: AnyNode): boolean {
  const clauses: AnyNode[] = action?.action?.clauses ?? [];
  return clauses.some((c) => c.type === 'set_data_type_using_clause');
}

/** True if an `alter_action_alter_column` is `SET NOT NULL`. */
export function isSetNotNull(action: AnyNode): boolean {
  return action?.type === 'alter_action_alter_column' && action.action?.type === 'alter_action_set_not_null';
}

export interface ConstraintInfo {
  /** `foreign_key`, `unique`, `check`, `primary_key`, or the raw type. */
  kind: string;
  name: string | undefined;
  /** Columns the constraint covers (empty for CHECK). */
  columns: string[];
  /** Whether the constraint was added with `NOT VALID`. */
  notValid: boolean;
}

/** Read an `alter_action_add_constraint` action, or null if it isn't one. */
export function addedConstraint(action: AnyNode): ConstraintInfo | null {
  if (action?.type !== 'alter_action_add_constraint') return null;
  const constraint = action.constraint ?? {};
  const modifiers: AnyNode[] = action.modifiers ?? [];
  return {
    kind: constraint.type?.replace(/^constraint_/, '') ?? 'unknown',
    name: identifierName(action.name?.name),
    columns: constraintColumns(constraint),
    notValid: modifiers.some(
      (m) => m.type === 'constraint_modifier' && keywordNames(m.kw).includes('VALID'),
    ),
  };
}

/** Column names listed in a constraint's `(…)` column list. */
export function constraintColumns(constraint: AnyNode): string[] {
  const items: AnyNode[] = constraint?.columns?.expr?.items ?? [];
  return items.map(identifierName).filter(Boolean) as string[];
}

/**
 * Names of tables created within this migration. Operations on a table created
 * in the same migration act on a brand-new (empty) table, so locking/validation
 * concerns don't apply — this lets rules skip them and avoid false alarms on the
 * very common "create table, then its indexes and foreign keys" pattern.
 */
export function createdTables(statements: ParsedStatement[]): Set<string> {
  const names = new Set<string>();
  for (const statement of parsedStatements(statements)) {
    const node = statement.node as AnyNode;
    if (node.type !== 'create_table_stmt') continue;
    const name = identifierName(node.name);
    if (name) names.add(name);
  }
  return names;
}

/** Column definitions of a `CREATE TABLE` statement. */
export function tableColumns(node: AnyNode): AnyNode[] {
  const items: AnyNode[] = node?.columns?.expr?.items ?? [];
  return items.filter((item) => item.type === 'column_definition');
}

/** True if a column definition carries an explicit `NULL` (not `NOT NULL`). */
export function hasExplicitNull(column: AnyNode): boolean {
  const constraints: AnyNode[] = column?.constraints ?? [];
  return constraints.some((c) => c.type === 'constraint_null');
}

/** Names of the columns dropped by a `DROP TABLE` (its target tables). */
export function droppedTables(node: AnyNode): string[] {
  return (node?.tables?.items ?? []).map(identifierName).filter(Boolean) as string[];
}

export interface CreateIndexInfo {
  unique: boolean;
  concurrently: boolean;
  table: string | undefined;
}

export function createIndexInfo(node: AnyNode): CreateIndexInfo {
  return {
    unique: keywordNames(node?.indexTypeKw).includes('UNIQUE'),
    concurrently: Boolean(node?.concurrentlyKw),
    table: identifierName(node?.table),
  };
}

/** Collect keyword `.name`s from a keyword node, array of them, or undefined. */
function keywordNames(kw: AnyNode): string[] {
  if (!kw) return [];
  const list = Array.isArray(kw) ? kw : [kw];
  return list.map((k) => k?.name).filter(Boolean) as string[];
}
