-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "lastMonthlyResetPeriod" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PavilionMonthlyLedger" (
    "id" SERIAL NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "expectedRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedUtilities" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedAdditional" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PavilionMonthlyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PavilionMonthlyLedger_period_pavilionId_idx" ON "PavilionMonthlyLedger"("period", "pavilionId");

-- CreateIndex
CREATE UNIQUE INDEX "PavilionMonthlyLedger_pavilionId_period_key" ON "PavilionMonthlyLedger"("pavilionId", "period");

-- AddForeignKey
ALTER TABLE "PavilionMonthlyLedger" ADD CONSTRAINT "PavilionMonthlyLedger_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
