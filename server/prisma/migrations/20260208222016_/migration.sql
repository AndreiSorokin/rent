-- DropForeignKey
ALTER TABLE "AdditionalCharge" DROP CONSTRAINT "AdditionalCharge_pavilionId_fkey";

-- AddForeignKey
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
