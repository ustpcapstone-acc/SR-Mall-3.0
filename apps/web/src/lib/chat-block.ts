import { prisma } from "@srmall/database";

/** Has `blockerId` blocked `blockedId` from messaging them? */
export async function isChatBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    if (!blockerId || !blockedId) return false;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "BlockedChatUser" WHERE "blockerId" = $1 AND "blockedId" = $2 LIMIT 1`,
      blockerId,
      blockedId
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    return false;
  }
}
