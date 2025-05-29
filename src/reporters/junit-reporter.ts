import { LintResult, Severity, Violation } from '../types';
import { Reporter } from './index';

export class JunitReporter implements Reporter {
  format(result: LintResult): string {
    const timestamp = new Date().toISOString();
    const testSuites = this.generateTestSuites(result);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites 
  name="prisma-strong-migrations" 
  tests="${result.totalViolations}" 
  failures="${result.errorCount + result.warningCount}" 
  errors="0" 
  time="0" 
  timestamp="${timestamp}">
${testSuites}
</testsuites>`;
  }

  private generateTestSuites(result: LintResult): string {
    const testCases: string[] = [];
    
    for (const violation of result.violations) {
      const isFailure = violation.severity === Severity.ERROR || violation.severity === Severity.WARNING;
      const testCase = this.generateTestCase(violation, isFailure);
      testCases.push(testCase);
    }

    return `  <testsuite name="migration-lint" tests="${result.totalViolations}" failures="${result.errorCount + result.warningCount}" errors="0" time="0">
${testCases.join('\n')}
  </testsuite>`;
  }

  private generateTestCase(violation: Violation, isFailure: boolean): string {
    const testName = `${violation.ruleId} at line ${violation.line}`;
    const className = violation.category || 'migration-lint';
    
    let testCase = `    <testcase name="${this.escapeXml(testName)}" classname="${className}" time="0">`;
    
    if (isFailure) {
      const failureType = violation.severity === Severity.ERROR ? 'error' : 'warning';
      testCase += `
      <failure type="${failureType}" message="${this.escapeXml(violation.message)}">
        ${this.escapeXml(violation.message)}
        ${violation.suggestion ? `\nSuggestion: ${this.escapeXml(violation.suggestion)}` : ''}
      </failure>`;
    }
    
    testCase += `
    </testcase>`;
    
    return testCase;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
} 