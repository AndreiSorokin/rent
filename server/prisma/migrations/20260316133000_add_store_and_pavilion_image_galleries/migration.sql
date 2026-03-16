CREATE TABLE "StoreImage" (
  "id" SERIAL NOT NULL,
  "storeId" INTEGER NOT NULL,
  "filePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreImage_storeId_createdAt_idx" ON "StoreImage"("storeId", "createdAt");

ALTER TABLE "StoreImage"
ADD CONSTRAINT "StoreImage_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PavilionImage" (
  "id" SERIAL NOT NULL,
  "pavilionId" INTEGER NOT NULL,
  "filePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PavilionImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PavilionImage_pavilionId_createdAt_idx" ON "PavilionImage"("pavilionId", "createdAt");

ALTER TABLE "PavilionImage"
ADD CONSTRAINT "PavilionImage_pavilionId_fkey"
FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StoreImage" ("storeId", "filePath", "createdAt")
SELECT "id", "imagePath", CURRENT_TIMESTAMP
FROM "Store"
WHERE "imagePath" IS NOT NULL;

INSERT INTO "PavilionImage" ("pavilionId", "filePath", "createdAt")
SELECT "id", "imagePath", CURRENT_TIMESTAMP
FROM "Pavilion"
WHERE "imagePath" IS NOT NULL;
