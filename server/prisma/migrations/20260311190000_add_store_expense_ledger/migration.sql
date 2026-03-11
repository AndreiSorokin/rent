-- CreateTable
CREATE TABLE "StoreExpenseLedger" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER,
    "expenseType" "PavilionExpenseType" NOT NULL,
    "note" TEXT,
    "bankTransferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox1Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox2Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreExpenseLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreExpenseLedger_storeId_occurredAt_createdAt_idx" ON "StoreExpenseLedger"("storeId", "occurredAt", "createdAt");

-- CreateIndex
CREATE INDEX "StoreExpenseLedger_sourceType_sourceId_occurredAt_idx" ON "StoreExpenseLedger"("sourceType", "sourceId", "occurredAt");

-- AddForeignKey
ALTER TABLE "StoreExpenseLedger" ADD CONSTRAINT "StoreExpenseLedger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
