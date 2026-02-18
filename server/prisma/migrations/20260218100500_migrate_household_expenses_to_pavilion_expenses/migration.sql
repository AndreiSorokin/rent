INSERT INTO "PavilionExpense" ("type", "status", "amount", "note", "storeId", "pavilionId", "createdAt")
SELECT
  'HOUSEHOLD'::"PavilionExpenseType",
  "status",
  "amount",
  COALESCE(NULLIF("name", ''), 'Household expense'),
  "storeId",
  "pavilionId",
  "createdAt"
FROM "HouseholdExpense";
