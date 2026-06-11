"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

export async function submitInquiryAction(data: {
  userId: string;
  eventType: string;
  eventDate: Date;
  eventTime: string;
  message?: string;
  imageUrl?: string;
  storageKey?: string;
}) {
  try {
    const inquiry = await prisma.eventInquiry.create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        message: data.message,
        imageUrl: data.imageUrl,
        storageKey: data.storageKey,
        status: "PENDING",
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (user && user.email) {
      try {
        const { sendMessage } = await import("./chat");
        await sendMessage({
          userId: user.email,
          recipientType: "admin",
          content: `I have submitted a new Event Inquiry for: ${data.eventType} on ${new Date(data.eventDate).toLocaleDateString()} at ${data.eventTime}.`,
        });
      } catch (err) {
        console.error("Failed to send notification message for inquiry:", err);
      }
    }

    // Create notifications for all admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin: any) => ({
          userId: admin.id,
          type: "NEW_BOOKING_INQUIRY",
          title: "Strategic Project Inquiry",
          message: `New masterpiece inquiry: ${data.eventType} planned for ${new Date(data.eventDate).toLocaleDateString()}.`,
        })),
      });

      // Send Gmail notification to Admin
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: process.env.GMAIL_USER || "jerickaradilla76@gmail.com",
          subject: "🚨 NEW STRATEGIC PROJECT INQUIRY",
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #be1e2d;">New Secure Reservation / Inquiry</h2>
              <p>A new event inquiry has been submitted through the SR Mall Secure Reservation portal.</p>
              <hr />
              <p><strong>Event Type:</strong> ${data.eventType}</p>
              <p><strong>Date:</strong> ${new Date(data.eventDate).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${data.eventTime}</p>
              <p><strong>Message:</strong> ${data.message || 'No additional message'}</p>
              <p><strong>Image attached:</strong> ${data.imageUrl ? 'Yes' : 'No'}</p>
              <p><strong>User ID:</strong> ${data.userId}</p>
              <hr />
              <p>Please log in to the admin dashboard to review and respond.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admindashboard/requests" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">View Inquiries</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send Gmail notification for inquiry:", err);
      }

      // Send Gmail notification to USER
      if (user && user.email) {
        try {
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail({
            to: user.email,
            subject: "Confirmation: Your SR Mall Strategic Inquiry",
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #be1e2d;">Inquiry Received</h2>
                <p>Hello ${user.name || "Valued Merchant"},</p>
                <p>Thank you for your interest in SR Mall. We have received your inquiry for a <strong>${data.eventType}</strong>.</p>
                <hr />
                <p><strong>Scheduled Date:</strong> ${new Date(data.eventDate).toLocaleDateString()}</p>
                <p><strong>Scheduled Time:</strong> ${data.eventTime}</p>
                <hr />
                <p>Our leasing and events team will review your request and get back to you within 12-24 hours. You can monitor the status of your inquiry in your account dashboard.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/messenger" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">Open Messenger</a>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send User Gmail notification for inquiry:", err);
        }
      }
    }

    revalidatePath("/admindashboard/requests");
    revalidatePath("/public-view");
    return { success: true, data: inquiry };
  } catch (error) {
    console.error("Failed to submit inquiry:", error);
    return { success: false, error: "Failed to submit inquiry" };
  }
}

