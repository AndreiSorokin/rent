-- DropForeignKey
ALTER TABLE "AdditionalChargePayment" DROP CONSTRAINT "AdditionalChargePayment_additionalChargeId_fkey";

-- AddForeignKey
ALTER TABLE "AdditionalChargePayment" ADD CONSTRAINT "AdditionalChargePayment_additionalChargeId_fkey" FOREIGN KEY ("additionalChargeId") REFERENCES "AdditionalCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
