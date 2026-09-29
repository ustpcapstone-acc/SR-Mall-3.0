-- Chat performance & realtime
-- 1) Composite index so "messages of this conversation, newest first / before-cursor"
--    lookups stop doing a sequential scan of the whole Message table.
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON public."Message"("conversationId", "createdAt");

-- 2) Publish the existing messages table to Supabase Realtime so INSERT/DELETE
--    events are broadcast to subscribed clients (no schema/field changes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."Message";
    EXCEPTION
      WHEN duplicate_object THEN NULL; -- already published
    END;
  END IF;
END $$;
