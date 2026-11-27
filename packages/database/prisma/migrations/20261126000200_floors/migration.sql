-- Mall floors, managed on Floor Spaces & Map, so any number of floors can be
-- added. "AreaSlot"."floor" (and "TenantHistory"."floor") keep holding the
-- floor's id. Additive only: no existing row is changed or removed.
CREATE TABLE IF NOT EXISTS "Floor" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  -- Order from the bottom up: basements are negative, the ground floor is 0.
  "level"     INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Floor_level_key" ON "Floor"("level");
CREATE UNIQUE INDEX IF NOT EXISTS "Floor_name_lower_key" ON "Floor"(lower("name"));
ALTER TABLE "Floor" ENABLE ROW LEVEL SECURITY;

-- The three floors the app already uses, with their existing ids.
INSERT INTO "Floor" ("id", "name", "level") VALUES
  ('ground', 'Ground Floor', 0),
  ('first', '1st Floor', 1),
  ('second', '2nd Floor', 2)
ON CONFLICT DO NOTHING;
