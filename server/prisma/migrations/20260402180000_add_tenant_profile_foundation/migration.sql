CREATE TYPE "TenantProfileType" AS ENUM ('INDIVIDUAL');

CREATE TYPE "TenantOrganizationType" AS ENUM ('IE', 'LLC');

CREATE TYPE "TenantLeaseStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TYPE "TenantApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "TenantProfile" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" "TenantProfileType" NOT NULL DEFAULT 'INDIVIDUAL',
  "fullName" TEXT,
  "phone" TEXT,
  "requisites" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantOrganization" (
  "id" SERIAL NOT NULL,
  "tenantProfileId" INTEGER NOT NULL,
  "type" "TenantOrganizationType" NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "registrationNumber" TEXT,
  "legalAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantOrganization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantPavilionLease" (
  "id" SERIAL NOT NULL,
  "tenantProfileId" INTEGER NOT NULL,
  "pavilionId" INTEGER NOT NULL,
  "status" "TenantLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantPavilionLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantPavilionApplication" (
  "id" SERIAL NOT NULL,
  "tenantProfileId" INTEGER NOT NULL,
  "storeId" INTEGER,
  "pavilionId" INTEGER,
  "status" "TenantApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "TenantPavilionApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantProfile_userId_key" ON "TenantProfile"("userId");
CREATE INDEX "TenantOrganization_tenantProfileId_createdAt_idx" ON "TenantOrganization"("tenantProfileId", "createdAt");
CREATE INDEX "TenantPavilionLease_tenantProfileId_status_startedAt_idx" ON "TenantPavilionLease"("tenantProfileId", "status", "startedAt");
CREATE INDEX "TenantPavilionLease_pavilionId_status_startedAt_idx" ON "TenantPavilionLease"("pavilionId", "status", "startedAt");
CREATE INDEX "TenantPavilionApplication_tenantProfileId_createdAt_idx" ON "TenantPavilionApplication"("tenantProfileId", "createdAt");
CREATE INDEX "TenantPavilionApplication_storeId_createdAt_idx" ON "TenantPavilionApplication"("storeId", "createdAt");
CREATE INDEX "TenantPavilionApplication_pavilionId_createdAt_idx" ON "TenantPavilionApplication"("pavilionId", "createdAt");

ALTER TABLE "TenantProfile"
ADD CONSTRAINT "TenantProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantOrganization"
ADD CONSTRAINT "TenantOrganization_tenantProfileId_fkey"
FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantPavilionLease"
ADD CONSTRAINT "TenantPavilionLease_tenantProfileId_fkey"
FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantPavilionLease"
ADD CONSTRAINT "TenantPavilionLease_pavilionId_fkey"
FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantPavilionApplication"
ADD CONSTRAINT "TenantPavilionApplication_tenantProfileId_fkey"
FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantPavilionApplication"
ADD CONSTRAINT "TenantPavilionApplication_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantPavilionApplication"
ADD CONSTRAINT "TenantPavilionApplication_pavilionId_fkey"
FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
