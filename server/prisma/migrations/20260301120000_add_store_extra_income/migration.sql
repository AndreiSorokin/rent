-- CreateTable
CREATE TABLE "StoreExtraIncome" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bankTransferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox1Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox2Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreExtraIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreExtraIncome_storeId_period_paidAt_idx" ON "StoreExtraIncome"("storeId", "period", "paidAt");

-- AddForeignKey
ALTER TABLE "StoreExtraIncome" ADD CONSTRAINT "StoreExtraIncome_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
