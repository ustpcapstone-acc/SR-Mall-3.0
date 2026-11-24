-- Tenant onboarding ("Become a Tenant"): company details and uploaded
-- business documents. All additive; existing tenants keep NULL / [].
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "businessAddress" TEXT,
  -- [{ "type": "DTI_SEC", "name": "...", "url": "...", "key": "...", "mime": "...", "size": 123 }]
  ADD COLUMN IF NOT EXISTS "documents" JSONB NOT NULL DEFAULT '[]';
