-- CreateTable
CREATE TABLE "StoreActivity" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "pavilionId" INTEGER,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreActivity_storeId_createdAt_idx" ON "StoreActivity"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreActivity_pavilionId_createdAt_idx" ON "StoreActivity"("pavilionId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreActivity_userId_createdAt_idx" ON "StoreActivity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreActivity" ADD CONSTRAINT "StoreActivity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreActivity" ADD CONSTRAINT "StoreActivity_pavilionId_fkey" FOREIGN KEY ("pavilionId") REFERENCES "Pavilion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreActivity" ADD CONSTRAINT "StoreActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
