import type { LintResult } from '../types';
import { stylish } from './stylish';
import { json } from './json';
import { github } from './github';

export type ReporterName = 'stylish' | 'json' | 'github';

export type Reporter = (result: LintResult) => string;

const REPORTERS: Record<ReporterName, Reporter> = { stylish, json, github };

export function isReporterName(value: string): value is ReporterName {
  return value in REPORTERS;
}

export function getReporter(name: ReporterName): Reporter {
  return REPORTERS[name];
}

export { stylish, json, github };
