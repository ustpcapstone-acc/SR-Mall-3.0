"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

export async function sendMessage(data: {
  userId: string;
  recipientType: "admin" | "shop";
  content: string;
  imageUrl?: string;
  shopName?: string;
  slotId?: string;
}) {
  const { userId: email, recipientType, content, imageUrl, shopName, slotId } = data;

  try {
    let sender = await prisma.user.findUnique({
      where: { email },
    });

    if (!sender) {
      sender = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          password: "mockpassword",
          role: "CUSTOMER",
        },
      });
    }

    // In a real app, you would look up the specific Admin or Tenant User ID.
    // Here we find or create dummy target users based on the recipientType to simulate routing.
    let targetUser = null;

    if (recipientType === "admin") {
      targetUser = await prisma.user.findFirst({
        where: { role: "ADMIN" },
      });
      if (!targetUser) {
        // Fallback: create a dummy admin for testing
        targetUser = await prisma.user.create({
          data: {
            email: "jerickaradilla76@gmail.com",
            password: "hash",
            role: "ADMIN",
            name: "Mall Admin",
          },
        });
      }
    } else if (recipientType === "shop" && shopName) {
      // Find the Tenant entry by shopName, then get its associated User
      const tenantRecord = await prisma.tenant.findFirst({
        where: { shopName: shopName },
        include: { user: true },
      });

      if (tenantRecord?.user) {
        targetUser = tenantRecord.user;
      } else {
        // Create a fallback tenant for testing if it doesn't exist
        const fallbackEmail = `${shopName.replace(/\s+/g, "").toLowerCase()}@tenant.com`;
        targetUser = await prisma.user.upsert({
          where: { email: fallbackEmail },
          update: {},
          create: {
            email: fallbackEmail,
            password: "hash",
            role: "TENANT",
            name: shopName,
          },
        });

        // Link it to a tenant record if it's missing
        await prisma.tenant.upsert({
          where: { userId: targetUser.id },
          update: { shopName },
          create: { shopName, unitId: "L1-XXX", userId: targetUser.id },
        });
      }
    }

    if (!targetUser) {
      throw new Error("Target recipient not found.");
    }

    // Check if conversation already exists
    let conversation = await prisma.conversation.findFirst({
      where: recipientType === "admin" 
        ? { type: "ADMIN", userId: sender.id }
        : { userId: sender.id, targetId: targetUser.id },
    });

    // Create a new conversation channel if it doesn't exist
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type: recipientType === "admin" ? "ADMIN" : "TENANT",
          userId: sender.id,
          targetId: targetUser.id,
          spaceSlotId: slotId,
        },
      });
    }

    // Insert the actual message
    const message = await prisma.message.create({
      data: {
        content: content || "",
        imageUrl: imageUrl || null,
        conversationId: conversation.id,
        senderId: sender.id,
      },
    });

    // Create a Message Notification for the recipient
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: "MESSAGE",
        title: "New Message",
        message: `New message from ${sender.name || "a user"}`,
      }
    });

    // ── GMAIL NOTIFICATION ──
    if (targetUser.email) {
      try {
        const { sendGmail } = await import("@/lib/gmail");
        const isToAdmin = recipientType === "admin";
        
        await sendGmail({
          to: targetUser.email,
          subject: isToAdmin ? "📩 NEW EXECUTIVE INQUIRY RECEIVED" : "📩 NEW MESSAGE FROM SR MALL ADMIN",
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
              <div style="background: #be1e2d; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">Experience Desk Hub</h2>
              </div>
              <div style="padding: 20px; border: 1px solid #be1e2d; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>${targetUser.name || "User"}</strong>,</p>
                <p>You have received a new message through the SR Mall communication portal.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; font-style: italic; color: #334155; border-left: 4px solid #be1e2d;">
                  "${content.length > 150 ? content.substring(0, 150) + "..." : content}"
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p>Please log in to your dashboard to view the full thread and respond.</p>
                <div style="text-align: center; margin-top: 25px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/messenger" style="display: inline-block; padding: 12px 30px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Launch Messenger</a>
                </div>
              </div>
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
                This is an automated intelligence dispatch from the SR Mall Experience Desk Operations Hub.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send message Gmail notification:", err);
      }
    }

    revalidatePath("/public-view");
    revalidatePath("/admindashboard/messenger-hub");
    return { success: true, messageId: message.id, targetId: targetUser.id };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { success: false, error: "Failed to route message." };
  }
}
