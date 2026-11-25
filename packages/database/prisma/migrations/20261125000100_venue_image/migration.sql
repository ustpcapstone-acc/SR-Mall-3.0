-- Photo for the homepage "Plan your next big day" (venue booking) section,
-- uploaded in CMS → General Settings → Homepage section text. Both nullable:
-- when empty the section keeps its built-in image and description.
ALTER TABLE "PublicViewConfig"
  ADD COLUMN IF NOT EXISTS "venueImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "venueImageAlt" TEXT;
