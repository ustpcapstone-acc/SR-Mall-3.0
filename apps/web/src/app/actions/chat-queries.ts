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
    const user = await prisma.user.findUnique({ where: { email: userId } });
    if (!user) return [];

    let targetUser = null;
    if (recipientType === "admin") {
      targetUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    } else if (recipientType === "shop" && shopName) {
      // Find the user via the Tenant record shopName
      const tenant = await prisma.tenant.findFirst({
        where: { shopName },
        include: { user: true },
      });
      targetUser = tenant?.user || null;
    }

    if (!targetUser) return [];

    const conversation = await prisma.conversation.findFirst({
      where: {
        userId: user.id,
        targetId: targetUser.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: true },
        },
      },
    });

    return conversation?.messages || [];
  } catch (error) {
    console.error("Failed to get conversation:", error);
    return [];
  }
}

// Fetch conversations specifically for the logged-in tenant
export async function getTenantConversations(userId: string) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          {
            type: "TENANT",
            targetId: userId,
          },
          {
            type: "ADMIN",
            userId: userId,
          },
        ],
      },
      include: {
        user: true,
        target: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return conversations;
  } catch (error) {
    console.error("Failed to get tenant conversations:", error);
    return [];
  }
}

// Fetch conversations specifically for the Admin
export async function getAdminConversations() {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: "ADMIN",
      },
      include: {
        user: true,
        target: true,
        areaSlot: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return conversations;
  } catch (error) {
    console.error("Failed to get admin conversations:", error);
    return [];
  }
}

// Fetch all messages for a specific conversation
export async function getMessagesByConversation(conversationId: string) {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
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
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new Error("Conversation not found");

    const senderId = isFromTarget ? conversation.targetId : conversation.userId;
    const recipientId = isFromTarget ? conversation.userId : conversation.targetId;

    const message = await prisma.message.create({
      data: {
        content: content || "",
        imageUrl: imageUrl || null,
        conversationId,
        senderId,
      },
    });

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Create a Message Notification for the recipient
    const sender = isFromTarget ? "SR Mall Admin" : "a guest user";
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: "MESSAGE",
        title: "New Message",
        message: `New message from ${sender}`,
      }
    });

    // ── GMAIL NOTIFICATION ──
    try {
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { email: true, name: true },
      });

      if (recipient?.email) {
        const { sendGmail } = await import("@/lib/gmail");
        const sender = isFromTarget ? "SR Mall Admin" : "a guest user";

        await sendGmail({
          to: recipient.email,
          subject: isFromTarget ? "📩 NEW REPLY FROM SR MALL MANAGEMENT" : "📩 NEW CUSTOMER MESSAGE",
          html: `
            <div style="font-family: 'Inter', sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: auto;">
              <header style="border-bottom: 2px solid #be1e2d; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #be1e2d; margin: 0; font-size: 22px;">Experience Desk Alert</h2>
              </header>
              <section>
                <p style="font-size: 16px; color: #334155;">Hello <strong>${recipient.name || "there"}</strong>,</p>
                <p style="color: #475569; line-height: 1.5;">You have received a response from <strong>${sender}</strong> regarding your ongoing conversation.</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #be1e2d; padding: 16px; margin: 20px 0; border-radius: 6px;">
                  <blockquote style="margin: 0; color: #1e293b; font-style: italic; font-size: 15px;">
                    "${content.length > 200 ? content.substring(0, 200) + "..." : content}"
                  </blockquote>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/messenger" style="background-color: #be1e2d; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">View Entire Thread</a>
                </div>
              </section>
              <footer style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
                Secure Communication Protocol • SR Mall Management Portal
              </footer>
            </div>
          `,
        });
      }
    } catch (err) {
      console.error("Failed to send reply Gmail notification:", err);
    }

    revalidatePath("/tenantdashboard/customer-messenger");
    return { success: true, messageId: message.id };
  } catch (error) {
    console.error("Failed to reply:", error);
    return { success: false };
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
