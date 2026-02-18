CREATE TABLE "StoreFacility" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFacility_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreFacility_storeId_createdAt_idx"
ON "StoreFacility"("storeId", "createdAt");

ALTER TABLE "StoreFacility"
ADD CONSTRAINT "StoreFacility_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
