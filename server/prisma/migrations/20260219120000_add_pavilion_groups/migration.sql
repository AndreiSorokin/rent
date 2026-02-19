-- CreateTable
CREATE TABLE "PavilionGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PavilionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PavilionGroupMembership" (
    "groupId" INTEGER NOT NULL,
    "pavilionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PavilionGroupMembership_pkey" PRIMARY KEY ("groupId","pavilionId")
);

-- CreateIndex
CREATE INDEX "PavilionGroup_storeId_createdAt_idx" ON "PavilionGroup"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PavilionGroup_storeId_name_key" ON "PavilionGroup"("storeId", "name");

-- CreateIndex
CREATE INDEX "PavilionGroupMembership_pavilionId_createdAt_idx" ON "PavilionGroupMembership"("pavilionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PavilionGroup" ADD CONSTRAINT "PavilionGroup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PavilionGroupMembership" ADD CONSTRAINT "PavilionGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PavilionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PavilionGroupMembership" ADD CONSTRAINT "PavilionGroupMembership_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
