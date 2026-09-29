-- Opening hours shown in the public footer (CMS → General Settings → Footer).
ALTER TABLE "PublicViewConfig" ADD COLUMN IF NOT EXISTS "footerOpeningHours" TEXT;
