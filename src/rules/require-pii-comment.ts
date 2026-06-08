import type { Rule } from '../types';
import { alterActions, columnInfo, parsedStatements, tableColumns } from './ast';
import { docs } from './docs';

/** Column-name fragments that commonly indicate personal data. */
const PII_PATTERN =
  /^(email|phone|mobile|ssn|social_?security|tax_?id|passport|address|street|zip|postal|first_?name|last_?name|full_?name|dob|date_?of_?birth|birthday|ip_?address|license|biometric)/i;

/**
 * Opinionated, opt-in: flag columns whose names look like personal data so a
 * human can confirm they are documented/handled for compliance.
 */
export const requirePiiComment: Rule = {
  name: 'require-pii-comment',
  category: 'opinionated',
  defaultSeverity: 'warning',
  enabledByDefault: false,
  description: 'Flag columns that look like personal data (PII) for a compliance review.',
  docsUrl: docs('require-pii-comment'),
  check(ctx) {
    const consider = (statement: any, node: any) => {
      const { name } = columnInfo(node);
      if (!name || !PII_PATTERN.test(name)) return;
      ctx.report({
        statement,
        node,
        message: `Column "${name}" looks like it stores personal data (PII).`,
        detail: 'Personal data often has handling, retention, or documentation requirements.',
        suggestion: 'Confirm this column is intended to hold PII and is documented and handled per your data policy.',
      });
    };

    for (const statement of parsedStatements(ctx.statements)) {
      if (statement.node.type !== 'create_table_stmt') continue;
      for (const column of tableColumns(statement.node)) consider(statement, column);
    }
    for (const { statement, action } of alterActions(ctx.statements)) {
      if (action.type === 'alter_action_add_column') consider(statement, action.column);
    }
  },
};
