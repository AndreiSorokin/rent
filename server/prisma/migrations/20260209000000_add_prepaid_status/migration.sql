-- AlterEnum
ALTER TYPE "PavilionStatus" ADD VALUE 'PREPAID';

-- AlterTable
ALTER TABLE "Pavilion" ADD COLUMN "prepaidUntil" TIMESTAMP(3);
