"use server";

import { prisma } from "@srmall/database";
import { safeUserSelect } from "@/lib/user-select";
import { after } from "next/server";

// ─── Pagination ───────────────────────────────────────────────────────────────
// Chat pages never load a whole thread: the first request returns the newest
// page, scrolling up asks for the page before the oldest message on screen.

const DEFAULT_MESSAGE_PAGE = 30;

/** Tenant fields the chat screens actually use (not the whole row + products). */
const CHAT_TENANT_SELECT = {
  id: true,
  shopName: true,
  unitId: true,
  logoUrl: true,
  status: true,
} as const;

// ─── Unread tracking (ConversationRead) ──────────────────────────────────────
// Raw SQL so it works before `prisma generate` picks up the new model.

/** Unread message count per conversation for `readerId`, ignoring `excludeSenderIds`. */
async function unreadByConversation(
  readerId: string,
  conversationIds: string[],
  excludeSenderIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!readerId || conversationIds.length === 0) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; n: number }[]>(
      `SELECT m."conversationId" AS id, COUNT(*)::int AS n
         FROM "Message" m
         LEFT JOIN "ConversationRead" r
           ON r."conversationId" = m."conversationId" AND r."userId" = $1
        WHERE m."conversationId" = ANY($2::text[])
          AND NOT (m."senderId" = ANY($3::text[]))
          AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")
        GROUP BY m."conversationId"`,
      readerId,
      conversationIds,
      excludeSenderIds.length ? excludeSenderIds : [readerId],
    );
    rows.forEach((r) => out.set(r.id, Number(r.n) || 0));
  } catch (error) {
    console.error("[chat] unread lookup failed:", error);
  }
  return out;
}

async function adminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
}

