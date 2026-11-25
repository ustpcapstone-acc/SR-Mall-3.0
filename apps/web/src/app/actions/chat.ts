"use server";

import { prisma } from "@srmall/database";
import { safeUserSelect } from "@/lib/user-select";
import { after } from "next/server";
import { notifyChatMessage } from "@/lib/notify-chat";
import { markConversationReadAction } from "@/app/actions/chat-queries";
import { isChatBlocked } from "@/lib/chat-block";
import { canSpeakAs, isStandIn } from "@/lib/chat-access";

// Chat data is fetched on the client and pushed by Supabase Realtime, so these
// actions deliberately do NOT call revalidatePath(): doing so makes Next.js
// re-render the caller's whole page (e.g. /) inside the action
// response, which was the main source of the multi-second send delay.

async function findSender(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { tenant: { select: { shopName: true } } },
  });
}

/**
 * Who a public-chat message goes to. Never creates placeholder accounts: an
 * unknown shop or a mall without an admin is reported back to the sender.
 */
async function resolveTargetUser(
  recipientType: "admin" | "shop",
  shopName?: string,
  tenantId?: string,
) {
  if (recipientType === "admin") {
    return prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  }
  if (recipientType !== "shop") return null;

  const tenant = tenantId
    ? await prisma.tenant.findUnique({ where: { id: tenantId }, include: { user: true } })
    : shopName?.trim()
      ? await prisma.tenant.findFirst({
          where: { shopName: { equals: shopName.trim(), mode: "insensitive" } },
          include: { user: true },
        })
      : null;
  return tenant?.user ?? null;
}

export async function sendMessage(data: {
  userId: string;
  recipientType: "admin" | "shop";
  content: string;
  imageUrl?: string;
  shopName?: string;
  /** Preferred over shopName: identifies the shop exactly. */
  tenantId?: string;
  slotId?: string;
}) {
  const { userId: email, recipientType, content, imageUrl, shopName, tenantId, slotId } = data;

  try {
    // The sender and the recipient are independent lookups — resolve them in
    // one round trip instead of two.
    const [sender, targetUser] = await Promise.all([
      findSender(email),
      resolveTargetUser(recipientType, shopName, tenantId),
    ]);

    // The email comes from the browser: it must be the signed-in person's.
    if (!sender || !(await canSpeakAs(sender.id)) || (recipientType === "admin" && (await isStandIn(sender.id)))) {
      return { success: false, error: "Please sign in again to send messages." };
    }

    if (sender.isBlacklisted) {
      return {
        success: false,
        error: "Your account has been suspended by mall management. Messaging is disabled.",
      };
    }

    if (!targetUser) {
      return {
        success: false,
        error:
          recipientType === "admin"
            ? "Mall administration is not available right now. Please try again later."
            : "This shop can't receive messages right now.",
      };
    }

    // Block check and the existing-conversation lookup are also independent.
    const [isBlocked, existingConversation] = await Promise.all([
      // Check if targetUser has blocked sender from sending chat messages
      isChatBlocked(targetUser.id, sender.id),
      // Check if conversation already exists in either direction
      prisma.conversation.findFirst({
        where:
          recipientType === "admin"
            ? {
                type: "ADMIN",
                OR: [
                  { userId: sender.id, targetId: targetUser.id },
                  { userId: targetUser.id, targetId: sender.id },
                  { userId: sender.id },
                  { targetId: sender.id },
                ],
              }
            : {
                OR: [
                  { userId: sender.id, targetId: targetUser.id },
                  { userId: targetUser.id, targetId: sender.id },
                ],
              },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (isBlocked) {
      return {
        success: false,
        error: "This recipient is currently not accepting incoming messages from you.",
      };
    }

    // Create a new conversation channel if it doesn't exist
    const conversation =
      existingConversation ??
      (await prisma.conversation.create({
        data: {
          type: recipientType === "admin" ? "ADMIN" : "TENANT",
          userId: sender.id,
          targetId: targetUser.id,
          spaceSlotId: slotId,
        },
      }));

    // Anti-spam: a double-tap (or an impatient retry) used to insert the same
    // bubble twice. If this sender already posted identical text in this
    // conversation within the last 3 seconds, return that message instead of
    // creating a duplicate.
    if (!imageUrl && content.trim()) {
      const recentDuplicate = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          senderId: sender.id,
          content,
          imageUrl: null,
          createdAt: { gte: new Date(Date.now() - 3000) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentDuplicate) {
        return {
          success: true,
          messageId: recentDuplicate.id,
          conversationId: recentDuplicate.conversationId,
          targetId: targetUser.id,
          message: recentDuplicate,
          duplicate: true,
        };
      }
    }

    // Insert the message and bump the conversation's updatedAt concurrently.
    const [message] = await Promise.all([
      prisma.message.create({
        data: {
          content: content || "",
          imageUrl: imageUrl || null,
          conversationId: conversation.id,
          senderId: sender.id,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Create a Message Notification for the recipient
    let senderDisplayName = sender.name || "a user";
    if (sender.role === "ADMIN") {
      senderDisplayName = "SR Mall Admin";
    } else if (sender.role === "TENANT" && sender.tenant?.shopName) {
      senderDisplayName = sender.tenant.shopName;
    }

    // ⚡ One dispatch handles the in-app row and the email, each gated by the
    // recipient's own MESSAGE preferences. Scheduled with `after()` so the send
    // response (and the optimistic bubble) is never held up by SMTP round-trips;
    // `after()` still runs the callback for the route's full max duration.
    const excerpt = content.length > 150 ? `${content.slice(0, 150)}...` : content;
    after(async () => {
      await notifyChatMessage({
        conversationId: conversation.id,
        senderId: sender.id,
        recipientId: targetUser.id,
        senderName: senderDisplayName,
        excerpt,
        subject:
          recipientType === "admin"
            ? "📩 New executive inquiry received"
            : "📩 New message from SR Mall",
      });
    });

    await markConversationReadAction(sender.id, [conversation.id]);

    return {
      success: true,
      messageId: message.id,
      conversationId: message.conversationId,
      targetId: targetUser.id,
      message,
    };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { success: false, error: "Failed to route message." };
  }
}
