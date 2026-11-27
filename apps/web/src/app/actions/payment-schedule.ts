"use server";

/**
 * Payment schedules: every invoice as a dated instalment with its status.
 * Admin ledger (all tenants) for Tenant Monitoring, and a tenant's own
 * schedule for their Payments page.
 */
import { billsInWorkspace } from "@/lib/workspace-server";
import { shopNames } from "@/lib/shops";
import { prisma } from "@srmall/database";
import { requireStaffAny, requireStore } from "@/lib/action-guard";
import { PAYMENT_STAFF } from "@/lib/payments-server";
import type { CollectionReport } from "@/lib/collections";
import { phDayStart, toPHDateInput } from "@/lib/ph-date";
import { PAGE_SIZE, clampPage, likeText } from "@/lib/paging";

export type ScheduleStatus = "PAID" | "DUE" | "OVERDUE" | "VERIFYING" | "REJECTED";

export interface ScheduleEntry {
  id: string;
  invoiceNumber: string;
  /** Billing month label, e.g. "Oct 2026". */
  month: string;
  amount: number;
  status: ScheduleStatus;
  dueDate: string;
  paidAt: string | null;
  referenceNo: string | null;
  /** Position in this tenant's schedule, oldest first (1-based). */
  index: number;
  total: number;
}

export interface LedgerTenant {
  id: string;
  shopName: string;
  unitId: string;
  logoUrl: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  entries: ScheduleEntry[];
}

type Row = {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  updatedAt: Date;
  referenceNo: string | null;
  tenantId: string;
  leaseId: string | null;
  unitId: string | null;
};

function statusOf(r: Row, now: Date): ScheduleStatus {
  if (r.status === "PAID") return "PAID";
  if (r.status === "REVIEWING") return "VERIFYING";
  if (r.status === "REJECTED") return "REJECTED";
  if (r.status === "OVERDUE" || new Date(r.dueDate) < now) return "OVERDUE";
  return "DUE";
}

/** One tenant's invoices as a numbered schedule (oldest first). */
function toEntries(rows: Row[], now: Date): ScheduleEntry[] {
  // Cancelled bills are not part of the schedule.
  const sorted = rows.filter((r) => r.status !== "VOID").sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return sorted.map((r, i) => {
    const status = statusOf(r, now);
    return {
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      month: r.month,
      amount: Number(r.amount) || 0,
      status,
      dueDate: new Date(r.dueDate).toISOString(),
      // Older paid invoices predate paidAt; their last update is the best record.
      paidAt: status === "PAID" ? new Date(r.paidAt || r.updatedAt).toISOString() : null,
      referenceNo: r.referenceNo,
      index: i + 1,
      total: sorted.length,
    };
  });
}

const ROW_SQL = `SELECT "id","invoiceNumber","month","amount","status","dueDate","paidAt","updatedAt","referenceNo","tenantId","leaseId","unitId" FROM "Invoice"`;

/** Admin: every tenant with their payment schedule. */
export async function getPaymentLedgerAction(_adminUserId?: string) {
  try {
    await requireStaffAny(...PAYMENT_STAFF);

    const [rows, tenants] = await Promise.all([
      prisma.$queryRawUnsafe<Row[]>(ROW_SQL),
      prisma.tenant.findMany({
        where: { status: { in: ["ACTIVE", "INACTIVE", "SUSPENDED", "PAST"] } },
        select: { id: true, shopName: true, unitId: true, logoUrl: true, user: { select: { name: true, email: true } } },
        orderBy: { shopName: "asc" },
      }),
    ]);
    const now = new Date();
    const byTenant = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byTenant.get(r.tenantId) || [];
      list.push(r);
      byTenant.set(r.tenantId, list);
    }
    const data: LedgerTenant[] = tenants.map((t) => ({
      id: t.id,
      shopName: t.shopName,
      unitId: t.unitId,
      logoUrl: t.logoUrl,
      ownerName: t.user?.name ?? null,
      ownerEmail: t.user?.email ?? null,
      entries: toEntries(byTenant.get(t.id) || [], now),
    }));
    return { success: true as const, data };
  } catch (error) {
    console.error("[PAYMENT_LEDGER_ERROR]:", error);
    return { success: false as const, error: "Couldn't load payments." };
  }
}

export type PaymentState = ScheduleStatus | "VOID";

/** One invoice in the admin Payment history list. */
export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  state: PaymentState;
  dueDate: string;
  paidAt: string | null;
  method: string | null;
  referenceNo: string | null;
  /** Staff member who accepted the payment (none for older records). */
  acceptedBy: string | null;
  /** The deposit slip waiting to be checked, if there is one. */
  slipUrl: string | null;
  /** Covers a rent period of a lease. */
  rentBill: boolean;
  shopName: string;
  logoUrl: string | null;
  unitId: string | null;
}

// Dates are stored in UTC; days and months are read in the Philippines.
const inPH = (column: string) => `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')`;

