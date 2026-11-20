-- Editable homepage section text (CMS → General Settings → Homepage section text).
-- All columns are nullable so the public page keeps its built-in fallback copy.
ALTER TABLE "PublicViewConfig"
  ADD COLUMN IF NOT EXISTS "productsTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "productsDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "videoCtaLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "directoryTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "directoryDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "spacesTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "spacesDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "venueEyebrow" TEXT,
  ADD COLUMN IF NOT EXISTS "venueTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "venueDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewsTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewsDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "locationTitle" TEXT;
