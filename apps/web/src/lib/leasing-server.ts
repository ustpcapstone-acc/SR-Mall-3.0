/**
 * Server-only leasing helpers: settings, e-invoices, ending a lease and the
 * daily renewal sweep. Used by actions/leasing.ts and the lease cron.
 */
import { randomBytes } from "crypto";
import { prisma, type Prisma } from "@srmall/database";
import { notify } from "@/lib/notify";
import { formatPHDate } from "@/lib/ph-date";
import {
  DEFAULT_LEASE_SETTINGS,
  addDays,
  addMonths,
  daysUntil,
  graceEndDate,
  peso,
  type InvoiceLine,
  type LeaseSettingsData,
} from "@/lib/leasing";

type Tx = Prisma.TransactionClient;

export async function getLeaseSettings(): Promise<LeaseSettingsData> {
  const row = await prisma.leaseSettings.findUnique({ where: { id: "singleton" } });
  if (!row) return DEFAULT_LEASE_SETTINGS;
  return { reminderDays: row.reminderDays, graceDays: row.graceDays, finalWarningDays: row.finalWarningDays };
}

function invoiceNumber(now = new Date()) {
  const ymd = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type PaymentInput = {
  months: number;
  amount: number;
  paidAt: Date;
  method: string;
  referenceNo?: string | null;
};

/** A paid e-invoice for `months` of rent starting at `periodStart`. */
export async function createPaidInvoice(
  tx: Tx,
  p: PaymentInput & { tenantId: string; leaseId: string; unitId: string; monthlyRent: number; periodStart: Date; kind: "New lease" | "Renewal" },
) {
  const periodEnd = addMonths(p.periodStart, p.months);
  const subtotal = Math.round(p.monthlyRent * p.months * 100) / 100;
  const lines: InvoiceLine[] = [
    {
      description: `${p.kind}: rent for Unit ${p.unitId}, ${formatPHDate(p.periodStart)} to ${formatPHDate(addDays(periodEnd, -1))}`,
      quantity: p.months,
      unitPrice: p.monthlyRent,
      amount: subtotal,
    },
  ];
  const diff = Math.round((p.amount - subtotal) * 100) / 100;
  if (diff !== 0) {
    lines.push({ description: diff > 0 ? "Other charges" : "Discount", quantity: 1, unitPrice: diff, amount: diff });
  }
  const month =
    p.months === 1
      ? new Date(p.periodStart).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" })
      : `${formatPHDate(p.periodStart)} to ${formatPHDate(addDays(periodEnd, -1))}`;

  return tx.invoice.create({
    data: {
      invoiceNumber: invoiceNumber(),
      tenantId: p.tenantId,
      leaseId: p.leaseId,
      unitId: p.unitId,
      month,
      amount: p.amount,
      status: "PAID",
      dueDate: p.periodStart,
      paidAt: p.paidAt,
      periodStart: p.periodStart,
      periodEnd,
      lineItems: lines,
      paymentMethod: p.method,
      referenceNo: p.referenceNo || null,
      description: `${p.kind}, Unit ${p.unitId}, ${p.months} month${p.months === 1 ? "" : "s"}`,
    },
    select: { id: true, invoiceNumber: true, amount: true },
  });
}

/** Tell the tenant their e-invoice is ready (bell plus an email receipt). */
export async function sendInvoiceNotice(userId: string, inv: { invoiceNumber: string; amount: number }, unitId: string) {
  const title = `E-invoice ${inv.invoiceNumber}`;
  const message = `Payment of ${peso(inv.amount)} for Unit ${unitId} was received. Your e-invoice is ready to download.`;
  const link = "/tenantdashboard/rent-a-space";
  await notify("INVOICE_ISSUED", { recipients: [userId], unitId, title, message, link, email: false });
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    const [{ sendGmail }, { buildNotificationEmail, buildNotificationText }, { emailBaseUrl }] = await Promise.all([
      import("@/lib/gmail"),
      import("@/lib/email-template"),
      import("@/utils/get-base-url"),
    ]);
    const base = emailBaseUrl();
    const email = { eyebrow: "E-invoice", title, message, link: `${base}${link}`, ctaLabel: "View e-invoice", siteUrl: base };
    await sendGmail({ to: user.email, subject: title, html: buildNotificationEmail(email), text: buildNotificationText(email) });
  } catch (e) {
    console.error("[leasing] invoice email failed:", e);
  }
}

