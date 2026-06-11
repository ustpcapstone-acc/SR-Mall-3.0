import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function mergeAdminConversations() {
  const convos = await prisma.conversation.findMany({
    where: { type: "ADMIN" },
    include: { messages: true },
    orderBy: { createdAt: "asc" },
  });

  const userMap = new Map<string, string>(); // userId -> primaryConversationId

  for (const c of convos) {
    if (userMap.has(c.userId)) {
      const primaryId = userMap.get(c.userId)!;
      console.log(`Merging conversation ${c.id} into primary ${primaryId} for user ${c.userId}`);
      
      if (c.messages.length > 0) {
        await prisma.message.updateMany({
          where: { conversationId: c.id },
          data: { conversationId: primaryId },
        });
      }
      
      await prisma.conversation.delete({
        where: { id: c.id },
      });
    } else {
      userMap.set(c.userId, c.id);
    }
  }

  // Next, we need to fix `targetId` for ADMIN conversations where userId is the ADMIN (if any).
  // Actually, ADMIN conversations are created with userId = the customer/tenant, and targetId = the admin.
  console.log("Merge complete!");
}

mergeAdminConversations().catch(console.error).finally(() => prisma.$disconnect());
