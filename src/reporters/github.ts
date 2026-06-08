import type { Diagnostic, LintResult } from '../types';

/**
 * GitHub Actions workflow-command output. Each diagnostic becomes an `::error`
 * or `::warning` annotation that GitHub renders inline on the pull request diff.
 * A short human summary follows so the step log is still readable.
 */
export function github(result: LintResult): string {
  const lines = result.diagnostics.map(annotation);
  lines.push('');
  lines.push(
    result.diagnostics.length === 0
      ? `No migration safety issues found (${result.filesChecked} files checked).`
      : `${result.errorCount} error(s), ${result.warningCount} warning(s) across ${result.filesChecked} file(s).`,
  );
  return lines.join('\n');
}

function annotation(d: Diagnostic): string {
  const command = d.severity === 'error' ? 'error' : 'warning';
  const props = [
    `file=${escapeProp(d.file)}`,
    `line=${d.line}`,
    `col=${d.column}`,
    `title=${escapeProp(`${d.rule}: ${d.migration}`)}`,
  ].join(',');
  return `::${command} ${props}::${escapeData(body(d))}`;
}

function body(d: Diagnostic): string {
  const parts = [d.message];
  if (d.detail) parts.push(`Why: ${d.detail}`);
  if (d.suggestion) parts.push(`Fix: ${d.suggestion}`);
  return parts.join('\n');
}

function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProp(value: string): string {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