/**
 * Point Tenant.unitId at one of the tenant's active spaces (older screens still
 * read it), or back to PENDING_ASSIGNMENT when they have none.
 */
export async function syncTenantUnit(tx: Tx, tenantId: string) {
  const lease = await tx.lease.findFirst({
    where: { tenantId, status: "ACTIVE" },
    orderBy: { startDate: "asc" },
    select: { unitId: true },
  });
  // Leave suspended / past tenants' status alone.
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  const managed = tenant?.status === "ACTIVE" || tenant?.status === "PENDING";
  await tx.tenant.update({
    where: { id: tenantId },
    data: lease
      ? { unitId: lease.unitId, ...(managed && { status: "ACTIVE" }) }
      : { unitId: "PENDING_ASSIGNMENT", isOpen: false, ...(managed && { status: "PENDING" }) },
  });
}

/**
 * Older screens (Tenant Monitoring, User Management, Space Manager) can free a
 * space or offboard a tenant without going through Leasing. End those leases
 * quietly so the renewal sweep never chases or removes them.
 */
export async function reconcileLeases() {
  return prisma.$executeRawUnsafe(`
    UPDATE "Lease" l SET "status" = 'ENDED', "endedAt" = NOW(), "updatedAt" = NOW(),
           "endReason" = 'Space released outside Leasing'
      FROM "Tenant" t
     WHERE l."tenantId" = t."id" AND l."status" = 'ACTIVE'
       AND (t."status" IN ('PAST', 'REJECTED', 'REMOVED')
            OR NOT EXISTS (SELECT 1 FROM "AreaSlot" s WHERE s."unit_id" = l."unitId" AND s."status" = 'OCCUPIED'))`);
}

/** End a lease and free its space. Returns false if it was already ended. */
export async function endLease(leaseId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const ended = await tx.lease.updateMany({
      where: { id: leaseId, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date(), endReason: reason },
    });
    if (!ended.count) return false;
    const lease = await tx.lease.findUniqueOrThrow({ where: { id: leaseId }, select: { tenantId: true, unitId: true } });
    await tx.areaSlot.updateMany({
      where: { unit_id: lease.unitId, status: "OCCUPIED" },
      data: { status: "AVAILABLE", tenant_id: null },
    });
    await syncTenantUnit(tx, lease.tenantId);
    return true;
  });
}

/**
 * Daily renewal sweep: reminders before the due date, the due-day notice,
 * grace-period notices, and removal once grace runs out. Each notice is sent
 * once per due date (Lease.noticesSent is cleared when the lease is renewed).
 */
