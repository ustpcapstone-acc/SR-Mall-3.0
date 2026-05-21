const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log("Tables in public schema:");
  console.log(res.map(r => r.table_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
