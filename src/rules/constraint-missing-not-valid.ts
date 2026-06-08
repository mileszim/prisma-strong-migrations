import type { Rule } from '../types';
import { addedConstraint, alterActions, createdTables } from './ast';
import { docs } from './docs';

/** Constraint kinds that support being added `NOT VALID` and then validated. */
const VALIDATABLE = new Set(['check', 'foreign_key']);

export const constraintMissingNotValid: Rule = {
  name: 'constraint-missing-not-valid',
  category: 'locking',
  defaultSeverity: 'warning',
  enabledByDefault: true,
  description: 'Adding a CHECK or FOREIGN KEY constraint validates every existing row under a lock.',
  docsUrl: docs('constraint-missing-not-valid'),
  check(ctx) {
    const fresh = createdTables(ctx.statements);
    for (const { statement, table, action } of alterActions(ctx.statements)) {
      const constraint = addedConstraint(action);
      if (!constraint || !VALIDATABLE.has(constraint.kind) || constraint.notValid) continue;
      // Validating against a table created in this migration is free — it's empty.
      if (table && fresh.has(table)) continue;
      const label = constraint.kind === 'foreign_key' ? 'foreign key' : 'check';
      ctx.report({
        statement,
        node: action,
        message: `Adding ${label} constraint ${constraint.name ? `"${constraint.name}" ` : ''}validates every existing row${table ? ` in "${table}"` : ''}.`,
        detail:
          'Validating the constraint against existing data holds a lock that blocks writes (and, for foreign keys, locks the referenced table too) while the whole table is scanned.',
        suggestion:
          'Add the constraint with NOT VALID first (a fast metadata change that still enforces it for new rows), then run VALIDATE CONSTRAINT in a separate migration — validation takes only a SHARE UPDATE EXCLUSIVE lock and does not block writes.',
      });
    }
  },
};
