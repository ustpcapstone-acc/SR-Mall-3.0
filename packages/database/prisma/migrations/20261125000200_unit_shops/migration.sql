-- One shop per rented unit. A tenant's main shop stays on the Tenant row (the
-- unit in Tenant."unitId"); every other unit they rent has its own row here
-- with its own name, details, products and sale posts. Reviews, favourites,
-- messages, complaints and billing stay with the tenant account.

CREATE TABLE IF NOT EXISTS "UnitShop" (
  "id"           TEXT PRIMARY KEY,
  "tenantId"     TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "unitId"       TEXT NOT NULL,
  "shopName"     TEXT NOT NULL DEFAULT '',
  "description"  TEXT,
  "logoUrl"      TEXT,
  "galleryUrls"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category"     TEXT NOT NULL DEFAULT 'Other',
  "phone"        TEXT,
  "openingHours" TEXT,
  "isOpen"       BOOLEAN NOT NULL DEFAULT true,
  "products"     JSONB NOT NULL DEFAULT '[]',
  "postSales"    JSONB NOT NULL DEFAULT '[]',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UnitShop_tenantId_unitId_key" ON "UnitShop"("tenantId", "unitId");

-- Only the server reads this table; keep Supabase's public API out of it.
ALTER TABLE "UnitShop" ENABLE ROW LEVEL SECURITY;

-- Which shop a promo belongs to (empty: the tenant's main shop).
ALTER TABLE "TenantPromo"
  ADD COLUMN IF NOT EXISTS "shopId" TEXT REFERENCES "UnitShop"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "TenantPromo_shopId_idx" ON "TenantPromo"("shopId");
