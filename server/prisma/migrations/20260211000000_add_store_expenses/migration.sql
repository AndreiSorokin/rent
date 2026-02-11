-- CreateEnum
CREATE TYPE "StoreExpenseType" AS ENUM (
    'SALARIES',
    'PAYROLL_TAX',
    'PROFIT_TAX',
    'DIVIDENDS',
    'BANK_SERVICES',
    'VAT',
    'LAND_RENT'
);

-- CreateTable
CREATE TABLE "StoreExpense" (
    "id" SERIAL NOT NULL,
    "type" "StoreExpenseType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreExpense_storeId_type_createdAt_idx" ON "StoreExpense"("storeId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreExpense" ADD CONSTRAINT "StoreExpense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
