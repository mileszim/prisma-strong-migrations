import type { Rule } from '../types';
import { createdTables, createIndexInfo, parsedStatements } from './ast';
import { docs } from './docs';

export const requireConcurrentIndex: Rule = {
  name: 'require-concurrent-index',
  category: 'locking',
  defaultSeverity: 'warning',
  enabledByDefault: true,
  description: 'CREATE INDEX without CONCURRENTLY blocks writes to the table while the index builds.',
  docsUrl: docs('require-concurrent-index'),
  check(ctx) {
    const fresh = createdTables(ctx.statements);
    for (const statement of parsedStatements(ctx.statements)) {
      if (statement.node.type !== 'create_index_stmt') continue;
      const index = createIndexInfo(statement.node);
      if (index.concurrently) continue;
      // Indexing a table created in this same migration is fine — it's empty.
      if (index.table && fresh.has(index.table)) continue;
      ctx.report({
        statement,
        message: `Building this index on "${index.table}" without CONCURRENTLY blocks writes.`,
        detail:
          'A plain CREATE INDEX takes a SHARE lock that blocks all writes to the table until the build finishes. On a large, busy table that can mean significant downtime.',
        suggestion:
          'Use CREATE INDEX CONCURRENTLY. Note: it cannot run inside a transaction, and Prisma wraps each migration in one — put the statement in its own migration and apply it outside the transaction (e.g. via `prisma db execute`, or mark the migration accordingly) so it is not rolled into the transactional batch.',
      });
    }
  },
};
