-- Tenant complaints: a ticket per complaint with a comment thread between the
-- tenant and the mall admin.
CREATE TABLE IF NOT EXISTS "Complaint" (
  "id"                    TEXT PRIMARY KEY,
  "tenantId"              TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId"                TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "category"              TEXT NOT NULL,
  "subject"               TEXT NOT NULL,
  "details"               TEXT NOT NULL,
  "priority"              TEXT NOT NULL DEFAULT 'NORMAL',  -- LOW | NORMAL | URGENT
  "status"                TEXT NOT NULL DEFAULT 'NEW',     -- NEW | IN_PROGRESS | RESOLVED | CLOSED
  "photos"                TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"            TIMESTAMP(3),
  -- Unread tracking: last thing each side did vs. when each side last looked.
  "lastTenantActivityAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAdminActivityAt"   TIMESTAMP(3),
  "tenantReadAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adminReadAt"           TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Complaint_tenantId_idx" ON "Complaint"("tenantId");
CREATE INDEX IF NOT EXISTS "Complaint_status_idx" ON "Complaint"("status");

CREATE TABLE IF NOT EXISTS "ComplaintComment" (
  "id"          TEXT PRIMARY KEY,
  "complaintId" TEXT NOT NULL REFERENCES "Complaint"("id") ON DELETE CASCADE,
  "authorId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "authorRole"  TEXT NOT NULL,                 -- TENANT | ADMIN | SYSTEM
  "authorName"  TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "photoUrl"    TEXT,
  "isInternal"  BOOLEAN NOT NULL DEFAULT false, -- admin-only note
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ComplaintComment_complaintId_idx" ON "ComplaintComment"("complaintId");
