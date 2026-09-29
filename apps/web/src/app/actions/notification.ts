"use server";

import { prisma } from "@srmall/database";
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
    if (!userId) return { success: false as const, error: "Not signed in" };
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const tab = options.tab ?? "ALL";

    const where: string[] = [`"userId" = $1`];
    const params: any[] = [userId];
    const add = (sql: string, value: any) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };

    if (options.excludeMessages || (tab !== "ALL" && tab !== "UNREAD" && tab !== "MESSAGE")) {
      if (tab !== "MESSAGE") where.push(`"type" <> 'MESSAGE'`);
    }
    if (tab === "UNREAD") where.push(`"isRead" = false`);
    if (tab === "INFO") add(`NOT ("type" = ANY(?::text[]))`, KNOWN_NON_INFO);
    else if (tab === "MONEY" || tab === "ACTION" || tab === "SECURITY" || tab === "MESSAGE") {
      add(`"type" = ANY(?::text[])`, typesInGroup(tab));
    }
    if (options.before) add(`"createdAt" < ?::timestamp`, new Date(options.before));

    const [rows, unread] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "type", "title", "message", "isRead", "createdAt", "link"
           FROM "Notification" WHERE ${where.join(" AND ")}
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT ${limit + 1}`,
        ...params,
      ),
      prisma.notification.count({ where: { userId, isRead: false, type: { not: "MESSAGE" } } }),
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
    await prisma.notification.updateMany({
      where: { userId, isRead: false, ...(options.excludeMessages ? { type: { not: "MESSAGE" } } : {}) },
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
    const res = await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
    return { success: res.count > 0 };
  } catch (error) {
    return { success: false, error: "Failed to delete the notification" };
  }
}

/** Delete all of your read notifications. */
export async function clearReadNotificationsAction(userId: string) {
  try {
    const res = await prisma.notification.deleteMany({ where: { userId, isRead: true } });
    return { success: true, deleted: res.count };
  } catch (error) {
    return { success: false, error: "Failed to clear notifications" };
  }
}

export async function getUnreadMessageCountAction(userId: string) {
  try {
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
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    
    let whereClause: any = { userId, isRead: false, type: "MESSAGE" };
    
    if (currentUser?.role === "ADMIN") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a: any) => a.id);
      whereClause = { userId: { in: adminIds }, isRead: false, type: "MESSAGE" };
    }
    
    await prisma.notification.updateMany({ where: whereClause, data: { isRead: true } });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark messages as read" };
  }
}
