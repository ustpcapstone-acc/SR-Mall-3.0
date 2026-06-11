import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupRedundantConversations() {
  console.log("Fetching all conversations...");
  const allConversations = await prisma.conversation.findMany({
    include: {
      messages: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const pairMap = new Map<string, string>(); // 'userId:targetId' -> 'primaryConversationId'

  for (const conv of allConversations) {
    // Generate a consistent key for the user pair regardless of who is sender/target
    const sortedIds = [conv.userId, conv.targetId].sort();
    const pairKey = `${sortedIds[0]}:${sortedIds[1]}:${conv.type}`;

    if (pairMap.has(pairKey)) {
      const primaryId = pairMap.get(pairKey)!;
      console.log(`Found redundant conversation: ${conv.id}. Merging into primary: ${primaryId}`);

      // Reassign all messages from the redundant conversation to the primary one
      if (conv.messages.length > 0) {
        await prisma.message.updateMany({
          where: { conversationId: conv.id },
          data: { conversationId: primaryId },
        });
        console.log(`  Merged ${conv.messages.length} messages.`);
      }

      // Delete the redundant conversation
      await prisma.conversation.delete({
        where: { id: conv.id },
      });
      console.log(`  Deleted redundant conversation: ${conv.id}`);
    } else {
      pairMap.set(pairKey, conv.id);
    }
  }

  console.log("Cleanup complete!");
}

cleanupRedundantConversations()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