/** Mark conversations as read for a user (opening a chat, or a message arriving in it). */
export async function markConversationReadAction(userId: string, conversationIds: string[]) {
  try {
    const ids = (conversationIds || []).filter((id) => id && !id.startsWith("new-"));
    if (!userId || ids.length === 0) return { success: true };
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ConversationRead" ("id", "userId", "conversationId", "lastReadAt")
       SELECT gen_random_uuid()::text, $1, c."id", $3::timestamp
         FROM "Conversation" c
        WHERE c."id" = ANY($2::text[])
       ON CONFLICT ("userId", "conversationId")
       DO UPDATE SET "lastReadAt" = EXCLUDED."lastReadAt"`,
      userId,
      ids,
      new Date(),
    );
    // The "New message" notification for these chats is read too.
    await prisma.$executeRawUnsafe(
      `UPDATE "Notification" n SET "isRead" = true
        WHERE n."userId" = $1 AND n."type" = 'MESSAGE' AND n."isRead" = false
          AND EXISTS (SELECT 1 FROM unnest($2::text[]) AS i WHERE n."link" LIKE '%conversationId=' || i || '%')`,
      userId,
      ids,
    );
    return { success: true };
  } catch (error: any) {
    console.error("[chat] mark read failed:", error);
    return { success: false, error: error.message };
  }
}

/** Total unread chat messages for the sidebar / launcher badges. */
export async function getChatUnreadTotal(userId: string): Promise<number> {
  if (!userId) return 0;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isAdmin = me?.role === "ADMIN";
  const admins = isAdmin ? await adminUserIds() : [];
  const conversations = await prisma.conversation.findMany({
    where: isAdmin
      ? { OR: [{ type: "ADMIN" }, { userId: { in: admins } }, { targetId: { in: admins } }] }
      : { OR: [{ userId }, { targetId: userId }] },
    select: { id: true },
  });
  const counts = await unreadByConversation(
    userId,
    conversations.map((c) => c.id),
    isAdmin ? admins : [userId],
  );
  let total = 0;
  counts.forEach((n) => (total += n));
  return total;
}

export interface UnreadChat {
  /** The contact (grouping key — one row per person/shop, like the messengers). */
  key: string;
  /** Newest conversation with that contact (what the messenger opens). */
  conversationId: string;
  name: string;
  logo: string | null;
  unread: number;
  preview: string;
  lastAt: string;
  lastMessageId: string;
  /** Page that opens this chat for the viewer's role. */
  href: string;
}

/**
 * Unread chats for the bell's Messages tab and every unread badge — one row
 * per contact, newest first. Same counting rules as `getChatUnreadTotal`,
 * so the bell, the sidebar and the chat launcher always agree.
 */
export async function getUnreadChatsAction(
  userId: string,
  limit = 8,
): Promise<{ total: number; items: UnreadChat[] }> {
  const empty = { total: 0, items: [] as UnreadChat[] };
  if (!userId) return empty;
  try {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!me) return empty;
    const role = String(me.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";
    const admins = isAdmin ? await adminUserIds() : [];
    const mine = isAdmin ? new Set(admins) : new Set([userId]);

    const conversations = await prisma.conversation.findMany({
      where: isAdmin
        ? { OR: [{ type: "ADMIN" }, { userId: { in: admins } }, { targetId: { in: admins } }] }
        : { OR: [{ userId }, { targetId: userId }] },
      select: { id: true },
    });
    const counts = await unreadByConversation(userId, conversations.map((c) => c.id), isAdmin ? admins : [userId]);
    const unreadIds = [...counts.entries()].filter(([, n]) => n > 0).map(([id]) => id);
    let total = 0;
    counts.forEach((n) => (total += n));
    if (unreadIds.length === 0) return { total, items: [] };

    const partySelect = { id: true, name: true, email: true, role: true, tenant: { select: { shopName: true, logoUrl: true } } } as const;
    const [details, latest] = await Promise.all([
      prisma.conversation.findMany({
        where: { id: { in: unreadIds } },
        select: { id: true, userId: true, targetId: true, user: { select: partySelect }, target: { select: partySelect } },
      }),
      prisma.$queryRawUnsafe<{ conversationId: string; id: string; content: string; imageUrl: string | null; createdAt: Date }[]>(
        `SELECT DISTINCT ON ("conversationId") "conversationId", "id", "content", "imageUrl", "createdAt"
           FROM "Message" WHERE "conversationId" = ANY($1::text[])
          ORDER BY "conversationId", "createdAt" DESC`,
        unreadIds,
      ),
    ]);
    const latestBy = new Map(latest.map((m) => [m.conversationId, m]));

    const byContact = new Map<string, UnreadChat>();
    for (const c of details) {
      const peer = mine.has(c.userId) && !mine.has(c.targetId) ? c.target : !mine.has(c.userId) ? c.user : c.target;
      const last = latestBy.get(c.id);
      if (!peer || !last) continue;
      const peerRole = String(peer.role || "").toUpperCase();
      const name =
        peerRole === "ADMIN" ? "SR Mall Admin" : peer.tenant?.shopName || peer.name || peer.email || "Customer";
      const href =
        role === "ADMIN"
          ? `/admindashboard/messenger-hub?conversationId=${c.id}`
          : role === "TENANT"
            ? `/tenantdashboard/customer-messenger?conversationId=${c.id}`
            : peerRole === "ADMIN"
              ? "/public-view?chat=open&recipient=admin"
              : `/public-view?chat=open&recipient=shop&shop=${encodeURIComponent(name)}`;
      const row: UnreadChat = {
        key: peer.id,
        conversationId: c.id,
        name,
        logo: peer.tenant?.logoUrl || null,
        unread: counts.get(c.id) || 0,
        preview: last.content?.trim() || (last.imageUrl ? "📷 Photo" : ""),
        lastAt: new Date(last.createdAt).toISOString(),
        lastMessageId: last.id,
        href,
      };
      const prev = byContact.get(peer.id);
      if (!prev) byContact.set(peer.id, row);
      else {
        const newer = row.lastAt > prev.lastAt ? row : prev;
        byContact.set(peer.id, { ...newer, unread: prev.unread + row.unread });
      }
    }

    const items = [...byContact.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, limit);
    return { total, items };
  } catch (error) {
    console.error("[chat] unread chats failed:", error);
    return empty;
  }
}

interface MessagePageOptions {
  /** How many messages to return (newest first, returned oldest→newest). */
  limit?: number;
  /** ISO timestamp of the oldest message currently displayed. */
  before?: string;
  /** Id of that same message — keeps pages exact on equal timestamps. */
  beforeId?: string;
}

function messagePageOptions(options?: MessagePageOptions) {
  const before = options?.before ? new Date(options.before) : null;
  if (!before || Number.isNaN(before.getTime())) return {};
  if (options?.beforeId) {
    return {
      OR: [
        { createdAt: { lt: before } },
        { createdAt: before, id: { lt: options.beforeId } },
      ],
    };
  }
  return { createdAt: { lt: before } };
}

// Fetch the active conversation for the public user and selected recipient
export async function getConversationHistory(
  userId: string,
  recipientType: "admin" | "shop",
  shopName?: string,
  options?: MessagePageOptions,
  tenantId?: string,
) {
  try {
    const cleanUserId = userId.trim();
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanUserId,
          mode: "insensitive",
        },
      },
    });
    if (!user) return [];

    let targetUser = null;
    if (recipientType === "admin") {
      targetUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    } else if (recipientType === "shop" && (tenantId || shopName)) {
      // By id when the caller knows it; otherwise an exact (case-insensitive)
      // name match — never a "contains" guess that could pick another shop.
      const tenant = tenantId
        ? await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { user: { select: safeUserSelect } },
          })
        : await prisma.tenant.findFirst({
            where: { shopName: { equals: shopName!.trim(), mode: "insensitive" } },
            include: { user: { select: safeUserSelect } },
          });
      targetUser = tenant?.user || null;
    }

    if (!targetUser && recipientType === "shop") return [];

    const matchingConversations = await prisma.conversation.findMany({
      where:
        recipientType === "admin"
          ? {
              type: "ADMIN",
              OR: [{ userId: user.id }, { targetId: user.id }],
            }
          : {
              OR: [
                { userId: user.id, targetId: targetUser!.id },
                { userId: targetUser!.id, targetId: user.id },
              ],
            },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });

    if (matchingConversations.length === 0) return [];

    const conversationIds = matchingConversations.map((c) => c.id);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        ...messagePageOptions(options),
      },
      // Newest page first, then flipped below so the UI stays chronological.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options?.limit ?? DEFAULT_MESSAGE_PAGE,
      include: { sender: { select: safeUserSelect } },
    });

    return messages.reverse();
  } catch (error) {
    console.error("Failed to get conversation:", error);
    return [];
  }
}

// Fetch conversations specifically for the logged-in tenant (deduplicated by partner user)
export async function getTenantConversations(userId: string) {
  try {
    const rawConversations = await prisma.conversation.findMany({
      where: {
        OR: [{ targetId: userId }, { userId: userId }],
      },
      include: {
        user: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
        target: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Deduplicate by partner user so each contact appears strictly once
    const partnerMap = new Map<string, any>();
    for (const c of rawConversations) {
      const partner = c.userId === userId ? c.target : c.user;
      if (!partner?.id) continue;
      const partnerId = partner.id;

      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          ...c,
          allConversationIds: [c.id],
        });
      } else {
        const existing = partnerMap.get(partnerId);
        if (!existing.allConversationIds.includes(c.id)) {
          existing.allConversationIds.push(c.id);
        }
        const existingDate = existing.messages[0]?.createdAt
          ? new Date(existing.messages[0].createdAt).getTime()
          : 0;
        const currentDate = c.messages[0]?.createdAt
          ? new Date(c.messages[0].createdAt).getTime()
          : 0;
        if (currentDate > existingDate) {
          existing.messages = c.messages;
          existing.updatedAt = c.updatedAt;
          existing.id = c.id;
        }
      }
    }

    const list = Array.from(partnerMap.values());
    const unread = await unreadByConversation(
      userId,
      list.flatMap((c) => c.allConversationIds),
      [userId],
    );
    for (const c of list) {
      c.unreadCount = c.allConversationIds.reduce((n: number, id: string) => n + (unread.get(id) || 0), 0);
    }
    return list;
  } catch (error) {
    console.error("Failed to get tenant conversations:", error);
    return [];
  }
}

// Fetch conversations specifically for the Admin (deduplicated by partner user)
export async function getAdminConversations(adminUserId?: string) {
  try {
    const rawConversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { type: "ADMIN" },
          { user: { role: "ADMIN" } },
          { target: { role: "ADMIN" } },
        ],
      },
      include: {
        user: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
        target: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
        areaSlot: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Deduplicate by partner user so each contact/shop appears strictly once
    const partnerMap = new Map<string, any>();
    for (const c of rawConversations) {
      const isUserAdmin =
        c.user?.role === "ADMIN" || (adminUserId && c.user?.id === adminUserId);
      const isTargetAdmin =
        c.target?.role === "ADMIN" || (adminUserId && c.target?.id === adminUserId);

      let partner = null;
      if (isUserAdmin && !isTargetAdmin) {
        partner = c.target;
      } else if (!isUserAdmin && isTargetAdmin) {
        partner = c.user;
      } else if (isUserAdmin && isTargetAdmin) {
        partner = adminUserId && c.user?.id === adminUserId ? c.target : c.user;
      } else {
        partner = c.user;
      }

      if (!partner?.id) continue;
      const partnerId = partner.id;

      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          ...c,
          allConversationIds: [c.id],
        });
      } else {
        const existing = partnerMap.get(partnerId);
        if (!existing.allConversationIds.includes(c.id)) {
          existing.allConversationIds.push(c.id);
        }
        const existingDate = existing.messages[0]?.createdAt
          ? new Date(existing.messages[0].createdAt).getTime()
          : 0;
        const currentDate = c.messages[0]?.createdAt
          ? new Date(c.messages[0].createdAt).getTime()
          : 0;
        if (currentDate > existingDate) {
          existing.messages = c.messages;
          existing.updatedAt = c.updatedAt;
          existing.id = c.id;
        }
        if (c.areaSlot && !existing.areaSlot) {
          existing.areaSlot = c.areaSlot;
        }
      }
    }

    const list = Array.from(partnerMap.values());
    if (adminUserId) {
      const unread = await unreadByConversation(
        adminUserId,
        list.flatMap((c) => c.allConversationIds),
        await adminUserIds(),
      );
      for (const c of list) {
        c.unreadCount = c.allConversationIds.reduce((n: number, id: string) => n + (unread.get(id) || 0), 0);
      }
    }
    return list;
  } catch (error) {
    console.error("Failed to get admin conversations:", error);
    return [];
  }
}

// Fetch all messages for a specific conversation (or across all merged conversations for that partner)
export async function getMessagesByConversation(
  conversationId: string,
  allConversationIds?: string[],
  options?: MessagePageOptions,
) {
  try {
    const ids =
      allConversationIds && allConversationIds.length > 0
        ? allConversationIds
        : [conversationId];

    // Filtered by conversation(s) and bounded by a cursor — never the whole
    // thread. Returns up to `limit` messages, oldest → newest.
    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: ids },
        ...messagePageOptions(options),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options?.limit ?? DEFAULT_MESSAGE_PAGE,
      include: { sender: { select: safeUserSelect } },
    });

    return messages.reverse();
  } catch (error) {
    console.error("Failed to get messages:", error);
    return [];
  }
}

// Send a reply (used by tenant/admin)
export async function replyToConversation(
  conversationId: string,
  isFromTarget: boolean,
  content: string,
  imageUrl?: string,
  explicitSenderId?: string,
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
        target: { select: { ...safeUserSelect, tenant: { select: CHAT_TENANT_SELECT } } },
      },
    });

    if (!conversation) throw new Error("Conversation not found");

    const senderId = explicitSenderId || (isFromTarget ? conversation.targetId : conversation.userId);
    const recipientId = senderId === conversation.userId ? conversation.targetId : conversation.userId;

    // Block check and the sender lookup are independent — one round trip.
    const [isBlocked, senderUser] = await Promise.all([
      // Check if recipient has blocked sender from sending messages (messaging-only block)
      isChatBlocked(recipientId, senderId),
      // Check if sender account is blacklisted/suspended
      prisma.user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          isBlacklisted: true,
          name: true,
          role: true,
          tenant: { select: { shopName: true } },
        },
      }),
    ]);

    if (isBlocked) {
      return {
        success: false,
        error: "This recipient is currently not accepting incoming messages from you.",
      };
    }

    if (senderUser?.isBlacklisted) {
      return { success: false, error: "Your account is currently suspended. You cannot send messages." };
    }

    // If sender is ADMIN, ensure message is in an ADMIN conversation channel
    let targetConversationId = conversationId;
    if (senderUser?.role === "ADMIN" && conversation.type !== "ADMIN") {
      let adminConvo = await prisma.conversation.findFirst({
        where: {
          type: "ADMIN",
          OR: [
            { userId: senderId, targetId: recipientId },
            { userId: recipientId, targetId: senderId },
            { userId: recipientId },
            { targetId: recipientId },
          ],
        },
      });
      if (!adminConvo) {
        adminConvo = await prisma.conversation.create({
          data: {
            type: "ADMIN",
            userId: recipientId,
            targetId: senderId,
          },
        });
      }
      targetConversationId = adminConvo.id;
    }

    // Insert the message and bump the conversation's updatedAt concurrently.
    const [message] = await Promise.all([
      prisma.message.create({
        data: {
          content: content || "",
          imageUrl: imageUrl || null,
          conversationId: targetConversationId,
          senderId,
        },
      }),
      prisma.conversation.update({
        where: { id: targetConversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Create a Message Notification for the recipient with proper display name
    let senderDisplayName = senderUser?.name || "a user";
    if (senderUser?.role === "ADMIN") {
      senderDisplayName = "SR Mall Admin";
    } else if (senderUser?.tenant?.shopName) {
      senderDisplayName = senderUser.tenant.shopName;
    } else if (conversation.user?.tenant?.shopName && conversation.user.id === senderId) {
      senderDisplayName = conversation.user.tenant.shopName;
    } else if (conversation.target?.tenant?.shopName && conversation.target.id === senderId) {
      senderDisplayName = conversation.target.tenant.shopName;
    }
    senderDisplayName = senderDisplayName.trim();

    // ⚡ Same dispatcher as new messages: honours the recipient's MESSAGE
    // preferences (in-app / email) and runs after the response is sent.
    const excerpt = content.length > 150 ? `${content.slice(0, 150)}...` : content;
    after(async () => {
      const { notifyChatMessage } = await import("@/lib/notify-chat");
      await notifyChatMessage({
        conversationId: targetConversationId,
        senderId,
        recipientId,
        senderName: senderUser?.role === "ADMIN" ? "SR Mall Admin" : senderDisplayName,
        excerpt: excerpt || "📷 Photo",
        subject:
          senderUser?.role === "ADMIN"
            ? "📩 New reply from SR Mall management"
            : "📩 New message from SR Mall",
      });
    });

    await markConversationReadAction(senderId, [targetConversationId]);

    return {
      success: true,
      messageId: message.id,
      conversationId: targetConversationId,
      message,
    };
  } catch (error: any) {
    console.error("Failed to reply:", error);
    return { success: false, error: error.message };
  }
}

// Unsend / Delete a message from the database
export async function deleteMessageAction(messageId: string, currentUserId?: string) {
  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: safeUserSelect },
      },
    });

    if (!msg) {
      return { success: false, error: "Message not found or already unsent." };
    }

    if (currentUserId) {
      const user = await prisma.user.findUnique({ where: { id: currentUserId } });
      const isAdmin = user?.role === "ADMIN";
      const isOwner = msg.senderId === currentUserId || (user?.email && msg.sender?.email === user.email);

      if (!isAdmin && !isOwner) {
        return { success: false, error: "You are only permitted to unsend your own messages." };
      }
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    // Update conversation updatedAt to latest remaining message if any
    if (msg.conversationId) {
      const latestRemaining = await prisma.message.findFirst({
        where: { conversationId: msg.conversationId },
        orderBy: { createdAt: "desc" },
      });
      if (latestRemaining) {
        await prisma.conversation.update({
          where: { id: msg.conversationId },
          data: { updatedAt: latestRemaining.createdAt },
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete/unsend message:", error);
    return { success: false, error: error.message || "Failed to delete message" };
  }
}

// Unsend / Delete just the attached image of a message
export async function unsendImageAction(messageId: string, currentUserId?: string) {
  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: { select: safeUserSelect } },
    });

    if (!msg) {
      return { success: false, error: "Message not found or already deleted." };
    }

    if (currentUserId) {
      const user = await prisma.user.findUnique({ where: { id: currentUserId } });
      const isAdmin = user?.role === "ADMIN";
      const isOwner = msg.senderId === currentUserId || (user?.email && msg.sender?.email === user.email);

      if (!isAdmin && !isOwner) {
        return { success: false, error: "You are only permitted to unsend your own attachments." };
      }
    }

    // If message only has an image and no text, delete the entire message
    if (!msg.content || msg.content.trim() === "" || msg.content === "📎 Image") {
      await prisma.message.delete({
        where: { id: messageId },
      });
    } else {
      await prisma.message.update({
        where: { id: messageId },
        data: { imageUrl: null },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to unsend image:", error);
    return { success: false, error: error.message || "Failed to remove image" };
  }
}

// Check if blocker has blocked blockedId specifically from messaging
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

// Server action to check chat block status
export async function checkBlockStatusAction(blockerId: string, blockedId: string): Promise<boolean> {
  return await isChatBlocked(blockerId, blockedId);
}

/** Has the shop (its tenant account) blocked `userId` from messaging it? */
export async function isBlockedByShopAction(tenantId: string, userId: string): Promise<boolean> {
  if (!tenantId || !userId) return false;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { userId: true } });
  return tenant ? isChatBlocked(tenant.userId, userId) : false;
}

// Block or unblock a user strictly for messaging (does NOT disable, suspend, or delete account)
export async function toggleBlockUserAction(
  arg1: string,
  arg2: string | boolean,
  arg3?: boolean
) {
  try {
    let blockerId: string;
    let blockedId: string;
    let isBlocked: boolean;

    if (typeof arg2 === "boolean") {
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      blockerId = admin?.id || "admin";
      blockedId = arg1;
      isBlocked = arg2;
    } else {
      blockerId = arg1;
      blockedId = arg2;
      isBlocked = !!arg3;
    }

    if (!blockerId || !blockedId) {
      return { success: false, error: "Missing blocker or blocked user ID." };
    }

    if (isBlocked) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BlockedChatUser" ("id", "blockerId", "blockedId", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT ("blockerId", "blockedId") DO NOTHING`,
        blockerId,
        blockedId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "BlockedChatUser" WHERE "blockerId" = $1 AND "blockedId" = $2`,
        blockerId,
        blockedId
      );
    }

    return { success: true, isBlocked };
  } catch (error: any) {
    console.error("Failed to toggle chat block status:", error);
    return { success: false, error: error.message || "Failed to update block status" };
  }
}

export async function getPortalAdminAction() {
  try {
    // The "portal admin" is always the oldest admin account — the same one
    // sendMessage routes public chats to, so block checks line up.
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    return admin;
  } catch (error) {
    return null;
  }
}

export async function getOrCreateAdminConversationForTenantAction(tenantId: string) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: { select: safeUserSelect } },
    });
    if (!tenant || !tenant.userId) {
      return { success: false, error: "Tenant or tenant user not found" };
    }

    let admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: "jerickaradilla76@gmail.com",
          password: "hash",
          role: "ADMIN",
          name: "Mall Admin",
        },
      });
    }

    // Check if an ADMIN conversation already exists with this tenant's user
    let conversation = await prisma.conversation.findFirst({
      where: {
        type: "ADMIN",
        OR: [
          { userId: tenant.userId },
          { targetId: tenant.userId },
        ],
      },
    });

    if (!conversation) {
      let spaceSlot = null;
      if (tenant.unitId && tenant.unitId !== "PENDING_ASSIGNMENT") {
        spaceSlot = await prisma.areaSlot.findFirst({
          where: { unit_id: tenant.unitId },
        });
      }

      conversation = await prisma.conversation.create({
        data: {
          type: "ADMIN",
          userId: tenant.userId,
          targetId: admin.id,
          spaceSlotId: spaceSlot?.id || null,
        },
      });
    }

    return { success: true, conversationId: conversation.id };
  } catch (error: any) {
    console.error("Failed to get or create admin conversation for tenant:", error);
    return { success: false, error: error.message };
  }
}

