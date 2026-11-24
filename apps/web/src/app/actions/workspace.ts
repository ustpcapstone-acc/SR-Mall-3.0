"use server";

/**
 * Tenant workspaces (Home, plus one per rented space) and the per-space
 * Payments page. Everything is read from the signed-in session.
 */
import { prisma } from "@srmall/database";
import { AccessDenied } from "@/lib/auth-server";
import { graceEndDate, invoiceStatus, renewalStage, type EInvoiceStatus, type RenewalStage } from "@/lib/leasing";
import { getLeaseSettings } from "@/lib/leasing-server";
import { rememberWorkspace, requireTenant, resolveWorkspace, tenantSpaces, workspaceHome } from "@/lib/workspace-server";

type Fail = { success: false; error: string };

function failure(e: unknown, fallback: string): Fail {
  if (e instanceof AccessDenied) return { success: false, error: e.message };
  console.error("[WORKSPACE]", e);
  return { success: false, error: fallback };
}

export type WorkspaceSpace = { id: string; unitId: string; floor: string | null; stage: RenewalStage };

export async function getWorkspacesAction(): Promise<
  | {
      success: true;
      data: {
        current: string;
        shopName: string;
        spaces: WorkspaceSpace[];
        /** null for the owner; the sections a staff account can open. */
        staffPermissions: string[] | null;
        staffRole: string | null;
      };
    }
  | Fail
> {
  try {
    const tenant = await requireTenant();
    const [{ current, spaces }, settings] = await Promise.all([
      resolveWorkspace(tenant.id, tenant.staff?.leaseId),
      getLeaseSettings(),
    ]);
    const floors = new Map(
      (
        await prisma.areaSlot.findMany({
          where: { unit_id: { in: spaces.map((s) => s.unitId) } },
          select: { unit_id: true, floor: true },
        })
      ).map((s) => [s.unit_id, s.floor]),
    );
    return {
      success: true,
      data: {
        current,
        shopName: tenant.shopName,
        staffPermissions: tenant.staff?.permissions ?? null,
        staffRole: tenant.staff?.roleName ?? null,
        spaces: spaces.map((s) => ({
          id: s.id,
          unitId: s.unitId,
          floor: floors.get(s.unitId) ?? null,
          stage: renewalStage(s.endDate, settings),
        })),
      },
    };
  } catch (e) {
    return failure(e, "Couldn't load your workspaces.");
  }
}

export async function setWorkspaceAction(id: string): Promise<{ success: true; redirectTo: string } | Fail> {
  try {
    const tenant = await requireTenant();
    if (tenant.staff) return { success: false, error: "You work in one space only." };
    const target = String(id);
    if (target !== "home") {
      const owns = await prisma.lease.count({ where: { id: target, tenantId: tenant.id, status: "ACTIVE" } });
      if (!owns) return { success: false, error: "That space is no longer yours." };
    }
    await rememberWorkspace(target);
    return { success: true, redirectTo: workspaceHome(target) };
  } catch (e) {
    return failure(e, "Couldn't switch workspace.");
  }
}

// ---------------------------------------------------------------------------
// Payments (current space)
// ---------------------------------------------------------------------------

export type PaymentStatusFilter = "ALL" | EInvoiceStatus;
export type PaymentRow = {
  id: string;
  invoiceNumber: string;
  description: string;
  date: string;
  amount: number;
  status: EInvoiceStatus;
  paidAt: string | null;
  method: string | null;
};

const PAGE_SIZE = 10;

export async function getSpacePaymentsAction(query: { page?: number; sort?: "newest" | "oldest"; status?: PaymentStatusFilter }) {
  try {
    const tenant = await requireTenant();
    if (tenant.staff && !tenant.staff.permissions.includes("payments")) throw new AccessDenied();
    const { lease } = await resolveWorkspace(tenant.id, tenant.staff?.leaseId);
    const spaces = await tenantSpaces(tenant.id);
    if (!lease) return { success: true as const, data: null };
    const settings = await getLeaseSettings();

    // Invoices for this space. Older monthly bills have no lease: they belong
    // to the space with the same unit, or to the tenant's first space.
    const isFirst = spaces[0]?.id === lease.id;
    const rows = await prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { leaseId: lease.id },
          { leaseId: null, unitId: lease.unitId },
          ...(isFirst ? [{ leaseId: null, unitId: null }] : []),
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        month: true,
        description: true,
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        paymentMethod: true,
      },
    });

    const now = new Date();
    const all: PaymentRow[] = rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      description: r.description || `Rent, ${r.month}`,
      date: r.dueDate.toISOString(),
      amount: Number(r.amount) || 0,
      status: invoiceStatus(r.status, r.dueDate, now),
      paidAt: r.paidAt?.toISOString() ?? null,
      method: r.paymentMethod,
    }));

    const status = query?.status ?? "ALL";
    const sort = query?.sort === "oldest" ? "oldest" : "newest";
    const filtered = all
      .filter((r) => status === "ALL" || r.status === status)
      .sort((a, b) => (sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(Number(query?.page) || 1)), pages);

    const unpaid = all.filter((r) => r.status === "DUE" || r.status === "OVERDUE");
    const paid = all.filter((r) => r.status === "PAID");

    return {
      success: true as const,
      data: {
        unitId: lease.unitId,
        monthlyRent: lease.monthlyRent,
        startDate: lease.startDate.toISOString(),
        paidThrough: lease.endDate.toISOString(),
        graceEnds: graceEndDate(lease.endDate, settings).toISOString(),
        stage: renewalStage(lease.endDate, settings, now),
        outstanding: unpaid.reduce((sum, r) => sum + r.amount, 0),
        outstandingCount: unpaid.length,
        totalPaid: paid.reduce((sum, r) => sum + r.amount, 0),
        rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        total: filtered.length,
        page,
        pages,
      },
    };
  } catch (e) {
    return failure(e, "Couldn't load payments.");
  }
}
