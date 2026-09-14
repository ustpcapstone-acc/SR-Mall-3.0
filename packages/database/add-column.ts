import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "AreaSlot" ADD COLUMN IF NOT EXISTS "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`);
  console.log("Features column ensured on AreaSlot table!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
