-- Floor Spaces & Map: a floor can keep the layout the office dragged into place
-- and a picture of its floor plan. Additive only.
ALTER TABLE "Floor"
  -- Picture shown behind the units (none: a plain grid).
  ADD COLUMN IF NOT EXISTS "planUrl" TEXT,
  -- True once unit positions were saved by hand; otherwise they're lined up automatically.
  ADD COLUMN IF NOT EXISTS "arranged" BOOLEAN NOT NULL DEFAULT false;
