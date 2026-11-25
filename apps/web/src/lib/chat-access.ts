/**
 * Who may read or write which chat. Customers and tenants: their own. Store
 * staff with Messages: the store's shopper chats, never the owner's mall-office
 * inbox. Mall staff with Messages: the shared mall-office inbox.
 */
import { prisma } from "@srmall/database";
import { AccessDenied, currentAccount } from "@/lib/auth-server";
import { holds, requireAccount, worksFor } from "@/lib/action-guard";

/** May the caller send and read messages under this user id? */
export async function canSpeakAs(userId: string | null | undefined): Promise<boolean> {
  const account = await currentAccount();
  if (!account || !userId) return false;
  if (userId === account.id || worksFor(account, userId, "messages")) return true;
  if (!holds(account, "messages")) return false;
  const other = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return other?.role === "ADMIN";
}

export async function requireSpeaker(userId: string | null | undefined) {
  if (!(await canSpeakAs(userId))) throw new AccessDenied("Please sign in again.");
}

/** True when the caller is store staff using the owner's id. */
export async function isStandIn(userId: string) {
  const account = await currentAccount();
  return !!account?.tenantStaff && account.tenantStaff.ownerUserId === userId;
}

/** Throws unless the caller may open every one of these conversations. */
export async function requireConversations(ids: string[]) {
  const account = await requireAccount();
  const conversations = await prisma.conversation.findMany({
    where: { id: { in: ids.filter((id) => typeof id === "string") } },
    select: { userId: true, targetId: true, type: true, user: { select: { role: true } }, target: { select: { role: true } } },
  });
  for (const c of conversations) {
    const parties = [c.userId, c.targetId];
    if (parties.includes(account.id)) continue;
    const mallOffice = c.user.role === "ADMIN" || c.target.role === "ADMIN";
    if (!mallOffice && parties.some((id) => worksFor(account, id, "messages"))) continue;
    if (holds(account, "messages") && (mallOffice || c.type === "ADMIN")) continue;
    throw new AccessDenied();
  }
}
