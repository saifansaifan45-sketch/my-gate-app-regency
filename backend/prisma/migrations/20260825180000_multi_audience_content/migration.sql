ALTER TABLE "Poll"
  ADD COLUMN IF NOT EXISTS "audiences" "PollAudience"[] NOT NULL DEFAULT ARRAY['RESIDENTS'::"PollAudience"];

UPDATE "Poll"
SET "audiences" = ARRAY["audience"]
WHERE cardinality("audiences") = 0 OR "audiences" IS NULL;
