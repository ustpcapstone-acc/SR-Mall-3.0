import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Fashion';`);
  console.log("Column added successfully!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
