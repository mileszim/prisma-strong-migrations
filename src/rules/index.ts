import { Rule, Severity, RuleCategory } from '../types';
import { noDropTableRule } from './schema-safety/no-drop-table';
import { noDropColumnRule } from './schema-safety/no-drop-column';
import { noAddColumnWithoutDefaultRule } from './schema-safety/no-add-column-without-default';
import { noAlterColumnTypeRule } from './schema-safety/no-alter-column-type';
import { requireForeignKeyCascadeRule } from './schema-safety/require-foreign-key-cascade';
import { noUniqueConstraintWithoutIndexRule } from './schema-safety/no-unique-constraint-without-index';
import { noColumnRenameRule } from './schema-safety/no-column-rename';
import { noTableRenameRule } from './schema-safety/no-table-rename';

import { requireIndexForForeignKeyRule } from './performance/require-index-for-foreign-key';
import { noFullTableScanRule } from './performance/no-full-table-scan';
import { requireConcurrentIndexRule } from './performance/require-concurrent-index';

import { requireNotNullConstraintRule } from './data-integrity/require-not-null-constraint';
import { requirePiiCommentsRule } from './data-integrity/require-pii-comments';

import { noDataManipulationRule } from './deployment-safety/no-data-manipulation';
import { noAddNonNullableColumnRule } from './deployment-safety/no-add-non-nullable-column';
import { noNullableToNonNullableRule } from './deployment-safety/no-nullable-to-non-nullable';

import { requireTransactionBlockRule } from './best-practices/require-transaction-block';

export const BUILT_IN_RULES: Record<string, Rule> = {
  // Schema Safety Rules
  'no-drop-table': noDropTableRule,
  'no-drop-column': noDropColumnRule,
  'no-add-column-without-default': noAddColumnWithoutDefaultRule,
  'no-alter-column-type': noAlterColumnTypeRule,
  'require-foreign-key-cascade': requireForeignKeyCascadeRule,
  'no-unique-constraint-without-index': noUniqueConstraintWithoutIndexRule,
  'no-column-rename': noColumnRenameRule,
  'no-table-rename': noTableRenameRule,
  
  // Performance Rules
  'require-index-for-foreign-key': requireIndexForForeignKeyRule,
  'no-full-table-scan': noFullTableScanRule,
  'require-concurrent-index': requireConcurrentIndexRule,
  
  // Data Integrity Rules
  'require-not-null-constraint': requireNotNullConstraintRule,
  'require-pii-comments': requirePiiCommentsRule,
  
  // Deployment Safety Rules
  'no-data-manipulation': noDataManipulationRule,
  'no-add-non-nullable-column': noAddNonNullableColumnRule,
  'no-nullable-to-non-nullable': noNullableToNonNullableRule,
  
  // Best Practices Rules
  'require-transaction-block': requireTransactionBlockRule,
};

export function getBuiltInRules(): Rule[] {
  return Object.values(BUILT_IN_RULES);
}

export function getBuiltInRule(ruleId: string): Rule | undefined {
  return BUILT_IN_RULES[ruleId];
}

export function createCustomRule(config: {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  check: Rule['check'];
  recommendation?: string;
  autoFix?: Rule['autoFix'];
}): Rule {
  return {
    ...config,
    enabled: true
  };
} 