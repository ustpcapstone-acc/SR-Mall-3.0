/**
 * "New message" notifications for chat, so a busy conversation doesn't flood
 * the notification list or the recipient's inbox:
 *
 *  - Messages to the admin side reach every admin (shared inbox).
 *  - One unread notification per conversation: a newer message replaces the
 *    older unread one instead of adding a row.
 *  - One email per burst: only for the first unread message of a conversation,
 *    and never while the recipient is in that chat right now.
 *
 * Server-only (called from chat actions inside `after()`).
 */
import { prisma } from "@srmall/database";
import { notify } from "./notify";

/** Recipient read the chat this recently → they're chatting live, skip the email. */
const ACTIVE_WINDOW_MS = 3 * 60 * 1000;

export async function notifyChatMessage(opts: {
  conversationId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  excerpt: string;
  subject: string;
}) {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: opts.recipientId },
      select: { id: true, role: true },
    });
    if (!recipient) return;
    const role = String(recipient.role || "").toUpperCase();

    const adminIds =
      role === "ADMIN"
        ? (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((a) => a.id)
        : [];
    const recipientIds = role === "ADMIN" ? adminIds.filter((id) => id !== opts.senderId) : [recipient.id];
    if (recipientIds.length === 0) return;

    const link =
      role === "ADMIN"
        ? `/admindashboard/messenger-hub?conversationId=${opts.conversationId}`
        : role === "TENANT"
          ? `/tenantdashboard/customer-messenger?conversationId=${opts.conversationId}`
          : opts.senderName === "SR Mall Admin"
            ? "/public-view?chat=open&recipient=admin"
            : `/public-view?chat=open&recipient=shop&shop=${encodeURIComponent(opts.senderName)}`;

    // Who gets an email: first unread message in this chat, and not chatting right now.
    // Same rule as the unread badges: the admin side's own replies don't count.
    const excludeSenders = role === "ADMIN" ? adminIds : [opts.recipientId];
    const state = await prisma.$queryRawUnsafe<{ userId: string; unread: number; lastReadAt: Date | null }[]>(
      `SELECT u AS "userId",
              (SELECT COUNT(*)::int FROM "Message" m
                WHERE m."conversationId" = $2 AND NOT (m."senderId" = ANY($3::text[]))
                  AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")) AS unread,
              r."lastReadAt"
         FROM unnest($1::text[]) AS u
         LEFT JOIN "ConversationRead" r ON r."userId" = u AND r."conversationId" = $2`,
      recipientIds,
      opts.conversationId,
      excludeSenders,
    );
    const now = Date.now();
    const emailIds = new Set(
      state
        .filter((s) => Number(s.unread) <= 1)
        .filter((s) => !s.lastReadAt || now - new Date(s.lastReadAt).getTime() > ACTIVE_WINDOW_MS)
        .map((s) => s.userId),
    );

    // Replace the previous unread notification for this chat (no pile-up).
    // (raw SQL: `link` is newer than the generated Prisma client)
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Notification"
        WHERE "userId" = ANY($1::text[]) AND "type" = 'MESSAGE' AND "isRead" = false AND "link" = $2`,
      recipientIds,
      link,
    );

    const message = `New message from ${opts.senderName}: "${opts.excerpt}"`;
    const withEmail = recipientIds.filter((id) => emailIds.has(id));
    const inAppOnly = recipientIds.filter((id) => !emailIds.has(id));
    const base = {
      title: `New message from ${opts.senderName}`,
      message,
      // Email: "💬 Demo Shop sent you a message" + the message quoted, "Reply to message" button.
      subject: `💬 ${opts.senderName} sent you a message`,
      emailMessage: `You have a new message on SR Mall. Open the chat to read the whole conversation and reply.`,
      quote: { author: opts.senderName, text: opts.excerpt },
      ctaLabel: "Reply to message",
      link,
    };
    await Promise.all([
      withEmail.length ? notify("MESSAGE", { ...base, recipients: withEmail }) : null,
      inAppOnly.length ? notify("MESSAGE", { ...base, recipients: inAppOnly, email: false }) : null,
    ]);
  } catch (error) {
    console.error("[notify-chat] failed:", error);
  }
}
