import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tokens = await prisma.passwordResetToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log(JSON.stringify(tokens, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
