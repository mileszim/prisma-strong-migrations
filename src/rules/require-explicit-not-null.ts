import type { Rule } from '../types';
import { alterActions, columnInfo, hasExplicitNull, parsedStatements, tableColumns } from './ast';
import { docs } from './docs';

/**
 * Opinionated, opt-in: require every new column to state NULL or NOT NULL
 * explicitly rather than relying on the implicit nullable default.
 */
export const requireExplicitNotNull: Rule = {
  name: 'require-explicit-not-null',
  category: 'opinionated',
  defaultSeverity: 'warning',
  enabledByDefault: false,
  description: 'Require new columns to declare NULL or NOT NULL explicitly instead of defaulting to nullable.',
  docsUrl: docs('require-explicit-not-null'),
  check(ctx) {
    const report = (statement: any, node: any, column: ReturnType<typeof columnInfo>) => {
      if (column.notNull || column.primaryKey || hasExplicitNull(node)) return;
      ctx.report({
        statement,
        node,
        message: `Column "${column.name}" does not state NULL or NOT NULL explicitly.`,
        detail: 'Relying on the implicit nullable default makes the intended contract ambiguous to readers.',
        suggestion: 'Declare the column NOT NULL (with a default if needed) or explicitly NULL.',
      });
    };

    for (const statement of parsedStatements(ctx.statements)) {
      if (statement.node.type !== 'create_table_stmt') continue;
      for (const column of tableColumns(statement.node)) {
        report(statement, column, columnInfo(column));
      }
    }
    for (const { statement, action } of alterActions(ctx.statements)) {
      if (action.type !== 'alter_action_add_column') continue;
      report(statement, action.column, columnInfo(action.column));
    }
  },
};
