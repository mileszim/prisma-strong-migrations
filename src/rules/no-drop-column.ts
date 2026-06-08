import type { Rule } from '../types';
import { alterActions, identifierName } from './ast';
import { docs } from './docs';

export const noDropColumn: Rule = {
  name: 'no-drop-column',
  category: 'destructive',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Dropping a column deletes its data and breaks code still selecting it.',
  docsUrl: docs('no-drop-column'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (action.type !== 'alter_action_drop_column') continue;
      const column = identifierName(action.column);
      ctx.report({
        statement,
        node: action,
        message: `Dropping column ${quote(column)}${table ? ` from "${table}"` : ''} is destructive.`,
        detail:
          'The column data is lost, and any deployed code that still selects or writes this column (Prisma keeps selecting all scalar fields) will error until it is redeployed.',
        suggestion:
          'Remove the field from your Prisma schema and deploy that first so no running code references the column, then drop it in a follow-up migration.',
      });
    }
  },
};

const quote = (name: string | undefined) => (name ? `"${name}"` : 'a column');
