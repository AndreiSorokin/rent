/*
  Warnings:

  - You are about to drop the `StoreExpense` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StoreExpense" DROP CONSTRAINT "StoreExpense_storeId_fkey";

-- DropTable
DROP TABLE "StoreExpense";

-- DropEnum
DROP TYPE "StoreExpenseType";
