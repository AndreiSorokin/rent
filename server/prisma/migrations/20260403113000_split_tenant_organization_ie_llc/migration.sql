ALTER TABLE "TenantOrganization"
DROP COLUMN "name",
DROP COLUMN "taxId",
DROP COLUMN "registrationNumber",
DROP COLUMN "legalAddress";

CREATE TABLE "TenantOrganizationIE" (
  "id" SERIAL NOT NULL,
  "tenantOrganizationId" INTEGER NOT NULL,
  "fullName" TEXT NOT NULL,
  "inn" TEXT,
  "ogrnip" TEXT,
  "legalAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantOrganizationIE_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantOrganizationLLC" (
  "id" SERIAL NOT NULL,
  "tenantOrganizationId" INTEGER NOT NULL,
  "companyName" TEXT NOT NULL,
  "inn" TEXT,
  "kpp" TEXT,
  "ogrn" TEXT,
  "legalAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantOrganizationLLC_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantOrganizationIE_tenantOrganizationId_key" ON "TenantOrganizationIE"("tenantOrganizationId");
CREATE UNIQUE INDEX "TenantOrganizationLLC_tenantOrganizationId_key" ON "TenantOrganizationLLC"("tenantOrganizationId");

ALTER TABLE "TenantOrganizationIE"
ADD CONSTRAINT "TenantOrganizationIE_tenantOrganizationId_fkey"
FOREIGN KEY ("tenantOrganizationId") REFERENCES "TenantOrganization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantOrganizationLLC"
ADD CONSTRAINT "TenantOrganizationLLC_tenantOrganizationId_fkey"
FOREIGN KEY ("tenantOrganizationId") REFERENCES "TenantOrganization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
