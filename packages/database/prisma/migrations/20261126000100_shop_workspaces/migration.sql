-- Tenants choose, per rented unit, whether it shares a shop or runs its own.
-- Everything here is additive: empty columns mean "the tenant's main shop"
-- (or, for notifications, "the whole account"), so existing records keep
-- showing exactly where they do today.

-- Which shop a unit belongs to (empty: the main shop).
ALTER TABLE "Lease"
  ADD COLUMN IF NOT EXISTS "shopId" TEXT REFERENCES "UnitShop"("id") ON DELETE SET NULL;

-- A shop can now hold several units, so it is no longer tied to exactly one.
DROP INDEX IF EXISTS "UnitShop_tenantId_unitId_key";
ALTER TABLE "UnitShop" ALTER COLUMN "unitId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "UnitShop_tenantId_idx" ON "UnitShop"("tenantId");

-- Shop-specific records.
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "shopId" TEXT REFERENCES "UnitShop"("id") ON DELETE CASCADE;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "shopId" TEXT REFERENCES "UnitShop"("id") ON DELETE CASCADE;
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "shopId" TEXT,
  ADD COLUMN IF NOT EXISTS "unitId" TEXT;
-- Complaints belong to the unit they are about.
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

-- Favourites of the extra shops (the main shop keeps using "Favorite").
CREATE TABLE IF NOT EXISTS "ShopFavorite" (
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "shopId"    TEXT NOT NULL REFERENCES "UnitShop"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "shopId")
);
ALTER TABLE "ShopFavorite" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "Review_shopId_idx" ON "Review"("shopId");
CREATE INDEX IF NOT EXISTS "Conversation_shopId_idx" ON "Conversation"("shopId");
CREATE INDEX IF NOT EXISTS "Notification_userId_shopId_idx" ON "Notification"("userId", "shopId");
CREATE INDEX IF NOT EXISTS "Complaint_unitId_idx" ON "Complaint"("unitId");
