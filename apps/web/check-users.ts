import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: { name: "wen wen" }
  });
  console.log("Users named 'wen wen':");
  console.log(users);
}

check().catch(console.error).finally(() => prisma.$disconnect());
