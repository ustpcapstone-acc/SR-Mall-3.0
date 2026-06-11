import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const convos = await prisma.conversation.findMany({
    where: { type: "ADMIN" },
    include: { user: true, target: true },
  });

  const userCounts = new Map<string, number>();
  for (const c of convos) {
    const key = `${c.userId} (${c.user.email})`;
    userCounts.set(key, (userCounts.get(key) || 0) + 1);
  }

  console.log("Users with multiple admin conversations:");
  for (const [key, count] of userCounts.entries()) {
    if (count > 1) {
      console.log(`${key}: ${count} conversations`);
      const userConvos = convos.filter((c) => `${c.userId} (${c.user.email})` === key);
      for (const uc of userConvos) {
        console.log(`  - ${uc.id}: targetId=${uc.targetId} (${uc.target?.email})`);
      }
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
