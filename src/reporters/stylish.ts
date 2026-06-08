import pc from 'picocolors';
import type { Diagnostic, LintResult } from '../types';

/** ESLint-style human-readable output, grouped by file. */
export function stylish(result: LintResult): string {
  if (result.diagnostics.length === 0) {
    return pc.green(`✔ No migration safety issues found (${fileCount(result.filesChecked)} checked).`);
  }

  const lines: string[] = [];
  for (const [file, diagnostics] of groupByFile(result.diagnostics)) {
    lines.push(pc.underline(file));
    const width = Math.max(...diagnostics.map((d) => `${d.line}:${d.column}`.length));
    for (const d of diagnostics) {
      const loc = `${d.line}:${d.column}`.padEnd(width);
      const level = d.severity === 'error' ? pc.red('error  ') : pc.yellow('warning');
      lines.push(`  ${pc.dim(loc)}  ${level}  ${d.message}  ${pc.dim(d.rule)}`);
      if (d.detail) lines.push(pc.dim(`${indent(width)}why: ${d.detail}`));
      if (d.suggestion) lines.push(pc.dim(`${indent(width)}fix: ${d.suggestion}`));
    }
    lines.push('');
  }

  lines.push(summary(result));
  return lines.join('\n');
}

function summary(result: LintResult): string {
  const total = result.errorCount + result.warningCount;
  const parts = [
    result.errorCount > 0 ? pc.red(`${result.errorCount} ${plural(result.errorCount, 'error')}`) : null,
    result.warningCount > 0
      ? pc.yellow(`${result.warningCount} ${plural(result.warningCount, 'warning')}`)
      : null,
  ].filter(Boolean);
  const mark = result.errorCount > 0 ? pc.red('✖') : pc.yellow('⚠');
  return `${mark} ${total} ${plural(total, 'problem')} (${parts.join(', ')})`;
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const groups = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = groups.get(d.file) ?? [];
    list.push(d);
    groups.set(d.file, list);
  }
  return groups;
}

const indent = (width: number) => ' '.repeat(width + 13);
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const fileCount = (n: number) => `${n} ${plural(n, 'file')}`;
