-- AlterEnum
ALTER TYPE "PavilionExpenseType" ADD VALUE 'OTHER';

-- CreateEnum
CREATE TYPE "PavilionExpenseStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "PavilionExpense"
ADD COLUMN "status" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID';
