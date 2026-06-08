import { describe, expect, it } from 'vitest';
import { findings } from './helpers';

const ruleNames = (sql: string, rule: string) => findings(sql, rule).map((d) => d.rule);

describe('no-drop-table', () => {
  it('flags DROP TABLE', () => {
    const d = findings('DROP TABLE "User";', 'no-drop-table');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"User"');
    expect(d[0]!.severity).toBe('error');
  });
  it('ignores CREATE and ALTER TABLE', () => {
    expect(ruleNames('CREATE TABLE "User" ("id" INT);', 'no-drop-table')).toEqual([]);
    expect(ruleNames('ALTER TABLE "User" ADD COLUMN "x" INT;', 'no-drop-table')).toEqual([]);
  });
});

describe('no-drop-column', () => {
  it('flags DROP COLUMN with the column name', () => {
    const d = findings('ALTER TABLE "User" DROP COLUMN "email";', 'no-drop-column');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"email"');
  });
  it('reports each dropped column in a multi-action statement', () => {
    const d = findings('ALTER TABLE "User" DROP COLUMN "a", DROP COLUMN "b";', 'no-drop-column');
    expect(d).toHaveLength(2);
  });
  it('ignores ADD COLUMN', () => {
    expect(ruleNames('ALTER TABLE "User" ADD COLUMN "x" INT;', 'no-drop-column')).toEqual([]);
  });
});

describe('no-rename-column', () => {
  it('flags RENAME COLUMN', () => {
    const d = findings('ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";', 'no-rename-column');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"name"');
    expect(d[0]!.message).toContain('"fullName"');
  });
  it('does not fire on a table rename', () => {
    expect(ruleNames('ALTER TABLE "User" RENAME TO "Account";', 'no-rename-column')).toEqual([]);
  });
});

describe('no-rename-table', () => {
  it('flags RENAME TO', () => {
    const d = findings('ALTER TABLE "User" RENAME TO "Account";', 'no-rename-table');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"Account"');
  });
  it('does not fire on a column rename', () => {
    expect(ruleNames('ALTER TABLE "User" RENAME COLUMN "a" TO "b";', 'no-rename-table')).toEqual([]);
  });
});

describe('no-change-column-type', () => {
  it('flags a type change', () => {
    expect(findings('ALTER TABLE "User" ALTER COLUMN "age" SET DATA TYPE BIGINT;', 'no-change-column-type')).toHaveLength(1);
  });
  it('still flags a type change with a USING clause', () => {
    const d = findings('ALTER TABLE "User" ALTER COLUMN "age" TYPE BIGINT USING age::bigint;', 'no-change-column-type');
    expect(d).toHaveLength(1);
    expect(d[0]!.detail).toContain('USING');
  });
  it('ignores SET NOT NULL', () => {
    expect(ruleNames('ALTER TABLE "User" ALTER COLUMN "age" SET NOT NULL;', 'no-change-column-type')).toEqual([]);
  });
});

describe('no-add-not-null-column-without-default', () => {
  it('flags a NOT NULL column with no default', () => {
    expect(findings('ALTER TABLE "User" ADD COLUMN "age" INTEGER NOT NULL;', 'no-add-not-null-column-without-default')).toHaveLength(1);
  });
  it('allows a NOT NULL column with a default', () => {
    expect(findings('ALTER TABLE "User" ADD COLUMN "age" INTEGER NOT NULL DEFAULT 0;', 'no-add-not-null-column-without-default')).toHaveLength(0);
  });
  it('allows a nullable column', () => {
    expect(findings('ALTER TABLE "User" ADD COLUMN "age" INTEGER;', 'no-add-not-null-column-without-default')).toHaveLength(0);
  });
});

describe('no-set-not-null', () => {
  it('flags SET NOT NULL', () => {
    expect(findings('ALTER TABLE "User" ALTER COLUMN "age" SET NOT NULL;', 'no-set-not-null')).toHaveLength(1);
  });
  it('ignores DROP NOT NULL', () => {
    expect(findings('ALTER TABLE "User" ALTER COLUMN "age" DROP NOT NULL;', 'no-set-not-null')).toHaveLength(0);
  });
});

describe('require-concurrent-index', () => {
  it('flags a non-concurrent CREATE INDEX', () => {
    expect(findings('CREATE INDEX "i" ON "User"("email");', 'require-concurrent-index')).toHaveLength(1);
  });
  it('allows CREATE INDEX CONCURRENTLY', () => {
    expect(findings('CREATE INDEX CONCURRENTLY "i" ON "User"("email");', 'require-concurrent-index')).toHaveLength(0);
  });
  it('flags a non-concurrent UNIQUE index too', () => {
    expect(findings('CREATE UNIQUE INDEX "i" ON "User"("email");', 'require-concurrent-index')).toHaveLength(1);
  });
  it('does not flag an index on a table created in the same migration', () => {
    const sql = [
      'CREATE TABLE "User" ("id" SERIAL NOT NULL, "email" TEXT NOT NULL);',
      'CREATE UNIQUE INDEX "User_email_key" ON "User"("email");',
    ].join('\n');
    expect(findings(sql, 'require-concurrent-index')).toHaveLength(0);
  });
});

