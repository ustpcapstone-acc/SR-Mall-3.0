"use server";

/**
 * Tenant workspaces (Home, plus one per rented space) and the per-space
 * Payments page. Everything is read from the signed-in session.
 */
import { revalidatePath } from "next/cache";
import { assignUnitShop, shopNames } from "@/lib/shops";
import { prisma } from "@srmall/database";
import { AccessDenied } from "@/lib/auth-server";
import { graceEndDate, invoiceStatus, renewalStage, type EInvoiceStatus, type RenewalStage } from "@/lib/leasing";
import { getLeaseSettings } from "@/lib/leasing-server";
import {
  rememberWorkspace,
  requireTenant,
  requireTenantOwner,
  resolveWorkspace,
  spaceOfBill,
  tenantSpaces,
  workspaceHome,
} from "@/lib/workspace-server";

type Fail = { success: false; error: string };

function failure(e: unknown, fallback: string): Fail {
  if (e instanceof AccessDenied) return { success: false, error: e.message };
  console.error("[WORKSPACE]", e);
  return { success: false, error: fallback };
}

export type WorkspaceSpace = {
  id: string;
  unitId: string;
  /** null: the main shop. Units with the same value share one shop. */
  shopId: string | null;
  shopName: string;
  floor: string | null;
  stage: RenewalStage;
};

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
    const nameOf = await shopNames(tenant.id);
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
          shopId: s.shopId,
          shopName: nameOf(s.shopId),
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

/**
 * Owner only: put a unit in the same shop as other units, or give it a separate
 * shop of its own ("main", "new" or one of the tenant's shop ids).
 */
export async function setUnitShopAction(leaseId: string, choice: string): Promise<{ success: true } | Fail> {
  try {
    const tenant = await requireTenantOwner();
    const res = await assignUnitShop(tenant.id, String(leaseId), String(choice));
    if (!res.ok) return { success: false, error: res.error };
    revalidatePath("/tenantdashboard", "layout");
    revalidatePath("/tenant-directory");
    revalidatePath(`/shop/${tenant.id}`);
    if (res.shopId) revalidatePath(`/shop/${res.shopId}`);
    return { success: true };
  } catch (e) {
    return failure(e, "Couldn't change the shop of that unit.");
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
  /** A deposit slip was uploaded and the mall office hasn't confirmed it yet. */
  checking: boolean;
};

/** An unpaid bill of the unit being viewed (on Home: of any unit or ended lease). */
export type BillToPay = {
  id: string;
  invoiceNumber: string;
  description: string;
  unitId: string | null;
  dueDate: string;
  amount: number;
  overdue: boolean;
  checking: boolean;
};

const PAGE_SIZE = 10;

export async function getSpacePaymentsAction(query: { page?: number; sort?: "newest" | "oldest"; status?: PaymentStatusFilter }) {
  try {
    const tenant = await requireTenant();
    if (tenant.staff && !tenant.staff.permissions.includes("payments")) throw new AccessDenied();
    const { lease } = await resolveWorkspace(tenant.id, tenant.staff?.leaseId);
    const spaces = await tenantSpaces(tenant.id);
    const settings = lease ? await getLeaseSettings() : null;

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        // Store staff only see the bills of the space they work in.
        ...(tenant.staff && { OR: [{ leaseId: null }, { leaseId: tenant.staff.leaseId }] }),
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
        leaseId: true,
        unitId: true,
      },
    });
    // Staff without a current space have nothing to see.
    const visible = tenant.staff && !lease ? [] : invoices;

    // Payments are kept per unit: only this space's bills. Bills of ended
    // leases and older ones without a unit stay with the first space. With no
    // current space, everything is listed.
    const rows = lease ? visible.filter((r) => spaceOfBill(spaces, r)?.id === lease.id) : visible;

    const now = new Date();
    const describe = (r: (typeof invoices)[number]) => r.description || `Rent, ${r.month}`;
    const all: PaymentRow[] = rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      description: describe(r),
      date: r.dueDate.toISOString(),
      amount: Number(r.amount) || 0,
      status: invoiceStatus(r.status, r.dueDate, now),
      paidAt: r.paidAt?.toISOString() ?? null,
      method: r.paymentMethod,
      checking: r.status === "REVIEWING",
    }));

    const bills: BillToPay[] = rows
      .map((r) => ({ r, state: invoiceStatus(r.status, r.dueDate, now) }))
      .filter(({ state }) => state === "DUE" || state === "OVERDUE")
      .sort((a, b) => a.r.dueDate.getTime() - b.r.dueDate.getTime())
      .map(({ r, state }) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        description: describe(r),
        unitId: r.unitId,
        dueDate: r.dueDate.toISOString(),
        amount: Number(r.amount) || 0,
        overdue: state === "OVERDUE",
        checking: r.status === "REVIEWING",
      }));

    const status = query?.status ?? "ALL";
    const sort = query?.sort === "oldest" ? "oldest" : "newest";
    const filtered = all
      .filter((r) => status === "ALL" || r.status === status)
      .sort((a, b) => (sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(Number(query?.page) || 1)), pages);

    const paid = all.filter((r) => r.status === "PAID");

    return {
      success: true as const,
      data: {
        /** The space being viewed; null on Home or with no current lease. */
        space:
          lease && settings
            ? {
                unitId: lease.unitId,
                monthlyRent: lease.monthlyRent,
                startDate: lease.startDate.toISOString(),
                paidThrough: lease.endDate.toISOString(),
                graceEnds: graceEndDate(lease.endDate, settings).toISOString(),
                stage: renewalStage(lease.endDate, settings, now),
                totalPaid: paid.reduce((sum, r) => sum + r.amount, 0),
              }
            : null,
        bills,
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
