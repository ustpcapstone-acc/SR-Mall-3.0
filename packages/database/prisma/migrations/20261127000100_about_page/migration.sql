-- About Us page: its extra content and section visibility. Additive only.
ALTER TABLE "PublicViewConfig"
  ADD COLUMN IF NOT EXISTS "aboutPage" JSONB;
