-- Preserve the staff classification selected during onboarding until a manager
-- approves the workforce application. These columns are nullable so existing
-- memberships remain valid and legacy records can be migrated safely.
ALTER TABLE "Membership"
  ADD COLUMN IF NOT EXISTS "requestedCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedDepartment" TEXT;
