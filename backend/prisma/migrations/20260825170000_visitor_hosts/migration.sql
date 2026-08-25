ALTER TABLE "Visitor"
  ADD COLUMN IF NOT EXISTS "hostUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Visitor_hostUserId_idx"
  ON "Visitor" ("hostUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Visitor_hostUserId_fkey'
  ) THEN
    ALTER TABLE "Visitor"
      ADD CONSTRAINT "Visitor_hostUserId_fkey"
      FOREIGN KEY ("hostUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
