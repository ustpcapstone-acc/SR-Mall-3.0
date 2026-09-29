-- CreateTable: messaging-only blocks (does NOT suspend or blacklist the account)
CREATE TABLE IF NOT EXISTS "BlockedChatUser" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedChatUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlockedChatUser_blockerId_blockedId_key" ON "BlockedChatUser"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockedChatUser_blockedId_idx" ON "BlockedChatUser"("blockedId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockedChatUser_blockerId_fkey') THEN
    ALTER TABLE "BlockedChatUser" ADD CONSTRAINT "BlockedChatUser_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockedChatUser_blockedId_fkey') THEN
    ALTER TABLE "BlockedChatUser" ADD CONSTRAINT "BlockedChatUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
