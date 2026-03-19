ALTER TABLE "Store"
ADD COLUMN "billingCompanyName" TEXT,
ADD COLUMN "billingLegalAddress" TEXT,
ADD COLUMN "billingInn" TEXT;

CREATE TABLE "StoreInvoice" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "rentedPavilionsCount" INTEGER NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offerUrl" TEXT NOT NULL,
    "customerCompanyName" TEXT NOT NULL,
    "customerLegalAddress" TEXT NOT NULL,
    "customerInn" TEXT NOT NULL,

    CONSTRAINT "StoreInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreInvoice_storeId_issuedAt_idx" ON "StoreInvoice"("storeId", "issuedAt");

ALTER TABLE "StoreInvoice"
ADD CONSTRAINT "StoreInvoice_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
