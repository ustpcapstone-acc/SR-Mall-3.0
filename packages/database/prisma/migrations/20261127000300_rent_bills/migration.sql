-- Monthly rent bills: drafts the system prepares for the accountant to review.
-- Additive only. Tenants see nothing until a draft is sent as an invoice.
CREATE TABLE IF NOT EXISTS "RentDraft" (
  "id" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  -- PENDING, SENT or SKIPPED
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "invoiceId" TEXT,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentDraft_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One draft per lease and period, even if the daily job runs twice.
CREATE UNIQUE INDEX IF NOT EXISTS "RentDraft_leaseId_periodStart_key" ON "RentDraft" ("leaseId", "periodStart");
CREATE INDEX IF NOT EXISTS "RentDraft_status_idx" ON "RentDraft" ("status");

-- Only the app's own database connection may touch it.
ALTER TABLE "RentDraft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RentDraft" FROM anon, authenticated;

-- How many days before the due date a draft is prepared.
ALTER TABLE "LeaseSettings"
  ADD COLUMN IF NOT EXISTS "billDaysBefore" INTEGER NOT NULL DEFAULT 10;
