import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "AreaSlot" ADD COLUMN IF NOT EXISTS "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`);
  console.log("Features column ensured on AreaSlot table!");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BlockedChatUser" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BlockedChatUser_blockerId_blockedId_key" UNIQUE ("blockerId", "blockedId")
    );
  `);
  console.log("BlockedChatUser table ensured in database!");
}
main().catch(console.error).finally(() => prisma.$disconnect());

