"use server";

import { billsInWorkspace } from "@/lib/workspace-server";
import { requireStaffAny, requireStore, requireTenantRecord } from "@/lib/action-guard";
import { AccessDenied } from "@/lib/auth-server";
import { REASON_LIMITS, checkReceipt, type PaymentAction, type PaymentLogEntry, type ReceiptForm } from "@/lib/payments";
import { PAYMENT_STAFF, logPayment, staffActor } from "@/lib/payments-server";
import { peso } from "@/lib/leasing";
import { RentBillError, applyRentPayment, reverseRentPayment } from "@/lib/rent-bills-server";
import { formatPHDate } from "@/lib/ph-date";
import { prisma } from "@srmall/database";
import { safeUserSelect } from "@/lib/user-select";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendNotifyEmail } from "@/lib/notify-email";
import { notify, resolveChannels } from "@/lib/notify";

export async function getTenantInvoices(tenantId: string) {
  try {
    const account = await requireTenantRecord(tenantId, { sections: ["payments"], staff: PAYMENT_STAFF });
    // Store staff see only the invoices of the space they work in.
    const staffLease = account.tenantStaff?.leaseId;
    const invoices = await (prisma as any).invoice.findMany({
      where: { tenantId, ...(staffLease && { OR: [{ leaseId: null }, { leaseId: staffLease }] }) },
      orderBy: { createdAt: "desc" },
    });
    return invoices;
  } catch (error: any) {
    console.error("Failed to fetch tenant invoices:", error);
    return [];
  }
}

