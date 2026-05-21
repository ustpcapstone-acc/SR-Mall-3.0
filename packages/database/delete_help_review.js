const { PrismaClient } = require('@prisma/client');

async function main() {
  const remotePrisma = new PrismaClient({
    datasourceUrl: "postgresql://postgres.ualmraraqlenwramdsjk:JERICKSCOTTNIELCHIE123@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });

  try {
    const deleted = await remotePrisma.review.deleteMany({
      where: {
        OR: [
          { comment: { contains: "THIS IS BIG HELP", mode: "insensitive" } },
          { user: { email: { contains: "golroger07roger", mode: "insensitive" } } }
        ]
      }
    });

    console.log(`Successfully deleted ${deleted.count} reviews matching criteria.`);
  } catch (e) {
    console.error("Error running deletion:", e);
  } finally {
    await remotePrisma.$disconnect();
  }
}

main();
