import { LintResult } from '../types';
import { Reporter } from './index';

export class JsonReporter implements Reporter {
  format(result: LintResult): string {
    return JSON.stringify(result, null, 2);
  }
} 