export async function submitDepositSlip(
  invoiceId: string,
  url: string,
  storageKey?: string,
) {
  try {
    const owner = await (prisma as any).invoice.findUnique({ where: { id: invoiceId }, select: { tenantId: true, leaseId: true } });
    const account = await requireTenantRecord(owner?.tenantId ?? "", { sections: ["payments"] });
    if (account.tenantStaff && owner?.leaseId && owner.leaseId !== account.tenantStaff.leaseId) {
      return { success: false, error: "You don't have access to this." };
    }
    // A paid bill, or one already being checked, can't be changed by a new slip.
    const sent = await prisma.invoice.updateMany({
      where: { id: invoiceId, status: { in: UNPAID } },
      data: {
        depositSlipUrl: url,
        storageKey: storageKey || null,
        status: "REVIEWING",
      },
    });
    if (!sent.count) return { success: false, error: "This bill is already paid or being checked." };
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // 💰 Tell every admin a proof of payment is waiting for verification.
    await notify("DEPOSIT_SLIP_SUBMITTED", {
      title: "Deposit Slip Awaiting Review",
      message: `${invoice.invoiceNumber}: ₱${invoice.amount} for ${
        invoice.tenant?.shopName || "a shop"
      } (Unit ${invoice.tenant?.unitId || "n/a"}) was uploaded and is now awaiting verification.`,
      link: "/admindashboard/tenant-monitoring",
    });

    revalidatePath("/tenantdashboard/payments");
    revalidatePath("/admindashboard/tenant-monitoring");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to submit deposit slip:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllInvoices() {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const invoices = await (prisma as any).invoice.findMany({
      include: {
        tenant: {
          select: {
            shopName: true,
            unitId: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return invoices;
  } catch (error: any) {
    console.error("Failed to fetch all invoices:", error);
    return [];
  }
}

// ─── Accepting, rejecting and voiding payments ───────────────────────────────

/** Unpaid and not waiting on a slip. */
const UNPAID = ["PENDING", "OVERDUE", "REJECTED"];

class PaymentError extends Error {}

type Result = { success: true; note?: string } | { success: false; error: string };

const BILL = {
  id: true,
  invoiceNumber: true,
  tenantId: true,
  amount: true,
  status: true,
  month: true,
  unitId: true,
  depositSlipUrl: true,
  paymentMethod: true,
  referenceNo: true,
  paidAt: true,
  leaseId: true,
  periodStart: true,
  periodEnd: true,
  tenant: { select: { shopName: true, unitId: true, userId: true, user: { select: safeUserSelect } } },
} as const;

async function findBill(invoiceId: string) {
  const bill = await prisma.invoice.findUnique({ where: { id: String(invoiceId) }, select: BILL });
  if (!bill) throw new PaymentError("This bill no longer exists.");
  return bill;
}

type Bill = Awaited<ReturnType<typeof findBill>>;

/**
 * Change a bill and write down who did it, together or not at all. The change
 * only happens while the bill still has one of the `from` statuses, so two
 * people can't both act on it.
 */
async function changeBill(
  bill: Bill,
  from: string[],
  data: Record<string, unknown>,
  staffId: string,
  entry: { action: PaymentAction; method?: string | null; referenceNo?: string | null; paidOn?: Date | null; reason?: string | null; slipUrl?: string | null },
) {
  const by = await staffActor(staffId);
  return prisma.$transaction(async (tx) => {
    const done = await tx.invoice.updateMany({ where: { id: bill.id, status: { in: from } }, data });
    if (!done.count) throw new PaymentError("This bill changed since you opened it. Close this and check it again.");
    await logPayment(tx, {
      ...entry,
      invoiceId: bill.id,
      invoiceNumber: bill.invoiceNumber,
      tenantId: bill.tenantId,
      amount: bill.amount,
      by,
    });
    // A rent bill moves its lease: forward when paid, back when voided.
    if (entry.action === "VOIDED") await reverseRentPayment(tx, bill);
    else if (entry.action === "RECORDED" || entry.action === "SLIP_APPROVED") {
      if (!(await applyRentPayment(tx, bill))) return "The lease has already ended, so its date was not changed.";
    }
    return undefined;
  });
}

function failed(e: unknown, fallback: string): Result {
  if (e instanceof AccessDenied || e instanceof PaymentError || e instanceof RentBillError) return { success: false, error: e.message };
  console.error("[PAYMENT]", e);
  return { success: false, error: fallback };
}

function reasonOf(value: string) {
  const reason = String(value ?? "").trim().slice(0, REASON_LIMITS.max);
  if (reason.length < REASON_LIMITS.min) throw new PaymentError("Write the reason.");
  return reason;
}

function refresh() {
  revalidatePath("/tenantdashboard/payments");
  revalidatePath("/admindashboard/tenant-monitoring");
  revalidatePath("/admindashboard/renewals");
  revalidatePath("/tenantdashboard/rent-a-space");
}

/** Bell notice to the tenant about one of their bills. */
async function tellTenant(bill: Bill, title: string, message: string) {
  if (!bill.tenant?.userId) return;
  await notify("INVOICE_STATUS_CHANGED", {
    recipients: [bill.tenant.userId],
    // Bills without a unit belong to the tenant's main unit.
    unitId: bill.unitId ?? bill.tenant.unitId,
    title,
    message,
    link: "/tenantdashboard/payments",
  });
}

/** Money received at the office for an unpaid bill. */
export async function recordPaymentAction(invoiceId: string, form: ReceiptForm): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF, "dashboard");
    const bill = await findBill(invoiceId);
    if (bill.status === "PAID") return { success: false, error: "This bill is already paid." };
    if (bill.status === "REVIEWING") return { success: false, error: "A deposit slip is waiting for this bill. Approve or reject it instead." };
    const receipt = checkReceipt(form, bill.amount);
    if (typeof receipt === "string") return { success: false, error: receipt };
    const { method, referenceNo, paidAt } = receipt;

    const note = await changeBill(bill, UNPAID, { status: "PAID", paymentMethod: method, referenceNo, paidAt }, staff.id, {
      action: "RECORDED",
      method,
      referenceNo,
      paidOn: paidAt,
    });

    // 💰 Notify tenant of payment confirmation (in-app), then email only if
    // they have the EMAIL channel switched on for this alert.
    const tenantUserId = bill.tenant?.userId;
    if (tenantUserId) {
      await notify("PAYMENT_CONFIRMED", {
        recipients: [tenantUserId],
        unitId: bill.unitId ?? bill.tenant.unitId,
        title: "Payment Confirmed",
        message: `Reference ${referenceNo} for ${bill.tenant.shopName || "your store"} (Unit ${
          bill.unitId ?? bill.tenant.unitId ?? "n/a"
        }) was recorded against invoice ${bill.invoiceNumber}. Your balance has been updated.`,
        link: "/tenantdashboard/payments",
        email: false,
      });

      const prefs = await resolveChannels("PAYMENT_CONFIRMED", [tenantUserId]);
      const wantsEmail = prefs[tenantUserId]?.enabled && prefs[tenantUserId]?.channels.includes("EMAIL");
      const email = bill.tenant.user?.email;
      if (wantsEmail && email) {
        after(() =>
          sendNotifyEmail({
            type: "PAYMENT_CONFIRMED",
            email,
            data: { unitId: bill.unitId ?? bill.tenant.unitId, shopName: bill.tenant.shopName, referenceNo },
          }).catch((err: any) => console.error("Failed to dispatch payment confirmation email:", err)),
        );
      }
    }

    refresh();
    return { success: true, note };
  } catch (e) {
    return failed(e, "Couldn't record the payment.");
  }
}

/** The deposit slip matches the bank record: the bill is paid. */
export async function approveSlipAction(invoiceId: string, form: ReceiptForm): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const bill = await findBill(invoiceId);
    if (bill.status !== "REVIEWING") return { success: false, error: "There is no deposit slip waiting for this bill." };
    const receipt = checkReceipt(form, bill.amount);
    if (typeof receipt === "string") return { success: false, error: receipt };
    const { method, referenceNo, paidAt } = receipt;

    const note = await changeBill(bill, ["REVIEWING"], { status: "PAID", paymentMethod: method, referenceNo, paidAt }, staff.id, {
      action: "SLIP_APPROVED",
      method,
      referenceNo,
      paidOn: paidAt,
      slipUrl: bill.depositSlipUrl,
    });
    await tellTenant(
      bill,
      "Invoice Approved",
      `${bill.invoiceNumber} for ${bill.month} (${peso(bill.amount)}) is approved. Your payment has been recorded.`,
    );
    refresh();
    return { success: true, note };
  } catch (e) {
    return failed(e, "Couldn't approve the deposit slip.");
  }
}

/** The slip is wrong or unreadable: the bill goes back to unpaid, with the reason. */
export async function rejectSlipAction(invoiceId: string, why: string): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const reason = reasonOf(why);
    const bill = await findBill(invoiceId);
    if (bill.status !== "REVIEWING") return { success: false, error: "There is no deposit slip waiting for this bill." };

    await changeBill(bill, ["REVIEWING"], { status: "PENDING", depositSlipUrl: null, storageKey: null }, staff.id, {
      action: "SLIP_REJECTED",
      reason,
      // The picture stays on record here.
      slipUrl: bill.depositSlipUrl,
    });
    await tellTenant(
      bill,
      "Deposit slip rejected",
      `Your slip for ${bill.invoiceNumber} (${bill.month}) was not accepted: ${reason} Please upload it again or pay at the office.`,
    );
    refresh();
    return { success: true };
  } catch (e) {
    return failed(e, "Couldn't reject the deposit slip.");
  }
}

