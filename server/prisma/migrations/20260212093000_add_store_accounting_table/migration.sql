CREATE TABLE "StoreAccountingRecord" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "bankTransferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox1Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox2Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAccountingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreAccountingRecord_storeId_recordDate_createdAt_idx"
ON "StoreAccountingRecord"("storeId", "recordDate", "createdAt");

ALTER TABLE "StoreAccountingRecord"
ADD CONSTRAINT "StoreAccountingRecord_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
