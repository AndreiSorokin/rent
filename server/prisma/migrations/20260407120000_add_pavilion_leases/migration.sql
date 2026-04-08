-- CreateEnum
CREATE TYPE "PavilionLeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaseContractKind" AS ENUM ('MAIN', 'ADDENDUM', 'RENEWAL', 'TERMINATION', 'OTHER');

-- CreateTable
CREATE TABLE "PavilionLease" (
    "id" SERIAL NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "tenantName" TEXT NOT NULL,
    "status" "PavilionLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsOn" TEXT,
    "endsOn" TEXT,
    "vacatedOn" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PavilionLease_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Contract"
    ADD COLUMN "kind" "LeaseContractKind" NOT NULL DEFAULT 'MAIN',
    ADD COLUMN "signedOn" TEXT,
    ADD COLUMN "pavilionLeaseId" INTEGER,
    ALTER COLUMN "pavilionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PavilionLease_pavilionId_createdAt_idx" ON "PavilionLease"("pavilionId", "createdAt");

-- CreateIndex
CREATE INDEX "PavilionLease_pavilionId_status_createdAt_idx" ON "PavilionLease"("pavilionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_pavilionLeaseId_uploadedAt_idx" ON "Contract"("pavilionLeaseId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Contract_pavilionId_uploadedAt_idx" ON "Contract"("pavilionId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "PavilionLease"
    ADD CONSTRAINT "PavilionLease_pavilionId_fkey"
    FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_pavilionLeaseId_fkey"
    FOREIGN KEY ("pavilionLeaseId") REFERENCES "PavilionLease"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed one initial lease per pavilion that already has a tenant or contracts
INSERT INTO "PavilionLease" (
    "pavilionId",
    "tenantName",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    p."id",
    COALESCE(NULLIF(BTRIM(p."tenantName"), ''), 'Не указан'),
    CASE
        WHEN p."status" IN ('RENTED', 'PREPAID') THEN 'ACTIVE'::"PavilionLeaseStatus"
        ELSE 'ENDED'::"PavilionLeaseStatus"
    END,
    COALESCE(MIN(c."uploadedAt"), CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "Pavilion" p
LEFT JOIN "Contract" c ON c."pavilionId" = p."id"
WHERE p."tenantName" IS NOT NULL
   OR EXISTS (
        SELECT 1
        FROM "Contract" c2
        WHERE c2."pavilionId" = p."id"
   )
GROUP BY p."id", p."tenantName", p."status";

-- Attach existing contracts to the seeded lease
UPDATE "Contract" c
SET "pavilionLeaseId" = pl."id"
FROM "PavilionLease" pl
WHERE c."pavilionId" = pl."pavilionId"
  AND c."pavilionLeaseId" IS NULL;
