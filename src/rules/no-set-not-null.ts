import type { Rule } from '../types';
import { alterActions, identifierName, isSetNotNull } from './ast';
import { docs } from './docs';

export const noSetNotNull: Rule = {
  name: 'no-set-not-null',
  category: 'locking',
  defaultSeverity: 'warning',
  enabledByDefault: true,
  description: 'SET NOT NULL scans the whole table under an exclusive lock and fails if any value is null.',
  docsUrl: docs('no-set-not-null'),
  check(ctx) {
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      if (!isSetNotNull(action)) continue;
      const column = identifierName(action.column);
      ctx.report({
        statement,
        node: action,
        message: `SET NOT NULL on "${column}"${table ? ` in "${table}"` : ''} locks and scans the table.`,
        detail:
          'Postgres takes an ACCESS EXCLUSIVE lock and reads every row to verify none are null. On a large table that blocks reads and writes for the duration, and it errors outright if any row is null.',
        suggestion:
          'Backfill the column first, then add a CHECK (col IS NOT NULL) NOT VALID constraint, VALIDATE it (no exclusive lock), and finally SET NOT NULL — which is cheap once a validated matching constraint exists (PG 12+).',
      });
    }
  },
};
