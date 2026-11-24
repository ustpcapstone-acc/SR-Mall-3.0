-- Tenant staff (Phase 5): roles and staff accounts per rented space.
-- Staff accounts are User rows with role 'TENANT_STAFF' that sign in at
-- /tenant-portal and only see the one space they were added to.

CREATE TABLE IF NOT EXISTS "SpaceRole" (
  "id"          TEXT PRIMARY KEY,
  "leaseId"     TEXT NOT NULL REFERENCES "Lease"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpaceRole_leaseId_name_key" ON "SpaceRole"("leaseId", "name");

CREATE TABLE IF NOT EXISTS "SpaceStaff" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "tenantId"  TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "leaseId"   TEXT NOT NULL REFERENCES "Lease"("id") ON DELETE CASCADE,
  "roleId"    TEXT NOT NULL REFERENCES "SpaceRole"("id") ON DELETE RESTRICT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SpaceStaff_leaseId_idx" ON "SpaceStaff"("leaseId");
CREATE INDEX IF NOT EXISTS "SpaceStaff_tenantId_idx" ON "SpaceStaff"("tenantId");