describe('constraint-missing-not-valid', () => {
  it('flags a CHECK constraint added without NOT VALID', () => {
    expect(findings('ALTER TABLE "User" ADD CONSTRAINT "c" CHECK ("age" > 0);', 'constraint-missing-not-valid')).toHaveLength(1);
  });
  it('flags a FOREIGN KEY added without NOT VALID', () => {
    const sql = 'ALTER TABLE "Post" ADD CONSTRAINT "f" FOREIGN KEY ("authorId") REFERENCES "User"("id");';
    expect(findings(sql, 'constraint-missing-not-valid')).toHaveLength(1);
  });
  it('allows a constraint added with NOT VALID', () => {
    expect(findings('ALTER TABLE "User" ADD CONSTRAINT "c" CHECK ("age" > 0) NOT VALID;', 'constraint-missing-not-valid')).toHaveLength(0);
  });
  it('does not fire on a UNIQUE constraint', () => {
    expect(findings('ALTER TABLE "User" ADD CONSTRAINT "u" UNIQUE ("email");', 'constraint-missing-not-valid')).toHaveLength(0);
  });
  it('does not fire on a foreign key to/from a table created in the same migration', () => {
    const sql = [
      'CREATE TABLE "Post" ("id" SERIAL NOT NULL, "authorId" INTEGER NOT NULL);',
      'ALTER TABLE "Post" ADD CONSTRAINT "f" FOREIGN KEY ("authorId") REFERENCES "User"("id");',
    ].join('\n');
    expect(findings(sql, 'constraint-missing-not-valid')).toHaveLength(0);
  });
});

describe('no-data-manipulation', () => {
  it('flags INSERT, UPDATE, and DELETE', () => {
    expect(findings("INSERT INTO \"User\" (\"id\") VALUES (1);", 'no-data-manipulation')).toHaveLength(1);
    expect(findings('UPDATE "User" SET "x" = 1 WHERE "id" = 2;', 'no-data-manipulation')).toHaveLength(1);
    expect(findings('DELETE FROM "User" WHERE "id" = 2;', 'no-data-manipulation')).toHaveLength(1);
  });
  it('calls out an UPDATE without a WHERE clause', () => {
    const d = findings('UPDATE "User" SET "x" = 1;', 'no-data-manipulation');
    expect(d[0]!.message).toContain('no WHERE');
  });
  it('ignores DDL', () => {
    expect(findings('ALTER TABLE "User" ADD COLUMN "x" INT;', 'no-data-manipulation')).toHaveLength(0);
  });
});

describe('require-explicit-not-null (opt-in)', () => {
  it('flags a column with neither NULL nor NOT NULL', () => {
    const d = findings('CREATE TABLE "User" ("id" SERIAL PRIMARY KEY, "bio" TEXT);', 'require-explicit-not-null');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"bio"');
  });
  it('allows NOT NULL, explicit NULL, and primary-key columns', () => {
    const sql = 'CREATE TABLE "User" ("id" SERIAL PRIMARY KEY, "a" TEXT NOT NULL, "b" TEXT NULL);';
    expect(findings(sql, 'require-explicit-not-null')).toHaveLength(0);
  });
});

describe('require-pii-comment (opt-in)', () => {
  it('flags a column that looks like personal data', () => {
    const d = findings('ALTER TABLE "User" ADD COLUMN "email" TEXT;', 'require-pii-comment');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('"email"');
  });
  it('ignores ordinary columns', () => {
    expect(findings('ALTER TABLE "User" ADD COLUMN "count" INT;', 'require-pii-comment')).toHaveLength(0);
  });
});

describe('no-unindexed-foreign-key (opt-in)', () => {
  it('flags a foreign key with no covering index in the migration', () => {
    const sql = 'ALTER TABLE "Post" ADD CONSTRAINT "f" FOREIGN KEY ("authorId") REFERENCES "User"("id");';
    expect(findings(sql, 'no-unindexed-foreign-key')).toHaveLength(1);
  });
  it('is satisfied when an index on the column is created in the same migration', () => {
    const sql = [
      'CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");',
      'ALTER TABLE "Post" ADD CONSTRAINT "f" FOREIGN KEY ("authorId") REFERENCES "User"("id");',
    ].join('\n');
    expect(findings(sql, 'no-unindexed-foreign-key')).toHaveLength(0);
  });
});
