import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { emailBaseUrl } from "@/utils/get-base-url";
import { notify, resolveChannels } from "@/lib/notify";

export async function GET(req: Request) {
  try {
    // Note: In production, you should secure this endpoint so only Vercel Cron or authorized agents can call it.
    // e.g., if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse('Unauthorized', { status: 401 });

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    // Fetch all pending invoices
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        status: "PENDING",
        // Former tenants aren't chased by the daily reminders.
        tenant: { status: "ACTIVE" },
      },
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    let emailsSent = 0;
    let chatsSent = 0;
    let notificationsSent = 0;

    for (const invoice of pendingInvoices) {
      if (!invoice.tenant?.user) continue;

      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0); // Normalize

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Determine what kind of reminder to send
      let reminderType = "";
      let emailSubject = "";
      let messageContent = "";

      if (diffDays === 10 || diffDays === 5 || diffDays === 3 || diffDays === 1) {
        reminderType = `REMINDER_${diffDays}_DAYS`;
        emailSubject = `Reminder: Monthly Bill Due in ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
        messageContent = `Hello ${invoice.tenant.user.name || "Sir/Ma'am"}, please don't forget your balance of ₱${invoice.amount} for the month of ${invoice.month}. It is due on ${dueDate.toLocaleDateString()}.`;
      } else if (diffDays === -1) {
        reminderType = "OVERDUE_WARNING";
        emailSubject = `URGENT WARNING: Payment Overdue`;
        messageContent = `Hello ${invoice.tenant.user.name || "Sir/Ma'am"}, your payment of ₱${invoice.amount} for the month of ${invoice.month} is currently DELAYED by 1 day. Please settle your balance immediately to avoid penalties.`;
      } else {
        // Not a target day, skip
        continue;
      }

      const tenantId = invoice.tenant.user.id;
      const tenantEmail = invoice.tenant.user.email;
      const isOverdue = diffDays < 0;

      // 1. In-App Notification — governed by the tenant's own preferences.
      //    Overdue uses the OVERDUE_RENT_PAYMENTS alert so the
      //    "Fiscal Delinquency Tracking" toggle actually applies to it.
      await notify(isOverdue ? "OVERDUE_RENT_PAYMENTS" : "BILLING_REMINDER", {
        recipients: [tenantId],
        title: isOverdue ? "Overdue Warning" : "Billing Reminder",
        message: messageContent,
        link: "/tenantdashboard/lease-payments",
        email: false, // the bespoke email below is still sent, but gated below
      });
      notificationsSent++;

      // 2. Send Automated Chat via Messenger Hub
      try {
        let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
        if (admin) {
          let conversation = await prisma.conversation.findFirst({
            where: {
              type: "ADMIN",
              userId: tenantId,
            },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                type: "ADMIN",
                userId: tenantId,
                targetId: admin.id,
              },
            });
          }

          await prisma.message.create({
            data: {
              content: messageContent,
              conversationId: conversation.id,
              senderId: admin.id,
            },
          });
          chatsSent++;
        }
      } catch (err) {
        console.error("Failed to send automated chat:", err);
      }

      // 3. Send Gmail — only for tenants who chose the EMAIL channel
      const prefs = await resolveChannels(
        isOverdue ? "OVERDUE_RENT_PAYMENTS" : "BILLING_REMINDER",
        [tenantId],
      );
      const wantsEmail =
        prefs[tenantId]?.enabled &&
        prefs[tenantId]?.channels.includes("EMAIL");

      if (tenantEmail && wantsEmail) {
        try {
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail({
            to: tenantEmail,
            cc: "ustpcapstone@gmail.com",
            subject: emailSubject,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                <h2 style="color: ${diffDays < 0 ? "#be1e2d" : "#0f172a"};">SR Mall Billing System</h2>
                <p style="font-size: 16px; color: #334155;">Hello <strong>${invoice.tenant.user.name || "Merchant"}</strong>,</p>
                <div style="background-color: ${diffDays < 0 ? "#fff1f2" : "#f8fafc"}; border-left: 4px solid ${diffDays < 0 ? "#be1e2d" : "#3b82f6"}; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 15px;">${messageContent}</p>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                <p><strong>Amount Due:</strong> ₱${invoice.amount}</p>
                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                <div style="text-align: center; margin-top: 25px;">
                  <a href="${emailBaseUrl()}/tenantdashboard/lease-payments" style="display: inline-block; padding: 12px 25px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Pay Now</a>
                </div>
              </div>
            `,
          });
          emailsSent++;
        } catch (err) {
          console.error("Failed to send Gmail reminder:", err);
        }
      }
    }

    // 💰 One daily rollup for admins instead of one ping per overdue tenant
    try {
      const overdueCount = await prisma.invoice.count({
        where: {
          status: { not: "PAID" },
          dueDate: { lt: today },
          tenant: { status: "ACTIVE" },
        },
      });

      if (overdueCount > 0) {
        await notify("OVERDUE_RENT_PAYMENTS", {
          roles: ["ADMIN"],
          title: "Daily Overdue Rent Rollup",
          message: `${overdueCount} invoice${
            overdueCount === 1 ? " is" : "s are"
          } past their due date. Open Tenant Monitoring to chase payments.`,
          link: "/admindashboard/tenant-monitoring",
          dedupeHours: 20,
        });
      }
    } catch (err) {
      console.error("Failed to send overdue rollup:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Automated billing reminders processed successfully.",
      stats: { notificationsSent, chatsSent, emailsSent },
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
