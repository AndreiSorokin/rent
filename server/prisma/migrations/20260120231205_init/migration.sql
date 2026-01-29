/*
  Warnings:

  - The values [STAFF] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "PavilionStatus" AS ENUM ('AVAILABLE', 'RENTED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "storeId" INTEGER,
ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalCharge" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdditionalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalChargePayment" (
    "id" SERIAL NOT NULL,
    "additionalChargeId" INTEGER NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdditionalChargePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pavilion" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "squareMeters" DOUBLE PRECISION NOT NULL,
    "pricePerSqM" DOUBLE PRECISION NOT NULL,
    "status" "PavilionStatus" NOT NULL DEFAULT 'AVAILABLE',
    "tenantName" TEXT,
    "rentAmount" DOUBLE PRECISION,
    "utilitiesAmount" DOUBLE PRECISION,
    "storeId" INTEGER NOT NULL,

    CONSTRAINT "Pavilion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "rentPaid" DOUBLE PRECISION,
    "utilitiesPaid" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalChargePayment" ADD CONSTRAINT "AdditionalChargePayment_additionalChargeId_fkey" FOREIGN KEY ("additionalChargeId") REFERENCES "AdditionalCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pavilion" ADD CONSTRAINT "Pavilion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
