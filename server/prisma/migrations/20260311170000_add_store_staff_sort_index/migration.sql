-- AlterTable
ALTER TABLE "StoreStaff" ADD COLUMN "sortIndex" INTEGER;

-- DropIndex
DROP INDEX IF EXISTS "StoreStaff_storeId_createdAt_idx";

-- CreateIndex
CREATE INDEX "StoreStaff_storeId_sortIndex_createdAt_idx" ON "StoreStaff"("storeId", "sortIndex", "createdAt");
