import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const convos = await prisma.conversation.findMany({
    where: { type: "ADMIN" },
    include: { user: true, target: true },
  });
  console.log("Admin Conversations:");
  for (const c of convos) {
    console.log(`- ${c.id}: userId=${c.userId} (${c.user.email}, ${c.user.name}) <-> targetId=${c.targetId} (${c.target?.email}, ${c.target?.name})`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
