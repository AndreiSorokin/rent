-- AlterTable
ALTER TABLE "HouseholdExpense" ADD COLUMN     "status" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "householdExpenseStatus" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "utilitiesExpenseStatus" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "StoreStaff" ADD COLUMN     "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salaryStatus" "PavilionExpenseStatus" NOT NULL DEFAULT 'UNPAID';
