-- CreateTable
CREATE TABLE "HouseholdExpense" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdExpense_pavilionId_createdAt_idx" ON "HouseholdExpense"("pavilionId", "createdAt");

-- AddForeignKey
ALTER TABLE "HouseholdExpense" ADD CONSTRAINT "HouseholdExpense_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
