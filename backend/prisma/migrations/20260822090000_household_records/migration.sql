CREATE TABLE "HouseholdMember" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdVehicle" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "make" TEXT,
  "model" TEXT,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdVehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdPet" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "species" TEXT NOT NULL,
  "breed" TEXT,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdPet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HouseholdMember_unitId_idx" ON "HouseholdMember"("unitId");
CREATE INDEX "HouseholdVehicle_unitId_idx" ON "HouseholdVehicle"("unitId");
CREATE UNIQUE INDEX "HouseholdVehicle_unitId_registrationNumber_key" ON "HouseholdVehicle"("unitId", "registrationNumber");
CREATE INDEX "HouseholdPet_unitId_idx" ON "HouseholdPet"("unitId");

ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdVehicle" ADD CONSTRAINT "HouseholdVehicle_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdVehicle" ADD CONSTRAINT "HouseholdVehicle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdPet" ADD CONSTRAINT "HouseholdPet_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdPet" ADD CONSTRAINT "HouseholdPet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
