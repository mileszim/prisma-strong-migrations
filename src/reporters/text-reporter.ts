import chalk from 'chalk';
import { LintResult, Severity } from '../types';
import { Reporter } from './index';

export class TextReporter implements Reporter {
  format(result: LintResult): string {
    if (result.totalViolations === 0) {
      return chalk.green('✓ No violations found in migration files');
    }

    const output: string[] = [];
    
    // Group violations by file (migration)
    const violationsByFile = new Map<string, typeof result.violations>();
    
    for (const violation of result.violations) {
      const key = 'migration'; // We could track filename if needed
      if (!violationsByFile.has(key)) {
        violationsByFile.set(key, []);
      }
      violationsByFile.get(key)!.push(violation);
    }

    for (const [file, violations] of violationsByFile) {
      output.push(chalk.underline(file));
      
      for (const violation of violations) {
        const severityColor = this.getSeverityColor(violation.severity);
        const severityIcon = this.getSeverityIcon(violation.severity);
        
        const line = `  ${severityColor(severityIcon)} ${violation.line}:1  ${violation.message}  ${chalk.gray(violation.ruleId)}`;
        output.push(line);
        
        if (violation.suggestion) {
          output.push(chalk.dim(`    💡 ${violation.suggestion}`));
        }
      }
      
      output.push(''); // Empty line between files
    }

    // Summary
    const summary = this.formatSummary(result);
    output.push(summary);

    return output.join('\n');
  }

  private getSeverityColor(severity: Severity): (text: string) => string {
    switch (severity) {
      case Severity.ERROR:
        return chalk.red;
      case Severity.WARNING:
        return chalk.yellow;
      case Severity.INFO:
        return chalk.blue;
      default:
        return chalk.gray;
    }
  }

  private getSeverityIcon(severity: Severity): string {
    switch (severity) {
      case Severity.ERROR:
        return '✖';
      case Severity.WARNING:
        return '⚠';
      case Severity.INFO:
        return 'ℹ';
      default:
        return '•';
    }
  }

  private formatSummary(result: LintResult): string {
    const parts: string[] = [];
    
    if (result.errorCount > 0) {
      parts.push(chalk.red(`${result.errorCount} error${result.errorCount !== 1 ? 's' : ''}`));
    }
    
    if (result.warningCount > 0) {
      parts.push(chalk.yellow(`${result.warningCount} warning${result.warningCount !== 1 ? 's' : ''}`));
    }
    
    if (result.infoCount > 0) {
      parts.push(chalk.blue(`${result.infoCount} info${result.infoCount !== 1 ? 's' : ''}`));
    }

    const summary = parts.length > 0 ? parts.join(', ') : '0 problems';
    return `\n${summary} (${result.totalFiles} file${result.totalFiles !== 1 ? 's' : ''} linted)`;
  }
} 