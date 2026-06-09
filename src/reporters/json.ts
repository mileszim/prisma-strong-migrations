import type { LintResult } from '../types';

/** Machine-readable output for tooling and downstream processing. */
export function json(result: LintResult): string {
  return JSON.stringify(
    {
      summary: {
        filesChecked: result.filesChecked,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        parseErrorCount: result.parseErrorCount,
        suppressedCount: result.suppressed.length,
      },
      diagnostics: result.diagnostics,
      suppressed: result.suppressed,
    },
    null,
    2,
  );
}
