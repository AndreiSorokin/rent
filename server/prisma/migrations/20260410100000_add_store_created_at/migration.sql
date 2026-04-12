ALTER TABLE "Store"
ADD COLUMN "createdAt" TIMESTAMP(3);

UPDATE "Store"
SET "createdAt" = COALESCE(
  (
    SELECT MIN(su."createdAt")
    FROM "StoreUser" su
    WHERE su."storeId" = "Store"."id"
  ),
  NOW()
)
WHERE "createdAt" IS NULL;

ALTER TABLE "Store"
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT NOW();
