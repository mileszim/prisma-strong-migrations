import type { Rule } from '../types';
import { noDropTable } from './no-drop-table';
import { noDropColumn } from './no-drop-column';
import { noRenameColumn } from './no-rename-column';
import { noRenameTable } from './no-rename-table';
import { noChangeColumnType } from './no-change-column-type';
import { noAddNotNullColumnWithoutDefault } from './no-add-not-null-column-without-default';
import { noSetNotNull } from './no-set-not-null';
import { requireConcurrentIndex } from './require-concurrent-index';
import { constraintMissingNotValid } from './constraint-missing-not-valid';
import { noDataManipulation } from './no-data-manipulation';
import { requireExplicitNotNull } from './require-explicit-not-null';
import { requirePiiComment } from './require-pii-comment';
import { noUnindexedForeignKey } from './no-unindexed-foreign-key';

/** Every built-in rule, in display order. */
export const ALL_RULES: readonly Rule[] = [
  // Destructive
  noDropTable,
  noDropColumn,
  // Backwards-incompatible
  noRenameColumn,
  noRenameTable,
  noChangeColumnType,
  // Correctness
  noAddNotNullColumnWithoutDefault,
  // Locking
  noSetNotNull,
  requireConcurrentIndex,
  constraintMissingNotValid,
  noDataManipulation,
  // Opinionated (opt-in)
  requireExplicitNotNull,
  requirePiiComment,
  noUnindexedForeignKey,
];

const BY_NAME = new Map(ALL_RULES.map((rule) => [rule.name, rule]));

export function getRule(name: string): Rule | undefined {
  return BY_NAME.get(name);
}

export {
  noDropTable,
  noDropColumn,
  noRenameColumn,
  noRenameTable,
  noChangeColumnType,
  noAddNotNullColumnWithoutDefault,
  noSetNotNull,
  requireConcurrentIndex,
  constraintMissingNotValid,
  noDataManipulation,
  requireExplicitNotNull,
  requirePiiComment,
  noUnindexedForeignKey,
};
