-- The mall's GCash / Maya / bank QR codes shown to tenants, and who changed them
-- (shape in apps/web/src/lib/qr-payments.ts). Additive only.
ALTER TABLE "LeaseSettings"
  ADD COLUMN IF NOT EXISTS "qrPayments" JSONB;
