"use server";

/**
 * Payment schedules: every invoice as a dated instalment with its status.
 * Admin ledger (all tenants) for Tenant Monitoring, and a tenant's own
 * schedule for their Payments page.
 */
import { prisma } from "@srmall/database";
import { requireStaffAny, requireStore } from "@/lib/action-guard";

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
  const sorted = [...rows].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
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

const ROW_SQL = `SELECT "id","invoiceNumber","month","amount","status","dueDate","paidAt","updatedAt","referenceNo","tenantId" FROM "Invoice"`;

/** Admin: every tenant with their payment schedule. */
export async function getPaymentLedgerAction(_adminUserId?: string) {
  try {
    await requireStaffAny("tenant_monitoring");

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

/** Tenant: their own schedule. */
export async function getMyPaymentScheduleAction(userId?: string) {
  try {
    if (!userId) return { success: false as const, error: "Please sign in again." };
    await requireStore(userId, { sections: ["payments"], staff: ["tenant_monitoring"] });
    const tenant = await prisma.tenant.findUnique({ where: { userId }, select: { id: true, shopName: true, unitId: true } });
    if (!tenant) return { success: false as const, error: "Tenant record not found." };
    const rows = await prisma.$queryRawUnsafe<Row[]>(`${ROW_SQL} WHERE "tenantId" = $1`, tenant.id);
    return { success: true as const, data: { shopName: tenant.shopName, unitId: tenant.unitId, entries: toEntries(rows, new Date()) } };
  } catch (error) {
    console.error("[MY_PAYMENT_SCHEDULE_ERROR]:", error);
    return { success: false as const, error: "Couldn't load your payment schedule." };
  }
}
