const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config({ path: './apps/web/.env' });

const prisma = new PrismaClient();

async function sendGmail(options) {
  const { to, cc, subject, text, html } = options;
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (user && appPassword) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: appPassword,
      },
    });

    await transporter.sendMail({
      from: `"SR Mall" <${user}>`,
      to,
      cc,
      subject,
      text,
      html,
    });
    return { success: true, method: 'AppPassword' };
  }
  throw new Error("No valid Gmail credentials found (App Password).");
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingInvoices = await prisma.invoice.findMany({
    where: { status: "PENDING" },
    include: { tenant: { include: { user: true } } },
  });

  let emailsSent = 0;
  let chatsSent = 0;
  let notificationsSent = 0;

  for (const invoice of pendingInvoices) {
    if (!invoice.tenant?.user) continue;

    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays !== 10 && diffDays !== 5 && diffDays !== 3 && diffDays !== 1 && diffDays !== -1) {
      continue;
    }

    let emailSubject = "";
    let messageContent = "";

    if (diffDays === 10 || diffDays === 5 || diffDays === 3 || diffDays === 1) {
      emailSubject = `Reminder: Monthly Bill Due in ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
      messageContent = `Hello ${invoice.tenant.user.name || "Sir/Ma'am"}, please don't forget your balance of ₱${invoice.amount} for the month of ${invoice.month}. It is due on ${dueDate.toLocaleDateString()}.`;
    } else if (diffDays === -1) {
      emailSubject = `URGENT WARNING: Payment Overdue`;
      messageContent = `Hello ${invoice.tenant.user.name || "Sir/Ma'am"}, your payment of ₱${invoice.amount} for the month of ${invoice.month} is currently DELAYED by 1 day. Please settle your balance immediately to avoid penalties.`;
    }

    const tenantId = invoice.tenant.user.id;
    const tenantEmail = invoice.tenant.user.email;

    // 1. Create In-App Notification
    await prisma.notification.create({
      data: {
        userId: tenantId,
        type: "BILLING_REMINDER",
        title: diffDays === -1 ? "Overdue Warning" : "Billing Reminder",
        message: messageContent,
      },
    });
    notificationsSent++;

    // 2. Send Automated Chat via Messenger Hub
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      let conversation = await prisma.conversation.findFirst({
        where: { type: "ADMIN", userId: tenantId },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { type: "ADMIN", userId: tenantId, targetId: admin.id },
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

    // 3. Send Gmail
    if (tenantEmail) {
      await sendGmail({
        to: tenantEmail,
        cc: "srmall@admin.com", // This will also send an email to admin
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
          </div>
        `,
      });
      emailsSent++;
    }
  }

  console.log({ success: true, stats: { notificationsSent, chatsSent, emailsSent } });
}

main().catch(console.error).finally(() => prisma.$disconnect());
