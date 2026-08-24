-- Extend the existing space-backed announcement model into a first-class,
-- community-scoped announcement module without discarding existing notices.
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT', 'EMERGENCY');
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Announcement"
  ADD COLUMN "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "communityId" TEXT,
  ADD COLUMN "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT';

-- Existing announcements are linked to a Space, which is already linked to a Community.
UPDATE "Announcement" AS announcement
SET "communityId" = space."communityId",
    "status" = 'PUBLISHED'
FROM "Space" AS space
WHERE announcement."spaceId" = space."id";

ALTER TABLE "Announcement"
  ALTER COLUMN "communityId" SET NOT NULL;

CREATE TABLE "AnnouncementRead" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnnouncementRead_userId_readAt_idx" ON "AnnouncementRead"("userId", "readAt");
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");
CREATE INDEX "Announcement_communityId_status_createdAt_idx" ON "Announcement"("communityId", "status", "createdAt");

ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnnouncementRead"
  ADD CONSTRAINT "AnnouncementRead_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AnnouncementRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
