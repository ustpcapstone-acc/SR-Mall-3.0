-- Staff roles (RBAC for the staff portal).
-- "ADMIN" stays the account type for everyone who signs in at /staff-portal.
-- Exactly one of them is the superuser; everyone else is staff and gets
-- access through a StaffRole (a list of permission keys, see lib/permissions.ts).

CREATE TABLE IF NOT EXISTS "StaffRole" (
    "id"          TEXT PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffRole_name_key" ON "StaffRole" ("name");

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "staffRoleId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_staffRoleId_fkey"
    FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "User_staffRoleId_idx" ON "User" ("staffRoleId");

-- The database itself allows only one superuser.
CREATE UNIQUE INDEX IF NOT EXISTS "User_single_superuser" ON "User" ("isSuperuser") WHERE "isSuperuser" = true;

-- Built-in role with every section, for existing admin accounts.
INSERT INTO "StaffRole" ("id", "name", "description", "permissions")
VALUES ('role_full_access', 'Full Access', 'Every section of the staff portal.',
        ARRAY['dashboard','bookings','spaces','messages','complaints','tenant_monitoring','ads','users','cms','staff'])
ON CONFLICT ("id") DO NOTHING;

-- The oldest admin account becomes the superuser (only if none exists yet).
UPDATE "User" SET "isSuperuser" = true
WHERE "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "isSuperuser" = true);

-- Every other admin account becomes staff with full access.
UPDATE "User" SET "staffRoleId" = 'role_full_access'
WHERE "role" = 'ADMIN' AND "isSuperuser" = false AND "staffRoleId" IS NULL;
