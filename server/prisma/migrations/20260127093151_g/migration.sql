/*
  Warnings:

  - A unique constraint covering the columns `[pavilionId,period]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_pavilionId_period_key" ON "Payment"("pavilionId", "period");
