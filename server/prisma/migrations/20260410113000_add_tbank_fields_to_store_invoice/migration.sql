ALTER TABLE "StoreInvoice"
ADD COLUMN "externalOrderId" TEXT,
ADD COLUMN "tbankPaymentId" TEXT,
ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "paymentStatus" TEXT,
ADD COLUMN "lastWebhookPayload" JSONB;

CREATE UNIQUE INDEX "StoreInvoice_externalOrderId_key"
ON "StoreInvoice"("externalOrderId")
WHERE "externalOrderId" IS NOT NULL;
