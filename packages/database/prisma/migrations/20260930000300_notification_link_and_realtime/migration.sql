-- Where a notification leads when clicked (set by notify(); replaces
-- guessing the page from words in the title).
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Live bell: broadcast new notifications to the recipient's open tabs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."Notification";
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
