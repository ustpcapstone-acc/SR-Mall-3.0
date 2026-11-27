-- Who recorded, approved, rejected or voided each payment. Additive only.
-- The app only ever adds rows. There is no link to Invoice or Tenant on
-- purpose: the history stays even after a tenant is deleted.
CREATE TABLE IF NOT EXISTS "PaymentLog" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "shopName" TEXT,
  -- RECORDED, SLIP_APPROVED, SLIP_REJECTED or VOIDED
  "action" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT,
  "referenceNo" TEXT,
  "paidOn" TIMESTAMP(3),
  "reason" TEXT,
  "slipUrl" TEXT,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentLog_invoiceId_createdAt_idx" ON "PaymentLog" ("invoiceId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentLog_tenantId_createdAt_idx" ON "PaymentLog" ("tenantId", "createdAt");

-- Only the app's own database connection may touch it.
ALTER TABLE "PaymentLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PaymentLog" FROM anon, authenticated;
