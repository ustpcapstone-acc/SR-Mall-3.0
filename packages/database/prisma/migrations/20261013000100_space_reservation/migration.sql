-- Space reservation requests: the applicant's business permit and the admin's
-- decision + comment. The unit's own status still lives on "AreaSlot".
CREATE TABLE IF NOT EXISTS "SpaceReservation" (
    "id"           TEXT PRIMARY KEY,
    "unitId"       TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "permitUrl"    TEXT,
    "permitName"   TEXT,
    "permitType"   TEXT,
    "permitSize"   INTEGER,
    "status"       TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | EXPIRED
    "adminComment" TEXT,
    "decidedById"  TEXT,
    "decidedAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SpaceReservation_unitId_status_idx" ON "SpaceReservation" ("unitId", "status");
CREATE INDEX IF NOT EXISTS "SpaceReservation_userId_idx" ON "SpaceReservation" ("userId");

-- Private Cloudinary id ("cloudinary:<type>:<public_id>") so admins get short-lived signed links.
ALTER TABLE "SpaceReservation" ADD COLUMN IF NOT EXISTS "permitKey" TEXT;
