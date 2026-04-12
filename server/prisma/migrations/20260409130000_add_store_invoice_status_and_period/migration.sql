CREATE TYPE "StoreInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

ALTER TABLE "StoreInvoice"
ADD COLUMN "periodStart" TIMESTAMP(3),
ADD COLUMN "status" "StoreInvoiceStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "StoreInvoice"
SET "periodStart" = date_trunc('month', "issuedAt")
WHERE "periodStart" IS NULL;

ALTER TABLE "StoreInvoice"
ALTER COLUMN "periodStart" SET NOT NULL;

CREATE INDEX "StoreInvoice_storeId_periodStart_issuedAt_idx"
ON "StoreInvoice"("storeId", "periodStart", "issuedAt");
