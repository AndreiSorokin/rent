-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RUB', 'KZT');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'RUB';
