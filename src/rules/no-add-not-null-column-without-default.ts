import type { Rule } from '../types';
import { alterActions, columnInfo } from './ast';
import { docs } from './docs';

export const noAddNotNullColumnWithoutDefault: Rule = {
  name: 'no-add-not-null-column-without-default',
  category: 'correctness',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Adding a NOT NULL column with no default fails on a table that already has rows.',
  docsUrl: docs('no-add-not-null-column-without-default'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (action.type !== 'alter_action_add_column') continue;
      const column = columnInfo(action.column);
      if (!column.notNull || column.hasDefault || column.generated) continue;
      ctx.report({
        statement,
        node: action,
        message: `Adding NOT NULL column "${column.name}"${table ? ` to "${table}"` : ''} without a default will fail if the table has rows.`,
        detail:
          'Postgres must give every existing row a value for the new NOT NULL column. With no default it cannot, so the migration aborts with "column contains null values".',
        suggestion:
          'Add a DEFAULT (a constant default is a fast metadata-only change on PG 11+), or add the column as nullable, backfill it, then add the NOT NULL constraint in a later step.',
      });
    }
  },
};
