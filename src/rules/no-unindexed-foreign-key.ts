import type { Rule } from '../types';
import { addedConstraint, alterActions, createIndexInfo, identifierName, parsedStatements } from './ast';
import { docs } from './docs';

/**
 * Opinionated, opt-in: a foreign key whose referencing column has no index
 * makes joins and cascading deletes slow. Prisma indexes relation scalar fields
 * in many cases, but not always — this surfaces the ones it misses.
 */
export const noUnindexedForeignKey: Rule = {
  name: 'no-unindexed-foreign-key',
  category: 'opinionated',
  defaultSeverity: 'warning',
  enabledByDefault: false,
  description: 'Flag foreign keys whose referencing column has no covering index in the same migration.',
  docsUrl: docs('no-unindexed-foreign-key'),
  check(ctx) {
    const indexedColumns = collectIndexedLeadingColumns(ctx.statements);

    for (const { statement, table, action } of alterActions(ctx.statements)) {
      const constraint = addedConstraint(action);
      if (!constraint || constraint.kind !== 'foreign_key') continue;
      const first = constraint.columns[0];
      if (!first) continue;
      if (indexedColumns.has(key(table, first))) continue;
      ctx.report({
        statement,
        node: action,
        message: `Foreign key on "${first}"${table ? ` in "${table}"` : ''} has no covering index.`,
        detail:
          'Without an index on the referencing column, joins across the relation and cascading updates/deletes on the parent must scan the whole table.',
        suggestion: `Add an index on the referencing column, e.g. CREATE INDEX ON ${table ? `"${table}"` : 'the table'} ("${first}"), or declare it with @@index in your Prisma schema.`,
      });
    }
  },
};

const key = (table: string | undefined, column: string) => `${table ?? ''}.${column}`;

/** Leading-column index coverage created in this migration, keyed by table.column. */
function collectIndexedLeadingColumns(statements: Parameters<typeof alterActions>[0]): Set<string> {
  const indexed = new Set<string>();
  for (const statement of parsedStatements(statements)) {
    if (statement.node.type !== 'create_index_stmt') continue;
    const { table } = createIndexInfo(statement.node);
    const first = (statement.node as any).columns?.expr?.items?.[0];
    const column = identifierName(first?.expr ?? first);
    if (column) indexed.add(key(table, column));
  }
  return indexed;
}
