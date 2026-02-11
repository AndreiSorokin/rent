-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_pavilionId_fkey";

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_pavilionId_fkey"
FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
