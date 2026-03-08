ALTER TABLE "AdditionalChargePayment"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "AdditionalChargePayment_idempotencyKey_key"
ON "AdditionalChargePayment"("idempotencyKey");

ALTER TABLE "AdditionalCharge"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "AdditionalCharge_idempotencyKey_key"
ON "AdditionalCharge"("idempotencyKey");

ALTER TABLE "StoreExtraIncome"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "StoreExtraIncome_idempotencyKey_key"
ON "StoreExtraIncome"("idempotencyKey");

ALTER TABLE "PavilionExpense"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PavilionExpense_idempotencyKey_key"
ON "PavilionExpense"("idempotencyKey");

ALTER TABLE "StoreStaff"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "StoreStaff_idempotencyKey_key"
ON "StoreStaff"("idempotencyKey");
