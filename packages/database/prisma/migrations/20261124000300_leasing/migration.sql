-- Leasing (Phase 4): leases per space, rent requests, e-invoice fields and
-- renewal settings. Idempotent and additive.

-- One row per space a tenant rents. endDate is the date rent is paid through,
-- which is also when the next renewal payment is due.
CREATE TABLE IF NOT EXISTS "Lease" (
  "id"          TEXT PRIMARY KEY,
  "tenantId"    TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "unitId"      TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "monthlyRent" DOUBLE PRECISION NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  -- Renewal notices already sent for the current endDate, e.g. "REMIND_7".
  "noticesSent" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "endedAt"     TIMESTAMP(3),
  "endReason"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX IF NOT EXISTS "Lease_status_endDate_idx" ON "Lease"("status", "endDate");
-- A space has at most one active lease.
CREATE UNIQUE INDEX IF NOT EXISTS "Lease_one_active_per_unit" ON "Lease"("unitId") WHERE "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "RentRequest" (
  "id"           TEXT PRIMARY KEY,
  "tenantId"     TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "unitId"       TEXT NOT NULL,
  "months"       INTEGER NOT NULL DEFAULT 12,
  "note"         TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "adminComment" TEXT,
  "decidedById"  TEXT,
  "decidedAt"    TIMESTAMP(3),
  "leaseId"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RentRequest_status_idx" ON "RentRequest"("status");
CREATE INDEX IF NOT EXISTS "RentRequest_tenantId_idx" ON "RentRequest"("tenantId");
-- One open request per tenant per space.
CREATE UNIQUE INDEX IF NOT EXISTS "RentRequest_one_pending" ON "RentRequest"("tenantId", "unitId") WHERE "status" = 'PENDING';

-- E-invoice details. Existing invoices keep NULL / [].
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "leaseId"       TEXT REFERENCES "Lease"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "unitId"        TEXT,
  ADD COLUMN IF NOT EXISTS "periodStart"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodEnd"     TIMESTAMP(3),
  -- [{ "description": "...", "quantity": 1, "unitPrice": 100, "amount": 100 }]
  ADD COLUMN IF NOT EXISTS "lineItems"     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_leaseId_idx" ON "Invoice"("leaseId");

-- Renewal settings (one row).
CREATE TABLE IF NOT EXISTS "LeaseSettings" (
  "id"                TEXT PRIMARY KEY DEFAULT 'singleton',
  "reminderDays"      INTEGER[] NOT NULL DEFAULT ARRAY[7, 1],
  "graceDays"         INTEGER NOT NULL DEFAULT 7,
  "finalWarningDays"  INTEGER NOT NULL DEFAULT 1,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "LeaseSettings" ("id") VALUES ('singleton') ON CONFLICT ("id") DO NOTHING;

-- Existing tenants: their current space becomes their first lease. The old rule
-- was a one-year term from the tenant record's creation; the end date rolls
-- forward by whole years so it is at least 30 days away (no one lands in a
-- grace period, or gets removed, because of this migration).
INSERT INTO "Lease" ("id", "tenantId", "unitId", "startDate", "endDate", "monthlyRent", "status")
SELECT DISTINCT ON (t."unitId") gen_random_uuid()::text, t."id", t."unitId", t."createdAt",
       t."createdAt" + make_interval(years => GREATEST(1,
         CEIL(EXTRACT(EPOCH FROM (NOW() + INTERVAL '30 days' - t."createdAt")) / 31557600.0)::int)),
       s."base_rent", 'ACTIVE'
FROM "Tenant" t
JOIN "AreaSlot" s ON s."unit_id" = t."unitId"
WHERE t."status" = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM "Lease" l WHERE l."unitId" = t."unitId" AND l."status" = 'ACTIVE')
  AND NOT EXISTS (SELECT 1 FROM "Lease" l WHERE l."tenantId" = t."id")
ORDER BY t."unitId", t."createdAt";

-- Full Access role gets the new Leasing section.
UPDATE "StaffRole" SET "permissions" = array_append("permissions", 'leasing')
WHERE "id" = 'role_full_access' AND NOT ('leasing' = ANY("permissions"));
