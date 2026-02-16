-- AlterTable
ALTER TABLE "Pavilion" ADD COLUMN     "advertisingAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PavilionMonthlyLedger" ADD COLUMN     "expectedAdvertising" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "advertisingPaid" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "advertisingPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
