CREATE TABLE "StoreStaff" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreStaff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreStaff_storeId_createdAt_idx"
ON "StoreStaff"("storeId", "createdAt");

ALTER TABLE "StoreStaff"
ADD CONSTRAINT "StoreStaff_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
