"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@srmall/database";
import { requireStaffAny } from "@/lib/action-guard";
import { AccessDenied } from "@/lib/auth-server";
import { invoiceNumber, getLeaseSettings } from "@/lib/leasing-server";
import { PAYMENT_STAFF, logPayment, staffActor } from "@/lib/payments-server";
import { RentBillError, ensureRentDrafts } from "@/lib/rent-bills-server";
import { OPEN_BILL, billTotal, checkCharges, isRentBill, sameDay, type ExtraCharge } from "@/lib/rent-bills";
import { REASON_LIMITS } from "@/lib/payments";
import { addDays, peso, type InvoiceLine } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { notify } from "@/lib/notify";
import { sendNotifyEmail } from "@/lib/notify-email";

type Result = { success: true } | { success: false; error: string };

/** A rent bill draft as the review list shows it. */
export type RentDraftRow = {
  id: string;
  unitId: string;
  shopName: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  /** Who skipped it, when it is in the skipped list. */
  skippedBy: string | null;
};

function failed(e: unknown, fallback: string): Result {
  if (e instanceof AccessDenied || e instanceof RentBillError) return { success: false, error: e.message };
  console.error("[RENT_BILL]", e);
  return { success: false, error: fallback };
}

function refresh() {
  revalidatePath("/admindashboard/payments");
  revalidatePath("/admindashboard/tenant-monitoring");
  revalidatePath("/admindashboard/renewals");
  revalidatePath("/tenantdashboard/payments");
}

/** Drafts waiting for review, and those skipped for a period still unpaid. */
export async function getBillsToReviewAction() {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const settings = await getLeaseSettings();
    // Opening the screen catches up if the daily job hasn't run.
    await ensureRentDrafts(settings);
    const drafts = await prisma.rentDraft.findMany({
      where: { status: { in: ["PENDING", "SKIPPED"] }, lease: { status: "ACTIVE" } },
      orderBy: [{ periodStart: "asc" }, { unitId: "asc" }],
      include: { lease: { select: { endDate: true, shopId: true, tenant: { select: { shopName: true } } } } },
    });
    const shopIds = drafts.map((d) => d.lease.shopId).filter((id): id is string => !!id);
    const shops = shopIds.length
      ? await prisma.unitShop.findMany({ where: { id: { in: shopIds } }, select: { id: true, shopName: true } })
      : [];
    const row = (d: (typeof drafts)[number]): RentDraftRow => ({
      id: d.id,
      unitId: d.unitId,
      shopName: shops.find((s) => s.id === d.lease.shopId)?.shopName || d.lease.tenant.shopName || "New shop",
      periodStart: d.periodStart.toISOString(),
      periodEnd: d.periodEnd.toISOString(),
      amount: d.amount,
      skippedBy: d.status === "SKIPPED" ? (d.decidedByName ?? "staff") : null,
    });
    // A draft only matters while its period is the lease's next one.
    const current = drafts.filter((d) => sameDay(d.lease.endDate, d.periodStart));
    return {
      success: true as const,
      data: {
        daysBefore: settings.billDaysBefore,
        pending: current.filter((d) => d.status === "PENDING").map(row),
        skipped: current.filter((d) => d.status === "SKIPPED").map(row),
      },
    };
  } catch (e) {
    console.error("[RENT_BILL]", e);
    return { success: false as const, error: e instanceof AccessDenied ? e.message : "Couldn't load the bills to review." };
  }
}