/**
 * Undo a payment recorded by mistake: the bill is unpaid again. The old payment
 * details stay in the payment history. For a rent bill the lease goes back to
 * the start of its period, and only the latest paid period can be voided.
 */
export async function voidPaymentAction(invoiceId: string, why: string): Promise<Result> {
  try {
    const staff = await requireStaffAny(...PAYMENT_STAFF);
    const reason = reasonOf(why);
    const bill = await findBill(invoiceId);
    if (bill.status !== "PAID") return { success: false, error: "Only a paid bill has a payment to void." };

    await changeBill(
      bill,
      ["PAID"],
      { status: "PENDING", paymentMethod: null, referenceNo: null, depositSlipUrl: null, storageKey: null },
      staff.id,
      {
        action: "VOIDED",
        method: bill.paymentMethod,
        referenceNo: bill.referenceNo,
        paidOn: bill.paidAt,
        reason,
        slipUrl: bill.depositSlipUrl,
      },
    );
    await tellTenant(
      bill,
      "Payment voided",
      `The payment on ${bill.invoiceNumber} (${bill.month}, ${peso(bill.amount)}) was voided: ${reason} The bill shows as unpaid.${
        bill.periodStart && bill.leaseId ? ` Your rent for that period, from ${formatPHDate(bill.periodStart)}, is due again.` : ""
      }`,
    );
    refresh();
    return { success: true };
  } catch (e) {
    return failed(e, "Couldn't void the payment.");
  }
}

