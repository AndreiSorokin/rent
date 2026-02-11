-- Add aggregated payment channels
ALTER TABLE "Payment"
ADD COLUMN "bankTransferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "cashbox1Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "cashbox2Paid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add payment transaction log for view/delete of individual payment records
CREATE TABLE "PaymentTransaction" (
    "id" SERIAL NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "period" TIMESTAMP(3) NOT NULL,
    "rentPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilitiesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankTransferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox1Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbox2Paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentTransaction_pavilionId_period_createdAt_idx"
ON "PaymentTransaction"("pavilionId", "period", "createdAt");

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_pavilionId_fkey"
FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
