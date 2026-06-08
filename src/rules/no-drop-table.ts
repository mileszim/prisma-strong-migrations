import type { Rule } from '../types';
import { parsedStatements, droppedTables } from './ast';
import { docs } from './docs';

export const noDropTable: Rule = {
  name: 'no-drop-table',
  category: 'destructive',
  defaultSeverity: 'error',
  enabledByDefault: true,
  description: 'Dropping a table irreversibly deletes its data and breaks code still reading from it.',
  docsUrl: docs('no-drop-table'),
  check(ctx) {
    for (const statement of parsedStatements(ctx.statements)) {
      if (statement.node.type !== 'drop_table_stmt') continue;
      const tables = droppedTables(statement.node);
      ctx.report({
        statement,
        message:
          tables.length > 0
            ? `Dropping table ${tables.map((t) => `"${t}"`).join(', ')} is destructive.`
            : 'Dropping a table is destructive.',
        detail:
          'The data is lost permanently, and any still-running application code that reads the table will error until it is redeployed.',
        suggestion:
          'Ship the code that stops using the table first. Once nothing references it, drop the table in a later migration. Keep a backup if the data may be needed.',
      });
    }
  },
};
