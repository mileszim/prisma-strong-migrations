-- DropColumn
ALTER TABLE "User" DROP COLUMN "name";

-- RenameColumn
ALTER TABLE "Post" RENAME COLUMN "authorId" TO "userId";

-- AddColumn
ALTER TABLE "Post" ADD COLUMN "status" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- DropTable
DROP TABLE "Comment";

-- Backfill
UPDATE "Post" SET "status" = 'draft';
