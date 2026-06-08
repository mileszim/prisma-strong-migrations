/** Base URL for rule documentation anchors in the README. */
export const DOCS_BASE = 'https://github.com/mileszim/prisma-strong-migrations#';

export const docs = (ruleName: string): string => `${DOCS_BASE}${ruleName}`;
