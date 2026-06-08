-- AlterTable: drops a column that running code may still select
ALTER TABLE "User" DROP COLUMN "bio";

-- AlterTable: NOT NULL with no default fails on a populated table
ALTER TABLE "User" ADD COLUMN "country" TEXT NOT NULL;

-- CreateIndex: a plain build locks out writes while it runs
CREATE INDEX "User_country_idx" ON "User"("country");
