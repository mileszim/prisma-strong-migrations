import type { Rule, StatementKind } from '../types';
import { parsedStatements } from './ast';
import { docs } from './docs';

const DML: Record<string, StatementKind> = {
  insert_stmt: 'insert',
  update_stmt: 'update',
  delete_stmt: 'delete',
};

export const noDataManipulation: Rule = {
  name: 'no-data-manipulation',
  category: 'locking',
  defaultSeverity: 'warning',
  enabledByDefault: true,
  description: 'Data backfills inside a schema migration run under the migration lock and can block deploys.',
  docsUrl: docs('no-data-manipulation'),
  check(ctx) {
    for (const statement of parsedStatements(ctx.statements)) {
      const verb = DML[statement.node.type];
      if (!verb) continue;
      const clauses: any[] = (statement.node as any).clauses ?? [];
      const hasWhere = clauses.some((clause) => clause.type === 'where_clause');
      const unscoped = (verb === 'update' || verb === 'delete') && !hasWhere;
      ctx.report({
        statement,
        message: `${verb.toUpperCase()} runs as part of this schema migration${unscoped ? ' and has no WHERE clause' : ''}.`,
        detail:
          'Prisma runs the migration in a transaction, so a large or long-running data change holds locks and stalls the deploy until it finishes' +
          (unscoped ? '. Without a WHERE clause it rewrites every row.' : '.'),
        suggestion:
          'Keep schema changes and data changes separate. Run backfills in batches from application code or a dedicated one-off job after the schema migration, not inside it.',
      });
    }
  },
};
