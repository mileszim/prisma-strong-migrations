import { LintResult, OutputFormat } from '../types';
import { TextReporter } from './text-reporter';
import { JsonReporter } from './json-reporter';
import { JunitReporter } from './junit-reporter';

export interface Reporter {
  format(result: LintResult): string;
}

export class ReporterFactory {
  static create(format: OutputFormat): Reporter {
    switch (format) {
      case OutputFormat.JSON:
        return new JsonReporter();
      case OutputFormat.JUNIT:
        return new JunitReporter();
      case OutputFormat.TEXT:
      default:
        return new TextReporter();
    }
  }
}

export { TextReporter, JsonReporter, JunitReporter }; 