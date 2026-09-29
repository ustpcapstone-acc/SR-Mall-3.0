-- Tenant replies to reviews, and tenant reports sent to the admin moderation queue.
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reply" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reportReason" TEXT;

CREATE INDEX IF NOT EXISTS "Review_tenantId_createdAt_idx" ON "Review"("tenantId", "createdAt");