export async function runRenewalSweep(now: Date = new Date()) {
  await reconcileLeases();
  const s = await getLeaseSettings();
  const horizon = addDays(now, Math.max(...s.reminderDays, 0) + 1);
  const leases = await prisma.lease.findMany({
    where: { status: "ACTIVE", endDate: { lte: horizon } },
    include: { tenant: { select: { shopName: true, userId: true } } },
  });

  const out = { checked: leases.length, notices: 0, removed: 0 };
  for (const lease of leases) {
    const days = daysUntil(lease.endDate, now);
    const sent = new Set(lease.noticesSent);
    const due = formatPHDate(lease.endDate);
    const graceEnd = formatPHDate(graceEndDate(lease.endDate, s));
    const who = `${lease.tenant.shopName} (Unit ${lease.unitId})`;
    const tenantLink = "/tenantdashboard/rent-a-space";
    const adminLink = "/admindashboard/renewals";
    let notice: { key: string; tenant: [string, string]; admin?: [string, string] } | null = null;

    if (days < -s.graceDays) {
      // Grace is over: remove the tenant from the space.
      if (await endLease(lease.id, "Not renewed by the end of the grace period")) {
        out.removed++;
        await notify("EXPIRING_CONTRACTS", {
          recipients: [lease.tenant.userId],
          title: `Removed from Unit ${lease.unitId}`,
          message: `Rent for Unit ${lease.unitId} was due ${due} and the grace period ended ${graceEnd}. Your lease has ended and the space is available again. Contact the management office if this is a mistake.`,
          link: tenantLink,
        });
        await notify("EXPIRING_CONTRACTS", {
          roles: ["ADMIN"],
          title: `Lease ended: Unit ${lease.unitId}`,
          message: `${who} did not renew by ${graceEnd}. The tenant was removed and the space is available.`,
          link: adminLink,
          email: false,
        });
      }
      continue;
    } else if (days < 0) {
      // Removal happens on day -(graceDays + 1); the final warning comes
      // finalWarningDays before that (0 turns it off).
      const finalDay = -(s.graceDays + 1 - s.finalWarningDays);
      if (s.finalWarningDays > 0 && days <= finalDay && !sent.has("FINAL")) {
        notice = {
          key: "FINAL",
          tenant: [`Final notice: Unit ${lease.unitId}`, `Rent for Unit ${lease.unitId} is past due. Pay at the management office by ${graceEnd} or you will be removed from the space.`],
          admin: [`Final notice sent: Unit ${lease.unitId}`, `${who} has until ${graceEnd} to renew before removal.`],
        };
      } else if (!sent.has("GRACE")) {
        notice = {
          key: "GRACE",
          tenant: [`Grace period started: Unit ${lease.unitId}`, `Rent for Unit ${lease.unitId} was due ${due}. You have until ${graceEnd} to pay at the management office.`],
          admin: [`In grace period: Unit ${lease.unitId}`, `${who} missed the ${due} due date. Grace period ends ${graceEnd}.`],
        };
      }
    } else if (days === 0 && !sent.has("DUE")) {
      notice = {
        key: "DUE",
        tenant: [`Rent due today: Unit ${lease.unitId}`, `Rent for Unit ${lease.unitId} is due today (${due}). Pay at the management office to renew your lease.`],
        admin: [`Renewal due today: Unit ${lease.unitId}`, `${who} is due for renewal today.`],
      };
    } else if (days > 0) {
      // The nearest reminder mark we've reached and not yet sent.
      const mark = [...s.reminderDays].sort((a, b) => a - b).find((d) => days <= d);
      if (mark !== undefined && !sent.has(`REMIND_${mark}`)) {
        notice = {
          key: `REMIND_${mark}`,
          tenant: [`Rent due in ${days} day${days === 1 ? "" : "s"}: Unit ${lease.unitId}`, `Rent for Unit ${lease.unitId} is due ${due}. Pay at the management office to renew your lease.`],
        };
        // Larger marks we skipped (e.g. the cron didn't run) count as sent.
        s.reminderDays.filter((d) => d > mark).forEach((d) => sent.add(`REMIND_${d}`));
      }
    }

    if (!notice) continue;
    sent.add(notice.key);
    if (notice.key === "FINAL") sent.add("GRACE");
    await prisma.lease.update({ where: { id: lease.id }, data: { noticesSent: [...sent] } });
    await notify("EXPIRING_CONTRACTS", {
      recipients: [lease.tenant.userId],
      unitId: lease.unitId,
      title: notice.tenant[0],
      message: notice.tenant[1],
      link: tenantLink,
    });
    if (notice.admin) {
      await notify("EXPIRING_CONTRACTS", { roles: ["ADMIN"], title: notice.admin[0], message: notice.admin[1], link: adminLink, email: false });
    }
    out.notices++;
  }
  return out;
}
