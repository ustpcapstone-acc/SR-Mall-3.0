const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: "postgresql://postgres.ualmraraqlenwramdsjk:JERICKSCOTTNIELCHIE123@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });

  try {
    console.log("Applying missing schema columns to Supabase...");

    // Add commentStatus to User table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "commentStatus" TEXT DEFAULT 'ACTIVE';
    `);
    console.log("✓ User.commentStatus column added");

    // Add commentRestrictedUntil to User table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "commentRestrictedUntil" TIMESTAMP(3);
    `);
    console.log("✓ User.commentRestrictedUntil column added");

    // Add isSpam to Review table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Review" 
      ADD COLUMN IF NOT EXISTS "isSpam" BOOLEAN DEFAULT FALSE NOT NULL;
    `);
    console.log("✓ Review.isSpam column added");

    console.log("\n✅ All schema migrations applied successfully!");
  } catch (e) {
    console.error("Migration error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
