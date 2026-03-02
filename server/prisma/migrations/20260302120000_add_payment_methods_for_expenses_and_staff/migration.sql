DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASHBOX1', 'CASHBOX2');
  END IF;
END $$;

ALTER TABLE "PavilionExpense"
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";

ALTER TABLE "StoreStaff"
  ADD COLUMN IF NOT EXISTS "salaryPaymentMethod" "PaymentMethod";
