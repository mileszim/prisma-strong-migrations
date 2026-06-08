-- AlterTable: nullable column is an instant, metadata-only change
ALTER TABLE "User" ADD COLUMN "bio" TEXT;

-- AlterTable: NOT NULL is safe here because it ships with a constant default
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
