-- CreateEnum
CREATE TYPE "PavilionExpenseType" AS ENUM (
    'SALARIES',
    'PAYROLL_TAX',
    'PROFIT_TAX',
    'DIVIDENDS',
    'BANK_SERVICES',
    'VAT',
    'LAND_RENT'
);

-- CreateTable
CREATE TABLE "PavilionExpense" (
    "id" SERIAL NOT NULL,
    "type" "PavilionExpenseType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "pavilionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PavilionExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PavilionExpense_pavilionId_type_createdAt_idx" ON "PavilionExpense"("pavilionId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "PavilionExpense" ADD CONSTRAINT "PavilionExpense_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
