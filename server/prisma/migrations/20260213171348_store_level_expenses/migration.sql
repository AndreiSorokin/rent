-- AlterTable
ALTER TABLE "HouseholdExpense" ADD COLUMN     "storeId" INTEGER,
ALTER COLUMN "pavilionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PavilionExpense" ADD COLUMN     "storeId" INTEGER,
ALTER COLUMN "pavilionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "HouseholdExpense_storeId_createdAt_idx" ON "HouseholdExpense"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "PavilionExpense_storeId_type_createdAt_idx" ON "PavilionExpense"("storeId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "PavilionExpense" ADD CONSTRAINT "PavilionExpense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdExpense" ADD CONSTRAINT "HouseholdExpense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