/** Who did what to one tenant's bills, newest first. */
export async function getPaymentLogAction(tenantId: string) {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const rows = await prisma.paymentLog.findMany({
      where: { tenantId: String(tenantId) },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const data = rows.map((r): PaymentLogEntry => ({
      id: r.id,
      invoiceId: r.invoiceId,
      action: r.action as PaymentAction,
      amount: r.amount,
      method: r.method,
      referenceNo: r.referenceNo,
      paidOn: r.paidOn?.toISOString() ?? null,
      reason: r.reason,
      slipUrl: r.slipUrl,
      actorName: r.actorName,
      createdAt: r.createdAt.toISOString(),
    }));
    return { success: true as const, data };
  } catch (e) {
    console.error("[PAYMENT_LOG]", e);
    return { success: false as const, error: "Couldn't load the payment history of these bills." };
  }
}

export async function generateInvoice(data: {
  tenantId: string;
  month: string;
  amount: number;
  dueDate: Date;
  description?: string;
}) {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const invoiceNumber = `#INV-${Date.now().toString().slice(-6)}`;
    const invoice = await (prisma as any).invoice.create({
      data: {
        invoiceNumber,
        tenantId: data.tenantId,
        month: data.month,
        amount: data.amount,
        dueDate: data.dueDate,
        description: data.description,
        status: "PENDING",
      },
      include: {
        tenant: {
          include: {
            user: { select: safeUserSelect },
          },
        },
      },
    });

    // Bell notice for the tenant (the "bill posted" email is sent below).
    if (invoice?.tenant?.userId) {
      const peso = `₱${Number(data.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      await notify("INVOICE_ISSUED", {
        recipients: [invoice.tenant.userId],
        unitId: invoice.unitId ?? invoice.tenant.unitId,
        title: `New bill · ${data.month}`,
        message: `${invoiceNumber} for ${peso} is due ${new Date(data.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}.`,
        link: "/tenantdashboard/payments",
        email: false,
      });
    }

    // Notify Tenant of Bill Posted
    if (invoice?.tenant?.user?.email) {
      after(() =>
        sendNotifyEmail({
          type: "BILL_POSTED",
          email: invoice.tenant.user.email,
          data: {
            unitId: invoice.tenant.unitId,
            shopName: invoice.tenant.shopName,
            amount: data.amount,
            month: data.month,
          },
        }).catch((err: any) =>
          console.error("Failed to dispatch bill posted email:", err),
        ),
      );
    }

    revalidatePath("/tenantdashboard/payments");
    revalidatePath("/admindashboard/tenant-monitoring");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to create invoice:", error);
    return { success: false, error: error.message };
  }
}

export async function getTenantPaymentScheduleAction(userId: string) {
  try {
    await requireStore(userId, { sections: ["overview", "payments"], staff: PAYMENT_STAFF });
    const tenant = await (prisma as any).tenant.findUnique({
      where: { userId },
      include: {
        invoices: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!tenant) {
      return { success: false, error: "Tenant record not found" };
    }

    // Rent and bills are those of the unit being viewed.
    const { bills, lease } = await billsInWorkspace(tenant.id, tenant.invoices || []);
    const invoices: any[] = bills;
    const unit = lease?.unitId ?? tenant.unitId;

    const slot = unit
      ? await (prisma as any).areaSlot.findFirst({
          where: { unit_id: unit },
        })
      : null;

    const baseRent = lease?.monthlyRent || slot?.base_rent || 0;

    // Real payment dates (newer column; raw SQL until the client is regenerated).
    const paidAtRows = await prisma
      .$queryRawUnsafe<{ id: string; paidAt: Date }[]>(
        `SELECT "id", "paidAt" FROM "Invoice" WHERE "tenantId" = $1 AND "paidAt" IS NOT NULL`,
        tenant.id,
      )
      .catch(() => [] as { id: string; paidAt: Date }[]);
    const paidAtById = new Map(paidAtRows.map((r) => [r.id, r.paidAt]));
    const paidDate = (inv: any) => paidAtById.get(inv.id) || inv.updatedAt || inv.createdAt;

    // Separate paid invoices and unpaid invoices
    const paidInvoices = invoices
      .filter((inv: any) => inv.status === "PAID")
      .sort(
        (a: any, b: any) =>
          new Date(paidDate(b)).getTime() - new Date(paidDate(a)).getTime(),
      );

    const lastPaidInvoice = paidInvoices[0] || null;
    const lastPaymentDate = lastPaidInvoice
      ? paidDate(lastPaidInvoice)
      : null;

    // Unpaid invoices sorted by dueDate ascending (earliest due first)
    const unpaidInvoices = invoices
      .filter((inv: any) => inv.status !== "PAID" && inv.status !== "VOID")
      .sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

    let nextPaymentDate: Date | string;
    let paymentMonth: string;
    let paymentAmount: number;
    let paymentStatus: "Paid" | "Pending" | "Overdue" | "Reviewing";
    let invoiceNumber: string | null = null;

    const now = new Date();

    if (unpaidInvoices.length > 0) {
      const nextInv = unpaidInvoices[0];
      nextPaymentDate = nextInv.dueDate;
      paymentMonth = nextInv.month;
      paymentAmount = nextInv.amount;
      invoiceNumber = nextInv.invoiceNumber;

      const isPastDue = new Date(nextInv.dueDate).getTime() < now.getTime();
      if (
        nextInv.status === "OVERDUE" ||
        (nextInv.status === "PENDING" && isPastDue)
      ) {
        paymentStatus = "Overdue";
      } else if (nextInv.status === "REVIEWING") {
        paymentStatus = "Reviewing";
      } else {
        paymentStatus = "Pending";
      }
    } else if (paidInvoices.length > 0) {
      paymentStatus = "Paid";
      paymentAmount = lastPaidInvoice.amount || baseRent;

      const lastDue = new Date(lastPaidInvoice.dueDate);
      const nextDue = new Date(lastDue);
      nextDue.setMonth(nextDue.getMonth() + 1);

      if (nextDue.getTime() < now.getTime()) {
        const nextMonthDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          5,
        );
        nextPaymentDate = nextMonthDate;
        paymentMonth = nextMonthDate.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        });
      } else {
        nextPaymentDate = nextDue;
        paymentMonth = nextDue.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        });
      }
    } else {
      const defaultDue = new Date(now.getFullYear(), now.getMonth(), 5);
      if (defaultDue.getTime() < now.getTime()) {
        defaultDue.setMonth(defaultDue.getMonth() + 1);
      }
      nextPaymentDate = defaultDue;
      paymentMonth = defaultDue.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      paymentAmount = baseRent;
      paymentStatus = "Pending";
    }

    const totalUnpaidBalance = unpaidInvoices.reduce(
      (sum: number, inv: any) => sum + inv.amount,
      0,
    );

    return {
      success: true,
      data: {
        nextPaymentDate,
        paymentMonth,
        paymentAmount,
        paymentStatus,
        lastPaymentDate,
        invoiceNumber,
        totalUnpaidBalance,
        totalInvoices: invoices.length,
        paidInvoicesCount: paidInvoices.length,
        unitId: tenant.unitId,
        baseRent,
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch tenant payment schedule:", error);
    return { success: false, error: error.message };
  }
}