// Every invoice with the shop and unit it belongs to. "date" is the day it was
// paid, or the due day while unpaid. Older paid invoices have no paidAt, so
// their last update stands in for it.
const PAYMENTS_SQL = `
  WITH p AS (
    SELECT i."id", i."invoiceNumber", i."month", i."amount"::float AS "amount", i."dueDate",
      i."paymentMethod" AS "method", i."referenceNo", i."depositSlipUrl" AS "slipUrl",
      (i."leaseId" IS NOT NULL AND i."periodStart" IS NOT NULL) AS "rentBill",
      CASE WHEN i."status" = 'PAID' THEN (
        SELECT g."actorName" FROM "PaymentLog" g
         WHERE g."invoiceId" = i."id" AND g."action" IN ('RECORDED', 'SLIP_APPROVED')
         ORDER BY g."createdAt" DESC LIMIT 1
      ) END AS "acceptedBy",
      CASE
        WHEN i."status" IN ('PAID', 'VOID', 'REJECTED') THEN i."status"
        WHEN i."status" = 'REVIEWING' THEN 'VERIFYING'
        WHEN i."status" = 'OVERDUE' OR ${inPH('i."dueDate"')}::date < (now() AT TIME ZONE 'Asia/Manila')::date THEN 'OVERDUE'
        ELSE 'DUE'
      END AS "state",
      CASE WHEN i."status" = 'PAID' THEN COALESCE(i."paidAt", i."updatedAt") END AS "paidAt",
      CASE WHEN NULLIF(u."shopName", '') IS NULL THEN t."shopName" ELSE u."shopName" END AS "shopName",
      CASE WHEN u."id" IS NULL THEN t."logoUrl" ELSE u."logoUrl" END AS "logoUrl",
      COALESCE(i."unitId", l."unitId", NULLIF(NULLIF(t."unitId", 'UNASSIGNED'), 'PENDING_ASSIGNMENT')) AS "unitId"
    FROM "Invoice" i
    JOIN "Tenant" t ON t."id" = i."tenantId"
    LEFT JOIN "Lease" l ON l."id" = i."leaseId"
    LEFT JOIN "UnitShop" u ON u."id" = l."shopId"
  ), d AS (SELECT p.*, COALESCE(p."paidAt", p."dueDate") AS "date" FROM p)`;

const MONTH_SQL = `to_char(${inPH('"date"')}, 'YYYY-MM')`;

type RawPayment = Omit<PaymentRecord, "dueDate" | "paidAt"> & { dueDate: Date; paidAt: Date | null };

const toRecord = (r: RawPayment): PaymentRecord => ({
  ...r,
  dueDate: new Date(r.dueDate).toISOString(),
  paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
});

/** How many bills the home screen lists in each queue. */
const QUEUE_SIZE = 20;

export type PaymentOverview = {
  slips: { count: number; amount: number; rows: PaymentRecord[] };
  overdue: { count: number; amount: number; rows: PaymentRecord[] };
  today: { count: number; amount: number };
  month: { count: number; amount: number };
};

/** The Payments home screen: what is waiting, and what came in today and this month. */
export async function getPaymentOverviewAction() {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const now = `(now() AT TIME ZONE 'Asia/Manila')`;
    const groups = {
      slips: `"state" = 'VERIFYING'`,
      overdue: `"state" = 'OVERDUE'`,
      today: `"state" = 'PAID' AND ${inPH('"paidAt"')}::date = ${now}::date`,
      month: `"state" = 'PAID' AND to_char(${inPH('"paidAt"')}, 'YYYY-MM') = to_char(${now}, 'YYYY-MM')`,
    };
    const columns = Object.entries(groups)
      .map(
        ([name, when]) =>
          `COUNT(*) FILTER (WHERE ${when})::int AS "${name}Count", COALESCE(SUM("amount") FILTER (WHERE ${when}), 0)::float AS "${name}Amount"`,
      )
      .join(", ");
    // The longest waiting first.
    const queue = (when: string) =>
      prisma.$queryRawUnsafe<RawPayment[]>(`${PAYMENTS_SQL} SELECT * FROM d WHERE ${when} ORDER BY "dueDate", "id" LIMIT ${QUEUE_SIZE}`);
    const [[t], slips, overdue] = await Promise.all([
      prisma.$queryRawUnsafe<Record<string, number>[]>(`${PAYMENTS_SQL} SELECT ${columns} FROM d`),
      queue(groups.slips),
      queue(groups.overdue),
    ]);
    const data: PaymentOverview = {
      slips: { count: t.slipsCount, amount: t.slipsAmount, rows: slips.map(toRecord) },
      overdue: { count: t.overdueCount, amount: t.overdueAmount, rows: overdue.map(toRecord) },
      today: { count: t.todayCount, amount: t.todayAmount },
      month: { count: t.monthCount, amount: t.monthAmount },
    };
    return { success: true as const, data };
  } catch (error) {
    console.error("[PAYMENT_OVERVIEW_ERROR]:", error);
    return { success: false as const, error: "Couldn't load the payments overview." };
  }
}

