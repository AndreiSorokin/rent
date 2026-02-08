-- CreateTable
CREATE TABLE "PavilionDiscount" (
    "id" SERIAL NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PavilionDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PavilionDiscount_pavilionId_startsAt_endsAt_idx" ON "PavilionDiscount"("pavilionId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "PavilionDiscount" ADD CONSTRAINT "PavilionDiscount_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