export async function getInquiriesAction() {
  try {
    const inquiries = await prisma.eventInquiry.findMany({
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: inquiries };
  } catch (error) {
    console.error("Failed to get inquiries:", error);
    return { success: false, data: [] };
  }
}

export async function updateInquiryStatusAction(
  id: string,
  status: "ACCEPTED" | "REJECTED",
  feedback?: string,
) {
  try {
    const inquiry = await prisma.eventInquiry.update({
      where: { id },
      data: { status },
      include: { user: true },
    });

    // Create a message from Admin to User
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
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

    if (admin && inquiry.user) {
      let conversation = await prisma.conversation.findFirst({
        where: {
          type: "ADMIN",
          userId: inquiry.user.id,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            type: "ADMIN",
            userId: inquiry.user.id,
            targetId: admin.id,
          },
        });
      }

      const messageContent = `[Inquiry Status: ${status}] Your event: ${inquiry.eventType} on ${new Date(inquiry.eventDate).toLocaleDateString()} at ${inquiry.eventTime}. \n\n${feedback ? `Feedback from Admin: ${feedback}` : ""}`;

      await prisma.message.create({
        data: {
          content: messageContent,
          conversationId: conversation.id,
          senderId: admin.id,
        },
      });
    }

    // Gmail Notification to User about Approval/Rejection
    if (inquiry.user && inquiry.user.email) {
      try {
        const { sendGmail } = await import("@/lib/gmail");
        const isApproved = status === "ACCEPTED";
        
        await sendGmail({
          to: inquiry.user.email,
          subject: `Update on your SR Mall Inquiry: ${status}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: ${isApproved ? "#10b981" : "#be1e2d"};">Inquiry ${status}</h2>
              <p>Hello ${inquiry.user.name || "Valued Merchant"},</p>
              <p>Your inquiry for <strong>${inquiry.eventType}</strong> on ${new Date(inquiry.eventDate).toLocaleDateString()} has been <strong>${status.toLowerCase()}</strong> by the mall administration.</p>
              ${feedback ? `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${isApproved ? "#10b981" : "#be1e2d"};"><strong>Admin Feedback:</strong> ${feedback}</div>` : ""}
              <hr />
              <p>${isApproved ? "Our team will contact you shortly to finalize the details and logistics." : "If you have questions regarding this decision, please reach out to us via the mall messenger."}</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/messenger" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">View Message Thread</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send status update email:", err);
      }
    }

    revalidatePath("/admin/inquiry");
    return { success: true, data: inquiry };
  } catch (error) {
    console.error("Failed to update inquiry status:", error);
    return { success: false, error: "Failed to update inquiry" };
  }
}

export async function getApprovedEventsWithImagesAction() {
  try {
    const events = await prisma.eventInquiry.findMany({
      where: {
        status: "ACCEPTED",
        imageUrl: { not: null }
      },
      orderBy: {
        eventDate: "asc",
      },
    });
    return { success: true, data: events };
  } catch (error) {
    console.error("Failed to get approved events:", error);
    return { success: false, data: [] };
  }
}

export async function updateInquiryImageAction(
  id: string,
  imageUrl: string,
  storageKey?: string,
) {
  try {
    const inquiry = await prisma.eventInquiry.update({
      where: { id },
      data: {
        imageUrl,
        storageKey,
      },
    });
    
    revalidatePath("/public-view");
    return { success: true, data: inquiry };
  } catch (error) {
    console.error("Failed to update inquiry image:", error);
    return { success: false, error: "Failed to update inquiry image" };
  }
}

export async function updateEventInfoAction(
  id: string,
  fbAccount: string,
  contactNumber: string,
) {
  try {
    const inquiry = await prisma.eventInquiry.update({
      where: { id },
      data: {
        fbAccount,
        contactNumber,
      },
    });
    
    revalidatePath("/public-view");
    return { success: true, data: inquiry };
  } catch (error) {
    console.error("Failed to update event info:", error);
    return { success: false, error: "Failed to update event info" };
  }
}

export async function deleteInquiryAction(id: string) {
  try {
    const inquiry = await prisma.eventInquiry.findUnique({ where: { id } });
    if (inquiry && inquiry.storageKey) {
      try {
        const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
        const storageProvider = getCloudStorageProvider();
        await storageProvider.deleteFile(inquiry.storageKey);
      } catch (err) {
        console.error("Failed to delete image from storage:", err);
      }
    }

    await prisma.eventInquiry.delete({
      where: { id },
    });
    
    revalidatePath("/admin/inquiry");
    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete inquiry:", error);
    return { success: false, error: "Failed to delete inquiry" };
  }
}
