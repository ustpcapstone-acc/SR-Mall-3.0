-- Per-user read marker for chat conversations (drives unread badges).
CREATE TABLE IF NOT EXISTS "ConversationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationRead_userId_conversationId_key" ON "ConversationRead"("userId", "conversationId");
CREATE INDEX IF NOT EXISTS "ConversationRead_conversationId_idx" ON "ConversationRead"("conversationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationRead_userId_fkey') THEN
    ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationRead_conversationId_fkey') THEN
    ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: treat everything that already exists as read, so switching to
-- real unread tracking does not light up every old message.
INSERT INTO "ConversationRead" ("id", "userId", "conversationId", "lastReadAt")
SELECT gen_random_uuid()::text, p."userId", p."conversationId", CURRENT_TIMESTAMP
FROM (
  SELECT "userId", "id" AS "conversationId" FROM "Conversation"
  UNION SELECT "targetId", "id" FROM "Conversation"
  UNION SELECT u."id", c."id" FROM "User" u CROSS JOIN "Conversation" c WHERE u."role" = 'ADMIN'
) p
ON CONFLICT ("userId", "conversationId") DO NOTHING;
