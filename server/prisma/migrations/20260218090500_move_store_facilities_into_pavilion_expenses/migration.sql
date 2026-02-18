INSERT INTO "PavilionExpense" ("type", "status", "amount", "note", "storeId", "pavilionId", "createdAt")
SELECT
  'STORE_FACILITIES'::"PavilionExpenseType",
  "status",
  "amount",
  COALESCE(NULLIF("name", ''), 'Store facilities'),
  "storeId",
  NULL,
  "createdAt"
FROM "StoreFacility";

DROP TABLE "StoreFacility";
