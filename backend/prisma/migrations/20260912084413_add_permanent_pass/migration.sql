-- CreateTable
CREATE TABLE "PermanentPass" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "vehicleNumber" TEXT,
    "purpose" TEXT DEFAULT 'Family member access',
    "householdMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermanentPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermanentPass_unitId_idx" ON "PermanentPass"("unitId");

-- CreateIndex
CREATE INDEX "PermanentPass_communityId_idx" ON "PermanentPass"("communityId");

-- CreateIndex
CREATE INDEX "PermanentPass_status_validUntil_idx" ON "PermanentPass"("status", "validUntil");

-- AddForeignKey
ALTER TABLE "PermanentPass" ADD CONSTRAINT "PermanentPass_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermanentPass" ADD CONSTRAINT "PermanentPass_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermanentPass" ADD CONSTRAINT "PermanentPass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
