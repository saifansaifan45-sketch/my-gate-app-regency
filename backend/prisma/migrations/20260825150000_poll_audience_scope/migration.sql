CREATE TYPE "PollAudience" AS ENUM ('HOUSEHOLD', 'LEADERSHIP', 'OWNERS', 'RESIDENTS');

ALTER TABLE "Poll"
  ADD COLUMN "audience" "PollAudience" NOT NULL DEFAULT 'RESIDENTS',
  ADD COLUMN "unitId" TEXT;

UPDATE "Poll" AS poll
SET "audience" = CASE space."type"
  WHEN 'LEADERSHIP_OPERATIONS' THEN 'LEADERSHIP'::"PollAudience"
  WHEN 'OWNER_COMMUNITY' THEN 'OWNERS'::"PollAudience"
  ELSE 'RESIDENTS'::"PollAudience"
END
FROM "Space" AS space
WHERE poll."spaceId" = space."id";

CREATE INDEX "Poll_unitId_idx" ON "Poll"("unitId");

ALTER TABLE "Poll"
  ADD CONSTRAINT "Poll_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
