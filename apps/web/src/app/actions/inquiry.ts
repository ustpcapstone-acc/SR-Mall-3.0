"use server";

import { prisma } from "@srmall/database";
import { safeUserSelect } from "@/lib/user-select";
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

    // ⚡ New inquiry → every admin, routed through notify() so each admin's
    // own alert preferences (and in-app / email channels) are honoured.
    const { notify } = await import("@/lib/notify");
    await notify("NEW_BOOKING_INQUIRY", {
      title: "Strategic Project Inquiry",
      message: `New inquiry: ${data.eventType} planned for ${new Date(
        data.eventDate,
      ).toLocaleDateString()} at ${data.eventTime}.${
        data.message ? ` Message: ${data.message}` : ""
      }`,
      link: "/admindashboard/bookings?tab=event",
    });

    // Transactional confirmation to the person who submitted the inquiry
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
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/public-view?recipient=admin" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">Open Messenger</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send User Gmail notification for inquiry:", err);
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
    // Expiry sweeps run in the background after this response (throttled),
    // so the admin never waits on auto-reject writes and emails.
    const { scheduleSweeps } = await import("@/lib/sweeps");
    scheduleSweeps();

    const inquiries = await prisma.eventInquiry.findMany({
      include: {
        user: { select: safeUserSelect },
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
      include: { user: { select: safeUserSelect } },
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
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/public-view?recipient=admin" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">View Message Thread</a>
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

/**
 * Auto-reject rule: an Event Booking that is still PENDING 72 hours (3 days)
 * after submission is rejected automatically.
 *
 * - The countdown uses the submission timestamp (`createdAt`), so eligibility
 *   is `createdAt <= now - 72h` — a record is never rejected before 72h.
 * - Only `PENDING` rows are touched; Approved / Rejected / Cancelled /
 *   completed records are never affected.
 * - The flip is guarded with `updateMany({ status: "PENDING" })`, so a record
 *   an admin decided on between the scan and the write is left alone.
 * - Rejection goes through the existing `updateInquiryStatusAction`, which is
 *   the same path the admin button uses: same message thread + same email.
 * - Once rejected the status stays REJECTED unless an admin changes it
 *   through the existing authorised action.
 */
const AUTO_REJECT_REASON =
  "This booking was automatically rejected because it remained pending for more than 72 hours (3 days) without a review.";

export async function processExpiredEventBookingsAction() {
  try {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const expired = await prisma.eventInquiry.findMany({
      where: { status: "PENDING", createdAt: { lte: cutoff } },
      select: { id: true },
    });

    let rejected = 0;
    for (const { id } of expired) {
      const flipped = await prisma.eventInquiry.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      if (flipped.count === 0) continue; // already decided by an admin

      // Existing rejection flow: message thread + email, no new UI.
      await updateInquiryStatusAction(id, "REJECTED", AUTO_REJECT_REASON);
      rejected++;
    }

    if (rejected > 0) {
      console.log(
        `[AUTO-REJECT] ${rejected} event booking(s) rejected after 72h.`,
      );
    }
    return { success: true, rejected, scanned: expired.length };
  } catch (error) {
    console.error("Failed to auto-reject expired event bookings:", error);
    return { success: false, rejected: 0, scanned: 0 };
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
