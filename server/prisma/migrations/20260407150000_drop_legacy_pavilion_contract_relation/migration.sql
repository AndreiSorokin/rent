-- Ensure every contract is attached to a lease before removing legacy relation
DELETE FROM "Contract"
WHERE "pavilionLeaseId" IS NULL;

-- Drop old legacy foreign key and index
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_pavilionId_fkey";
DROP INDEX IF EXISTS "Contract_pavilionId_uploadedAt_idx";

-- Make lease relation required
ALTER TABLE "Contract"
    ALTER COLUMN "pavilionLeaseId" SET NOT NULL;

-- Drop old pavilion relation column
ALTER TABLE "Contract"
    DROP COLUMN IF EXISTS "pavilionId";
