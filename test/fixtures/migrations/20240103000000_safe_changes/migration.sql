-- AlterTable: add a nullable column (instant, no rewrite)
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;

-- AlterTable: add a NOT NULL column with a constant default (metadata-only on PG 11+)
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: built CONCURRENTLY so it does not block writes
CREATE INDEX CONCURRENTLY "User_nickname_idx" ON "User"("nickname");

-- AddForeignKey: added NOT VALID, to be validated separately
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
