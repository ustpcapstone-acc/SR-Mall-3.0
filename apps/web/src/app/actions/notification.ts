"use server";

import { requireActingAs } from "@/lib/action-guard";
import { currentAccount } from "@/lib/auth-server";
import { workspaceScope } from "@/lib/workspace-server";
import { Prisma, prisma } from "@srmall/database";
import { typesInGroup, type NotificationTabGroup } from "@/lib/notification-types";

export type NotificationTab = "ALL" | "UNREAD" | NotificationTabGroup;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link: string | null;
}

const KNOWN_NON_INFO = [
  ...typesInGroup("MONEY"),
  ...typesInGroup("ACTION"),
  ...typesInGroup("SECURITY"),
  ...typesInGroup("MESSAGE"),
];

/** Notices about one shop or unit. Older ones saved without either belong to the main shop. */
const WORKSPACE_TYPES = [
  ...typesInGroup("MONEY"),
  ...typesInGroup("MESSAGE"),
  "MERCHANT_APPLICATION_UPDATE",
  "AD_DECISION",
  "COMPLAINT_ACTIVITY",
  "COMPLAINT_UPDATE",
  "NEW_REVIEW",
  "NEW_REVIEW_SUBMITTED",
  "REVIEW_MODERATION",
];

/**
 * In a tenant's unit workspace: notices about that unit, about its shop, and
 * about the whole account. Home (and everyone else) sees everything.
 */
async function inWorkspace(userId: string): Promise<Prisma.NotificationWhereInput> {
  const account = await currentAccount();
  if (account?.type !== "TENANT") return {};
  const staff = account.tenantStaff;
  if (userId !== account.id && userId !== staff?.ownerUserId) return {};
  const tenant = await prisma.tenant.findUnique({
    where: staff ? { id: staff.tenantId } : { userId: account.id },
    select: { id: true },
  });
  if (!tenant) return {};
  const scope = await workspaceScope(tenant.id, staff?.leaseId);
  if (!scope.unitId) return {};
  return {
    OR: [
      { unitId: scope.unitId },
      { shopId: scope.shopId },
      // A separate shop starts clean: only account-wide notices carry over to it.
      { shopId: null, unitId: null, ...(scope.shopKey && { type: { notIn: WORKSPACE_TYPES } }) },
    ],
  };
}

/**
 * A page of the user's notifications (newest first).
 *  - `tab`: ALL, UNREAD, or a group (MONEY / ACTION / SECURITY / INFO / MESSAGE)
 *  - `excludeMessages`: leave chat alerts out (the bell; chat has its own badges)
 *  - `before`: cursor — ISO date of the last item already shown
 * Also returns the unread count (non-message) for the bell badge.
 */
export async function getNotificationsAction(
  userId: string,
  options: { tab?: NotificationTab; excludeMessages?: boolean; before?: string | null; limit?: number } = {},
) {
  try {
    await requireActingAs(userId);
    if (!userId) return { success: false as const, error: "Not signed in" };
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const tab = options.tab ?? "ALL";

    const scope = await inWorkspace(userId);
    const where: Prisma.NotificationWhereInput[] = [{ userId }, scope];
    if (options.excludeMessages || (tab !== "ALL" && tab !== "UNREAD" && tab !== "MESSAGE")) {
      if (tab !== "MESSAGE") where.push({ type: { not: "MESSAGE" } });
    }
    if (tab === "UNREAD") where.push({ isRead: false });
    if (tab === "INFO") where.push({ type: { notIn: KNOWN_NON_INFO } });
    else if (tab === "MONEY" || tab === "ACTION" || tab === "SECURITY" || tab === "MESSAGE") {
      where.push({ type: { in: typesInGroup(tab) } });
    }
    if (options.before) where.push({ createdAt: { lt: new Date(options.before) } });

    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { AND: where },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true, link: true },
      }),
      prisma.notification.count({ where: { AND: [{ userId, isRead: false, type: { not: "MESSAGE" } }, scope] } }),
    ]);

    const items: NotificationItem[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      isRead: Boolean(r.isRead),
      createdAt: new Date(r.createdAt).toISOString(),
      link: r.link ?? null,
    }));
    return { success: true as const, data: { items, hasMore: rows.length > limit, unreadCount: unread } };
  } catch (error) {
    console.error("[GET_NOTIFICATIONS_ERROR]:", error);
    return { success: false as const, error: "Failed to fetch notifications" };
  }
}

/** Mark one notification read — only if it belongs to `userId`. */
export async function markNotificationAsReadAction(userId: string, notificationId: string) {
  try {
    await requireActingAs(userId);
    const res = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { success: res.count > 0 };
  } catch (error) {
    return { success: false, error: "Failed to mark as read" };
  }
}

/** Mark everything read (optionally leaving chat alerts alone, as the bell does). */
export async function markAllNotificationsAsReadAction(userId: string, options: { excludeMessages?: boolean } = {}) {
  try {
    await requireActingAs(userId);
    await prisma.notification.updateMany({
      where: {
        AND: [
          { userId, isRead: false, ...(options.excludeMessages ? { type: { not: "MESSAGE" } } : {}) },
          await inWorkspace(userId),
        ],
      },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark all as read" };
  }
}

/** Delete one notification — only your own. */
export async function deleteNotificationAction(userId: string, notificationId: string) {
  try {
    await requireActingAs(userId);
    const res = await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
    return { success: res.count > 0 };
  } catch (error) {
    return { success: false, error: "Failed to delete the notification" };
  }
}

/** Delete all of your read notifications. */
export async function clearReadNotificationsAction(userId: string) {
  try {
    await requireActingAs(userId);
    const res = await prisma.notification.deleteMany({
      where: { AND: [{ userId, isRead: true }, await inWorkspace(userId)] },
    });
    return { success: true, deleted: res.count };
  } catch (error) {
    return { success: false, error: "Failed to clear notifications" };
  }
}

export async function getUnreadMessageCountAction(userId: string) {
  try {
    await requireActingAs(userId);
    // Unread = messages newer than the user's last visit to each conversation
    // (ConversationRead), so opening one chat no longer clears every badge.
    const { getChatUnreadTotal } = await import("@/app/actions/chat-queries");
    return { success: true, data: await getChatUnreadTotal(userId) };
  } catch (error) {
    return { success: false, error: "Failed to fetch count" };
  }
}

export async function markMessageNotificationsAsReadAction(userId: string) {
  try {
    await requireActingAs(userId);
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    
    let whereClause: any = { userId, isRead: false, type: "MESSAGE" };
    
    if (currentUser?.role === "ADMIN") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a: any) => a.id);
      whereClause = { userId: { in: adminIds }, isRead: false, type: "MESSAGE" };
    }
    
    await prisma.notification.updateMany({
      where: { AND: [whereClause, await inWorkspace(userId)] },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark messages as read" };
  }
}
