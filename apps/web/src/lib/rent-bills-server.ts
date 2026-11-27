/**
 * Server-only rent bill rules: preparing drafts, moving a lease when its bill
 * is paid or the payment is voided, and holding back removal.
 */
import { prisma, type Prisma } from "@srmall/database";
import { addDays, addMonths, daysUntil, type LeaseSettingsData } from "@/lib/leasing";
import { OPEN_BILL, isRentBill, sameDay, type BillPeriod } from "@/lib/rent-bills";

type Tx = Prisma.TransactionClient;

/** A rule that stops a payment or a bill, worded for staff. */
export class RentBillError extends Error {}

/**
 * A rent bill was paid: the lease is now paid through the end of its period.
 * Returns false when the lease has already ended (the date is left alone).
 */
export async function applyRentPayment(tx: Tx, bill: BillPeriod) {
  if (!isRentBill(bill)) return true;
  const lease = await tx.lease.findUnique({ where: { id: bill.leaseId }, select: { status: true, endDate: true } });
  if (!lease || lease.status !== "ACTIVE") return false;
  if (!sameDay(lease.endDate, bill.periodStart)) {
    throw new RentBillError(
      daysUntil(lease.endDate, new Date(bill.periodStart)) > 0
        ? "This lease is already paid for this period. Cancel this bill instead."
        : "An earlier period of this lease is still unpaid. Accept that payment first.",
    );
  }
  const moved = await tx.lease.updateMany({
    where: { id: bill.leaseId, status: "ACTIVE", endDate: lease.endDate },
    data: { endDate: new Date(bill.periodEnd), noticesSent: [] },
  });
  if (!moved.count) throw new RentBillError("Someone just updated this lease. Close this and try again.");
  return true;
}

/**
 * A rent payment was voided: the lease goes back to being paid through the
 * start of that period. Only the latest paid period can be voided.
 */
export async function reverseRentPayment(tx: Tx, bill: BillPeriod) {
  if (!isRentBill(bill)) return;
  const lease = await tx.lease.findUnique({ where: { id: bill.leaseId }, select: { status: true, endDate: true } });
  if (!lease || lease.status !== "ACTIVE") return;
  if (daysUntil(lease.endDate, new Date(bill.periodEnd)) > 0) {
    throw new RentBillError("A later period of this lease is already paid. Void that payment first.");
  }
  if (!sameDay(lease.endDate, bill.periodEnd)) return;
  const moved = await tx.lease.updateMany({
    where: { id: bill.leaseId, status: "ACTIVE", endDate: lease.endDate },
    data: { endDate: new Date(bill.periodStart), noticesSent: [] },
  });
  if (!moved.count) throw new RentBillError("Someone just updated this lease. Close this and try again.");
}

/**
 * Prepare a draft for every lease nearing its paid-through date that has no
 * bill for the coming period. Safe to run any number of times.
 */
export async function ensureRentDrafts(settings: LeaseSettingsData, now: Date = new Date()) {
  const leases = await prisma.lease.findMany({
    where: { status: "ACTIVE", endDate: { lte: addDays(now, settings.billDaysBefore + 1) } },
    select: {
      id: true,
      tenantId: true,
      unitId: true,
      endDate: true,
      monthlyRent: true,
      invoices: { where: { status: { not: "VOID" }, periodStart: { not: null } }, select: { status: true, periodStart: true } },
    },
  });
  const due = leases.filter(
    (l) =>
      daysUntil(l.endDate, now) <= settings.billDaysBefore &&
      l.monthlyRent > 0 &&
      // Already billed: an open or paid invoice starts on that day.
      !l.invoices.some((i) => OPEN_BILL.concat("PAID").includes(i.status) && sameDay(i.periodStart!, l.endDate)),
  );

  // Unsent drafts that no longer match their lease (paid elsewhere, or ended).
  const waiting = await prisma.rentDraft.findMany({
    where: { status: "PENDING" },
    select: { id: true, periodStart: true, lease: { select: { status: true, endDate: true } } },
  });
  const stale = waiting.filter((d) => d.lease.status !== "ACTIVE" || !sameDay(d.lease.endDate, d.periodStart));
  if (stale.length) await prisma.rentDraft.deleteMany({ where: { id: { in: stale.map((d) => d.id) }, status: "PENDING" } });

  if (!due.length) return 0;
  const made = await prisma.rentDraft.createMany({
    data: due.map((l) => ({
      leaseId: l.id,
      tenantId: l.tenantId,
      unitId: l.unitId,
      periodStart: l.endDate,
      periodEnd: addMonths(l.endDate, 1),
      amount: l.monthlyRent,
    })),
    skipDuplicates: true,
  });
  return made.count;
}

/**
 * Why a lease past its grace period must not be ended yet: a deposit slip is
 * waiting to be checked, or a payment was just voided and may be re-entered.
 */
export async function removalHold(leaseId: string, settings: LeaseSettingsData, now: Date = new Date()) {
  const invoices = await prisma.invoice.findMany({ where: { leaseId }, select: { id: true, status: true } });
  if (invoices.some((i) => i.status === "REVIEWING")) return "a deposit slip is waiting to be checked";
  if (!invoices.length) return null;
  const voided = await prisma.paymentLog.count({
    where: {
      invoiceId: { in: invoices.map((i) => i.id) },
      action: "VOIDED",
      createdAt: { gte: addDays(now, -Math.max(settings.graceDays, 1)) },
    },
  });
  return voided ? "a payment was recently voided" : null;
}

/** Superusers and staff who handle payments. */
export async function paymentStaffIds() {
  const staff = await prisma.user.findMany({
    where: { role: "ADMIN", OR: [{ isSuperuser: true }, { staffRole: { permissions: { has: "payments" } } }] },
    select: { id: true },
  });
  return staff.map((u) => u.id);
}
