import type { Rule } from '../types';
import { alterActions, identifierName } from './ast';
import { docs } from './docs';

export const noRenameColumn: Rule = {
  name: 'no-rename-column',
  category: 'backwards-incompatible',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Renaming a column breaks code reading the old name during a rolling deploy.',
  docsUrl: docs('no-rename-column'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (action.type !== 'alter_action_rename_column') continue;
      const from = identifierName(action.oldName);
      const to = identifierName(action.newName);
      ctx.report({
        statement,
        node: action,
        message: `Renaming column "${from}" to "${to}"${table ? ` on "${table}"` : ''} is backwards-incompatible.`,
        detail:
          'A rename is a drop plus an add as far as the running app is concerned. Between the migration applying and the new code deploying, the old code queries a column that no longer exists.',
        suggestion:
          'Use expand-and-contract: add the new column, backfill and dual-write from the app, switch reads to the new column, then drop the old one in a later migration.',
      });
    }
  },
};
