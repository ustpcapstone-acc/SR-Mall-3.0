-- Broadcast unit (AreaSlot) status changes so every open "Available Spaces"
-- page sees a unit turn RESERVED the moment someone reserves it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."AreaSlot";
    EXCEPTION
      WHEN duplicate_object THEN NULL; -- already published
    END;
  END IF;
END $$;
