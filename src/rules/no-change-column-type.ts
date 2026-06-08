import type { Rule } from '../types';
import { alterActions, hasUsingClause, identifierName, isSetDataType } from './ast';
import { docs } from './docs';

export const noChangeColumnType: Rule = {
  name: 'no-change-column-type',
  category: 'backwards-incompatible',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Changing a column type can rewrite the whole table under lock and break running code.',
  docsUrl: docs('no-change-column-type'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (!isSetDataType(action)) continue;
      const column = identifierName(action.column);
      ctx.report({
        statement,
        node: action,
        message: `Changing the type of column "${column}"${table ? ` on "${table}"` : ''} is risky.`,
        detail:
          'Most type changes rewrite the entire table while holding an ACCESS EXCLUSIVE lock (blocking reads and writes), and the deployed app may not handle the new type.' +
          (hasUsingClause(action)
            ? ' The USING clause controls conversion but does not avoid the rewrite or the lock.'
            : ''),
        suggestion:
          'Add a new column of the new type, backfill it in batches, dual-write from the app, switch reads over, then drop the old column. A handful of changes (e.g. widening varchar(n), int→bigint on PG 12+ for some cases) are cheap — downgrade or disable this rule for those.',
      });
    }
  },
};