/** Every payment received on one Philippine day, and any voided that day. */
export async function getCollectionReportAction(input: { date: string }) {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const date = String(input?.date ?? "");
    const start = /^\d{4}-\d{2}-\d{2}$/.test(date) ? phDayStart(date) : null;
    // A day that doesn't exist (Nov 31) would silently become the next one.
    if (!start || Number.isNaN(start.getTime()) || toPHDateInput(start) !== date) {
      return { success: false as const, error: "Choose a date." };
    }
    const [rows, voided] = await Promise.all([
      prisma.$queryRawUnsafe<RawPayment[]>(
        `${PAYMENTS_SQL} SELECT * FROM d WHERE "state" = 'PAID' AND ${inPH('"paidAt"')}::date = $1::date ORDER BY "shopName", "invoiceNumber"`,
        date,
      ),
      prisma.paymentLog.findMany({
        where: { action: "VOIDED", createdAt: { gte: start, lt: new Date(start.getTime() + 86400000) } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const data: CollectionReport = {
      date,
      rows: rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        month: r.month,
        amount: r.amount,
        method: r.method,
        referenceNo: r.referenceNo,
        acceptedBy: r.acceptedBy,
        shopName: r.shopName || "New shop",
        unitId: r.unitId,
      })),
      voided: voided.map((v) => ({
        id: v.id,
        invoiceNumber: v.invoiceNumber,
        shopName: v.shopName || "Removed tenant",
        amount: v.amount,
        method: v.method,
        referenceNo: v.referenceNo,
        reason: v.reason,
        actorName: v.actorName,
      })),
    };
    return { success: true as const, data };
  } catch (error) {
    console.error("[COLLECTION_REPORT_ERROR]:", error);
    return { success: false as const, error: "Couldn't load the collection report." };
  }
}

/** Admin: one page of every tenant's invoices, newest first. */
export async function getPaymentHistoryAction(input: { search?: string; status?: string; month?: string; page?: number } = {}) {
  try {
    await requireStaffAny(...PAYMENT_STAFF);
    const params: unknown[] = [];
    const param = (value: unknown) => `$${params.push(value)}`;
    const conditions: string[] = [];
    const search = likeText(input.search);
    if (search) {
      const like = param(`%${search}%`);
      conditions.push(`("shopName" ILIKE ${like} OR "invoiceNumber" ILIKE ${like} OR "unitId" ILIKE ${like} OR "referenceNo" ILIKE ${like})`);
    }
    if (input.status && input.status !== "ALL") conditions.push(`"state" = ${param(String(input.status))}`);
    if (/^\d{4}-\d{2}$/.test(input.month ?? "")) conditions.push(`${MONTH_SQL} = ${param(input.month)}`);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[matching], months] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: number; amount: number }[]>(
        `${PAYMENTS_SQL} SELECT COUNT(*)::int AS "total", COALESCE(SUM("amount"), 0)::float AS "amount" FROM d ${where}`,
        ...params,
      ),
      prisma.$queryRawUnsafe<{ month: string; count: number }[]>(
        `${PAYMENTS_SQL} SELECT ${MONTH_SQL} AS "month", COUNT(*)::int AS "count" FROM d GROUP BY 1 ORDER BY 1 DESC`,
      ),
    ]);
    const page = clampPage(input.page, matching.total);
    const rows = await prisma.$queryRawUnsafe<RawPayment[]>(
      `${PAYMENTS_SQL} SELECT * FROM d ${where} ORDER BY "date" DESC, "id" DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      ...params,
    );
    return {
      success: true as const,
      data: {
        rows: rows.map(toRecord),
        total: matching.total,
        amount: matching.amount,
        page,
        all: months.reduce((sum, m) => sum + m.count, 0),
        months: months.map((m) => m.month),
      },
    };
  } catch (error) {
    console.error("[PAYMENT_HISTORY_ERROR]:", error);
    return { success: false as const, error: "Couldn't load the payment history." };
  }
}

/** Tenant: their own schedule, for the unit they are looking at. */
export async function getMyPaymentScheduleAction(userId?: string) {
  try {
    if (!userId) return { success: false as const, error: "Please sign in again." };
    await requireStore(userId, { sections: ["payments"], staff: PAYMENT_STAFF });
    const tenant = await prisma.tenant.findUnique({ where: { userId }, select: { id: true, shopName: true, unitId: true } });
    if (!tenant) return { success: false as const, error: "Tenant record not found." };
    const rows = await prisma.$queryRawUnsafe<Row[]>(`${ROW_SQL} WHERE "tenantId" = $1`, tenant.id);
    const { bills, lease } = await billsInWorkspace(tenant.id, rows);
    const shopName = lease ? (await shopNames(tenant.id))(lease.shopId) : tenant.shopName;
    return {
      success: true as const,
      data: { shopName: shopName || "New shop", unitId: lease?.unitId ?? tenant.unitId, entries: toEntries(bills, new Date()) },
    };
  } catch (error) {
    console.error("[MY_PAYMENT_SCHEDULE_ERROR]:", error);
    return { success: false as const, error: "Couldn't load your payment schedule." };
  }
}
