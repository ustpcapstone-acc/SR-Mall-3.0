-- Tenant History: a permanent snapshot taken whenever a tenant leaves
-- (removed by admin, changed to customer, marked as past). It survives the
-- tenant record being deleted or overwritten by a new application.
CREATE TABLE IF NOT EXISTS "TenantHistory" (
  "id"           TEXT PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  "userId"       TEXT,
  "shopName"     TEXT NOT NULL,
  "ownerName"    TEXT,
  "ownerEmail"   TEXT,
  "unitId"       TEXT,
  "floor"        TEXT,
  "category"     TEXT,
  "logoUrl"      TEXT,
  "leaseStart"   TIMESTAMP(3) NOT NULL,
  "endedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"       TEXT NOT NULL,
  "note"         TEXT,
  "totalPaid"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "outstanding"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invoiceCount" INTEGER NOT NULL DEFAULT 0,
  "avgRating"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewCount"  INTEGER NOT NULL DEFAULT 0,
  "endedById"    TEXT,
  "endedByName"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TenantHistory_endedAt_idx" ON "TenantHistory" ("endedAt");
CREATE INDEX IF NOT EXISTS "TenantHistory_tenantId_idx" ON "TenantHistory" ("tenantId");

-- Backfill tenants that are already PAST (so nothing already shown is lost).
INSERT INTO "TenantHistory" ("id", "tenantId", "userId", "shopName", "ownerName", "ownerEmail", "unitId", "category",
                             "logoUrl", "leaseStart", "endedAt", "reason", "totalPaid", "outstanding", "invoiceCount")
SELECT gen_random_uuid()::text, t."id", t."userId", t."shopName", u."name", u."email",
       NULLIF(NULLIF(t."unitId", 'UNASSIGNED'), 'PENDING_ASSIGNMENT'), t."category", t."logoUrl",
       t."createdAt", t."updatedAt", 'MARKED_PAST',
       COALESCE((SELECT SUM(i."amount") FROM "Invoice" i WHERE i."tenantId" = t."id" AND i."status" IN ('PAID', 'PAST')), 0),
       COALESCE((SELECT SUM(i."amount") FROM "Invoice" i WHERE i."tenantId" = t."id" AND i."status" NOT IN ('PAID', 'PAST', 'REJECTED')), 0),
       (SELECT COUNT(*) FROM "Invoice" i WHERE i."tenantId" = t."id")
  FROM "Tenant" t
  LEFT JOIN "User" u ON u."id" = t."userId"
 WHERE t."status" = 'PAST'
   AND NOT EXISTS (SELECT 1 FROM "TenantHistory" h WHERE h."tenantId" = t."id");
