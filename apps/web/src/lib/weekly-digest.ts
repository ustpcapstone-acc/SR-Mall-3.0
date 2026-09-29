import { prisma } from "@srmall/database";
import { notify } from "./notify";

/**
 * Weekly operations digest — the "System Health Manifest" alert.
 *
 * Disabled by default in the catalogue, so it only reaches admins who switch
 * it on in Profile Settings → Notifications. `dedupeHours: 168` guarantees a
 * single digest per week even if the cron fires more than once.
 */
export async function runWeeklyDigest() {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      newTenants,
      paidInvoices,
      openInvoices,
      overdueInvoices,
      pendingPromos,
      pendingInquiries,
      reservedSlots,
      newUsers,
      openReviews,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.invoice.count({ where: { status: "PAID" } }),
      prisma.invoice.count({
        where: { status: { in: ["PENDING", "REVIEWING"] } },
      }),
      prisma.invoice.count({ where: { status: { in: ["OVERDUE"] } } }),
      prisma.tenantPromo.count({ where: { status: "PENDING" } }),
      prisma.eventInquiry.count({ where: { status: "PENDING" } }),
      prisma.areaSlot.count({ where: { status: "RESERVED" } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.review.count({ where: { isApproved: false, isSpam: false } }),
    ]);

    const message = [
      `Tenants: ${totalTenants} onboarded, ${newTenants} added this week.`,
      `Payments: ${paidInvoices} settled, ${openInvoices} open, ${overdueInvoices} overdue.`,
      `Queue: ${pendingPromos} promo submission(s), ${pendingInquiries} event inquiry(ies), ${openReviews} review(s) awaiting approval.`,
      `Spaces: ${reservedSlots} unit(s) currently reserved.`,
      `Accounts: ${newUsers} new registration(s) in the last 7 days.`,
    ].join("\n");

    return await notify("SYSTEM_HEALTH_REPORTS", {
      title: "Weekly Operations Digest",
      message,
      link: "/admindashboard",
      dedupeHours: 168,
    });
  } catch (error) {
    console.error("[weekly-digest] failed:", error);
    return { created: 0, emailed: 0, recipients: 0 };
  }
}
