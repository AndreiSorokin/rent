ALTER TABLE "PaymentTransaction"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key"
ON "PaymentTransaction"("idempotencyKey");
