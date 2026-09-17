"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

// Fetch the active conversation for the public user and selected recipient
export async function getConversationHistory(
  userId: string,
  recipientType: "admin" | "shop",
  shopName?: string,
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
    } else if (recipientType === "shop" && shopName) {
      const cleanShopName = shopName.trim();
      const tenant =
        (await prisma.tenant.findFirst({
          where: {
            shopName: {
              equals: cleanShopName,
              mode: "insensitive",
            },
          },
          include: { user: true },
        })) ||
        (await prisma.tenant.findFirst({
          where: {
            shopName: {
              contains: cleanShopName,
              mode: "insensitive",
            },
          },
          include: { user: true },
        }));
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
      },
      orderBy: { createdAt: "asc" },
      include: { sender: true },
    });

    return messages;
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
        user: {
          include: {
            tenant: true,
          },
        },
        target: {
          include: {
            tenant: true,
          },
        },
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

    return Array.from(partnerMap.values());
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
        user: {
          include: {
            tenant: true,
          },
        },
        target: {
          include: {
            tenant: true,
          },
        },
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

    return Array.from(partnerMap.values());
  } catch (error) {
    console.error("Failed to get admin conversations:", error);
    return [];
  }
}

// Fetch all messages for a specific conversation (or across all merged conversations for that partner)
export async function getMessagesByConversation(
  conversationId: string,
  allConversationIds?: string[]
) {
  try {
    const ids =
      allConversationIds && allConversationIds.length > 0
        ? allConversationIds
        : [conversationId];

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: ids },
      },
      orderBy: { createdAt: "asc" },
      include: { sender: true },
    });
    return messages;
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
        user: { include: { tenant: true } },
        target: { include: { tenant: true } },
      },
    });

    if (!conversation) throw new Error("Conversation not found");

    const senderId = explicitSenderId || (isFromTarget ? conversation.targetId : conversation.userId);
    const recipientId = senderId === conversation.userId ? conversation.targetId : conversation.userId;

    // Check if recipient has blocked sender from sending messages (messaging-only block)
    const isBlocked = await isChatBlocked(recipientId, senderId);
    if (isBlocked) {
      return {
        success: false,
        error: "This recipient is currently not accepting incoming messages from you.",
      };
    }

    // Check if sender account is blacklisted/suspended
    const senderUser = await prisma.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        isBlacklisted: true,
        name: true,
        role: true,
        tenant: { select: { shopName: true } },
      },
    });

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

    const message = await prisma.message.create({
      data: {
        content: content || "",
        imageUrl: imageUrl || null,
        conversationId: targetConversationId,
        senderId,
      },
    });

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id: targetConversationId },
      data: { updatedAt: new Date() },
    });

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

    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: "MESSAGE",
        title: "New Message",
        message: `New message from ${senderDisplayName}`,
      },
    });

    // ── GMAIL NOTIFICATION (NON-BLOCKING) ──
    prisma.user
      .findUnique({
        where: { id: recipientId },
        select: { email: true, name: true },
      })
      .then((recipient) => {
        if (!recipient?.email) return;
        return import("@/lib/gmail").then(({ sendGmail }) => {
          const isFromAdmin = senderUser?.role === "ADMIN";
          return sendGmail({
            to: recipient.email,
            subject: isFromAdmin ? "📩 NEW REPLY FROM SR MALL MANAGEMENT" : "📩 NEW CUSTOMER MESSAGE",
            html: `
              <div style="font-family: 'Inter', sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: auto;">
                <header style="border-bottom: 2px solid #be1e2d; padding-bottom: 15px; margin-bottom: 20px;">
                  <h2 style="color: #be1e2d; margin: 0; font-size: 22px;">Experience Desk Alert</h2>
                </header>
                <section>
                  <p style="font-size: 16px; color: #334155;">Hello <strong>${recipient.name || "there"}</strong>,</p>
                  <p style="color: #475569; line-height: 1.5;">You have received a response from <strong>${senderDisplayName}</strong> regarding your ongoing conversation.</p>
                  <div style="background-color: #f8fafc; border-left: 4px solid #be1e2d; padding: 16px; margin: 20px 0; border-radius: 6px;">
                    <blockquote style="margin: 0; color: #1e293b; font-style: italic; font-size: 15px;">
                      "${content.length > 200 ? content.substring(0, 200) + "..." : content}"
                    </blockquote>
                  </div>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/messenger" style="background-color: #be1e2d; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">View Entire Thread</a>
                  </div>
                </section>
                <footer style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
                  Secure Communication Protocol • SR Mall Management Portal
                </footer>
              </div>
            `,
          });
        });
      })
      .catch((err) => {
        console.error("Failed to dispatch reply notification:", err);
      });

    revalidatePath("/admindashboard/messenger-hub");
    revalidatePath("/tenantdashboard/customer-messenger");
    revalidatePath("/public-view");

    return { success: true, messageId: message.id, conversationId: targetConversationId };
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
        sender: true,
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

    revalidatePath("/admindashboard/messenger-hub");
    revalidatePath("/tenantdashboard/customer-messenger");
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
      include: { sender: true },
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

    revalidatePath("/admindashboard/messenger-hub");
    revalidatePath("/tenantdashboard/customer-messenger");
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
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
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

    revalidatePath("/admindashboard/messenger-hub");
    revalidatePath("/tenantdashboard/customer-messenger");
    revalidatePath("/public-view");
    return { success: true, isBlocked };
  } catch (error: any) {
    console.error("Failed to toggle chat block status:", error);
    return { success: false, error: error.message || "Failed to update block status" };
  }
}

export async function getPortalAdminAction() {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
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
      include: { user: true },
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

    revalidatePath("/admindashboard/messenger-hub");
    return { success: true, conversationId: conversation.id };
  } catch (error: any) {
    console.error("Failed to get or create admin conversation for tenant:", error);
    return { success: false, error: error.message };
  }
}