/** Turn a reviewed draft into a bill the tenant can see and pay. */
export async function sendRentBillAction(draftId: string, extra?: ExtraCharge[]): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const charges = checkCharges(extra);
    if (typeof charges === "string") return { success: false, error: charges };
    const by = await staffActor(staff.id);

    const sent = await prisma.$transaction(async (tx) => {
      const draft = await tx.rentDraft.findUnique({
        where: { id: String(draftId) },
        include: { lease: { select: { status: true, endDate: true, tenant: { select: { userId: true, shopName: true } } } } },
      });
      if (!draft) throw new RentBillError("This draft no longer exists. Refresh the list.");
      if (draft.lease.status !== "ACTIVE" || !sameDay(draft.lease.endDate, draft.periodStart)) {
        throw new RentBillError("This lease has changed since the draft was made. Refresh the list.");
      }
      // Claimed first, so two people can't send the same bill.
      const claimed = await tx.rentDraft.updateMany({
        where: { id: draft.id, status: "PENDING" },
        data: { status: "SENT", decidedById: by.id, decidedByName: by.name, decidedAt: new Date() },
      });
      if (!claimed.count) throw new RentBillError("This bill was already sent or skipped.");
      const billed = await tx.invoice.findMany({
        where: { leaseId: draft.leaseId, status: { in: [...OPEN_BILL, "PAID"] }, periodStart: { not: null } },
        select: { periodStart: true },
      });
      if (billed.some((i) => sameDay(i.periodStart!, draft.periodStart))) {
        throw new RentBillError("This period already has a bill.");
      }

      const period = `${formatPHDate(draft.periodStart)} to ${formatPHDate(addDays(draft.periodEnd, -1))}`;
      const lines: InvoiceLine[] = [
        { description: `Rent for Unit ${draft.unitId}, ${period}`, quantity: 1, unitPrice: draft.amount, amount: draft.amount },
        ...charges.map((c) => ({ description: c.description, quantity: 1, unitPrice: c.amount, amount: c.amount })),
      ];
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: invoiceNumber(),
          tenantId: draft.tenantId,
          leaseId: draft.leaseId,
          unitId: draft.unitId,
          month: new Date(draft.periodStart).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" }),
          amount: billTotal(draft.amount, charges),
          status: "PENDING",
          dueDate: draft.periodStart,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          lineItems: lines,
          description: `Monthly rent, Unit ${draft.unitId}`,
        },
      });
      await tx.rentDraft.update({ where: { id: draft.id }, data: { invoiceId: invoice.id } });
      await logPayment(tx, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        tenantId: invoice.tenantId,
        action: "BILL_SENT",
        amount: invoice.amount,
        by,
      });
      return { invoice, tenant: draft.lease.tenant, unitId: draft.unitId };
    });

    const { invoice, tenant, unitId } = sent;
    await notify("INVOICE_ISSUED", {
      recipients: [tenant.userId],
      unitId,
      title: `New bill · ${invoice.month}`,
      message: `${invoice.invoiceNumber} for ${peso(invoice.amount)} is due ${formatPHDate(invoice.dueDate)}.`,
      link: "/tenantdashboard/payments",
      email: false,
    });
    const user = await prisma.user.findUnique({ where: { id: tenant.userId }, select: { email: true } });
    if (user?.email) {
      const email = user.email;
      after(() =>
        sendNotifyEmail({
          type: "BILL_POSTED",
          email,
          data: { unitId, shopName: tenant.shopName, amount: invoice.amount, month: invoice.month },
        }).catch((err: any) => console.error("Failed to dispatch bill posted email:", err)),
      );
    }
    refresh();
    return { success: true };
  } catch (e) {
    return failed(e, "Couldn't send the bill.");
  }
}

/** Skip a period (the tenant is settling it another way), or bring it back. */
export async function skipRentBillAction(draftId: string, skip: boolean): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const by = await staffActor(staff.id);
    const done = await prisma.rentDraft.updateMany({
      where: { id: String(draftId), status: skip ? "PENDING" : "SKIPPED" },
      data: skip
        ? { status: "SKIPPED", decidedById: by.id, decidedByName: by.name, decidedAt: new Date() }
        : { status: "PENDING", decidedById: null, decidedByName: null, decidedAt: null },
    });
    if (!done.count) return { success: false, error: "This draft changed. Refresh the list." };
    refresh();
    return { success: true };
  } catch (e) {
    return failed(e, "Couldn't update the draft.");
  }
}

/**
 * Take back an unpaid rent bill that was sent by mistake. It is kept as
 * cancelled, and its draft returns to the review list to be corrected.
 */
export async function cancelRentBillAction(invoiceId: string, why: string): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const reason = String(why ?? "").trim().slice(0, REASON_LIMITS.max);
    if (reason.length < REASON_LIMITS.min) return { success: false, error: "Write the reason." };
    const bill = await prisma.invoice.findUnique({
      where: { id: String(invoiceId) },
      include: { tenant: { select: { userId: true } } },
    });
    if (!bill) return { success: false, error: "This bill no longer exists." };
    if (!isRentBill(bill)) return { success: false, error: "Only rent bills can be cancelled here." };
    const unpaid = OPEN_BILL.filter((s) => s !== "REVIEWING");
    if (!unpaid.includes(bill.status)) {
      return {
        success: false,
        error: bill.status === "REVIEWING" ? "Approve or reject the deposit slip first." : "Only an unpaid bill can be cancelled.",
      };
    }
    const by = await staffActor(staff.id);
    await prisma.$transaction(async (tx) => {
      const done = await tx.invoice.updateMany({ where: { id: bill.id, status: { in: unpaid } }, data: { status: "VOID" } });
      if (!done.count) throw new RentBillError("This bill changed since you opened it. Close this and check it again.");
      await tx.rentDraft.updateMany({
        where: { invoiceId: bill.id },
        data: { status: "PENDING", invoiceId: null, decidedById: null, decidedByName: null, decidedAt: null },
      });
      await logPayment(tx, {
        invoiceId: bill.id,
        invoiceNumber: bill.invoiceNumber,
        tenantId: bill.tenantId,
        action: "BILL_CANCELLED",
        amount: bill.amount,
        reason,
        by,
      });
    });
    await notify("INVOICE_STATUS_CHANGED", {
      recipients: [bill.tenant.userId],
      unitId: bill.unitId ?? undefined,
      title: "Bill cancelled",
      message: `${bill.invoiceNumber} (${bill.month}, ${peso(bill.amount)}) was cancelled: ${reason}`,
      link: "/tenantdashboard/payments",
    });
    refresh();
    return { success: true };
  } catch (e) {
    return failed(e, "Couldn't cancel the bill.");
  }
}
