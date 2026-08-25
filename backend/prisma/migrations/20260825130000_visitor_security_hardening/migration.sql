ALTER TABLE "Visitor"
  ADD COLUMN IF NOT EXISTS "handoffSuggestionType" TEXT,
  ADD COLUMN IF NOT EXISTS "handoffSuggestionName" TEXT,
  ADD COLUMN IF NOT EXISTS "otpFailedAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Visitor_status_validUntil_idx"
  ON "Visitor" ("status", "validUntil");
