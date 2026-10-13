-- Chat & community platform consolidation (from feat/chat-and-community).
--
-- ADDITIVE ONLY. Preserves main's migration history:
-- - main's VisitorStatus enum is kept as-is; the branch's visitor-lifecycle
--   redesign (ACTIVE/PARTIALLY_ADMITTED/COMPLETED) is intentionally NOT applied.
-- - main's migration history (initial_schema, add_permanent_pass, add_party_size)
--   is retained; nothing is renamed, rebased, or deleted.
--
-- User.availabilityStatus conversion: main stored personnel-style values
-- (AVAILABLE/BUSY/OFF_DUTY/LEAVE) in the AvailabilityStatus enum. The resident
-- availability feature uses ResidentAvailabilityStatus (AVAILABLE/AWAY/HOLIDAY/
-- DO_NOT_DISTURB). Existing 'AVAILABLE' rows stay 'AVAILABLE'; any other value
-- maps to 'AWAY'. User.availabilityStatus was vestigial in main (only the
-- Personnel model value was read by backend code).

-- 1. Extend ResidencyType with CO_OWNER (additive enum value)
ALTER TYPE "ResidencyType" ADD VALUE IF NOT EXISTS 'CO_OWNER';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResidentAvailabilityStatus" AS ENUM ('AVAILABLE', 'AWAY', 'HOLIDAY', 'DO_NOT_DISTURB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChatChannelType" AS ENUM ('UNIT', 'OWNERS', 'LEADERSHIP_MANAGEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. New tables
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "role" "ResidencyType" NOT NULL DEFAULT 'TENANT',
  "unitId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invitation_token_key" UNIQUE ("token"),
  CONSTRAINT "Invitation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invitation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_email_unitId_status_key" ON "Invitation"("email", "unitId", "status");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX IF NOT EXISTS "Invitation_unitId_idx" ON "Invitation"("unitId");
CREATE INDEX IF NOT EXISTS "Invitation_invitedById_idx" ON "Invitation"("invitedById");

CREATE TABLE IF NOT EXISTS "AccessGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "revokedById" TEXT,
  "accessType" TEXT NOT NULL,
  "permissions" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccessGrant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccessGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AccessGrant_userId_unitId_status_idx" ON "AccessGrant" ("userId", "unitId", "status");
CREATE INDEX IF NOT EXISTS "AccessGrant_unitId_status_startsAt_endsAt_idx" ON "AccessGrant" ("unitId", "status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "AccessGrant_grantedById_idx" ON "AccessGrant" ("grantedById");

CREATE TABLE IF NOT EXISTS "TenantClauseAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "clauseId" TEXT NOT NULL,
  "clauseVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantClauseAcceptance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantClauseAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TenantClauseAcceptance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TenantClauseAcceptance_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantClauseAcceptance_userId_unitId_clauseId_clauseVersion_key"
  ON "TenantClauseAcceptance" ("userId", "unitId", "clauseId", "clauseVersion");
CREATE INDEX IF NOT EXISTS "TenantClauseAcceptance_unitId_userId_idx"
  ON "TenantClauseAcceptance" ("unitId", "userId");

CREATE TABLE IF NOT EXISTS "OwnershipTransfer" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "fromOwnerId" TEXT NOT NULL,
  "toOwnerId" TEXT NOT NULL,
  "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PROPOSED',
  "clauseId" TEXT NOT NULL,
  "clauseVersion" TEXT NOT NULL,
  "clauseText" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentReference" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnershipTransfer_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OwnershipTransfer_fromOwnerId_fkey" FOREIGN KEY ("fromOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OwnershipTransfer_toOwnerId_fkey" FOREIGN KEY ("toOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OwnershipTransfer_unitId_status_idx" ON "OwnershipTransfer"("unitId", "status");
CREATE INDEX IF NOT EXISTS "OwnershipTransfer_toOwnerId_status_idx" ON "OwnershipTransfer"("toOwnerId", "status");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "channelType" "ChatChannelType" NOT NULL,
  "channelId" TEXT NOT NULL,
  "unitId" TEXT,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatMessage_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatMessage_communityId_channelType_createdAt_idx" ON "ChatMessage"("communityId", "channelType", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- 4. Household record columns (restore/additive)
ALTER TABLE "HouseholdMember"
  ADD COLUMN IF NOT EXISTS "personType" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "HouseholdVehicle"
  ADD COLUMN IF NOT EXISTS "vehicleType" TEXT,
  ADD COLUMN IF NOT EXISTS "parkingCode" TEXT,
  ADD COLUMN IF NOT EXISTS "parkingSlot" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 5. Visitor columns needed by gate/visitor flows (partySize already added by add_party_size)
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "acknowledgedById" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "vehicleMake" TEXT;

-- 6. User columns: push token, availability window, resident availability status.
-- NOTE: some databases applied an earlier revision of initial_schema that did
-- not include User.availabilityStatus, so handle both cases: add the column
-- with the new type when missing, otherwise convert the legacy
-- AvailabilityStatus value (only User.availabilityStatus was vestigial in
-- main; the Personnel model value is what backend code reads).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "availabilityUntil" TIMESTAMP(3);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'availabilityStatus'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "availabilityStatus" "ResidentAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
  ELSE
    ALTER TABLE "User" ALTER COLUMN "availabilityStatus" TYPE "ResidentAvailabilityStatus" USING (
      CASE "availabilityStatus"::text WHEN 'AVAILABLE' THEN 'AVAILABLE' ELSE 'AWAY' END::text::"ResidentAvailabilityStatus"
    );
    ALTER TABLE "User" ALTER COLUMN "availabilityStatus" SET DEFAULT 'AVAILABLE';
  END IF;
END $$;
