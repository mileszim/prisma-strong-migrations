import type { Rule } from '../types';
import { alterActions, identifierName } from './ast';
import { docs } from './docs';

export const noRenameTable: Rule = {
  name: 'no-rename-table',
  category: 'backwards-incompatible',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Renaming a table breaks code reading the old name during a rolling deploy.',
  docsUrl: docs('no-rename-table'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (action.type !== 'alter_action_rename') continue;
      const to = identifierName(action.newName);
      ctx.report({
        statement,
        node: action,
        message: `Renaming table "${table}" to "${to}" is backwards-incompatible.`,
        detail:
          'The previously deployed app keeps querying the old table name until it is redeployed, so every query against it fails the moment the rename lands.',
        suggestion:
          'Use expand-and-contract: create the new table, copy data and dual-write, move reads over, then drop the old table later. In Prisma, prefer @@map to change the database name without renaming, or keep the model name stable.',
      });
    }
  },
};
