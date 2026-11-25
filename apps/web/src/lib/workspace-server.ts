/**
 * Tenant workspaces: "home" (the account) or one per active lease (a space).
 * The choice lives in a cookie; it is only a view preference, so every read
 * re-checks that the lease still belongs to the signed-in tenant.
 */
import { cookies } from "next/headers";
import { prisma } from "@srmall/database";
import { AccessDenied, currentAccount } from "@/lib/auth-server";

export const WORKSPACE_COOKIE = "srmall_ws";
export type WorkspaceId = "home" | string;

export async function tenantSpaces(tenantId: string) {
  return prisma.lease.findMany({
    where: { tenantId, status: "ACTIVE" },
    orderBy: { startDate: "asc" },
    select: { id: true, unitId: true, shopId: true, startDate: true, endDate: true, monthlyRent: true },
  });
}

/** The workspace to show: the cookie's choice if still valid, else the first space, else home. */
export async function resolveWorkspace(tenantId: string, onlyLeaseId?: string) {
  // Staff see only the space they work in, and have no Home workspace.
  const spaces = (await tenantSpaces(tenantId)).filter((sp) => !onlyLeaseId || sp.id === onlyLeaseId);
  if (onlyLeaseId) return { current: spaces[0]?.id ?? "home", spaces, lease: spaces[0] ?? null };
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current: WorkspaceId =
    wanted === "home" ? "home" : spaces.find((s) => s.id === wanted)?.id ?? spaces[0]?.id ?? "home";
  return { current, spaces, lease: spaces.find((s) => s.id === current) ?? null };
}

/**
 * What the signed-in tenant is looking at: the chosen unit and the shop it
 * belongs to. Everything shop-specific is filtered by `shopKey` / `shopId`,
 * everything unit-specific (payments, complaints) by `unitId`.
 */
export async function workspaceScope(tenantId: string, staffLeaseId?: string) {
  const { current, spaces, lease } = await resolveWorkspace(tenantId, staffLeaseId);
  const shopKey = lease?.shopId ?? null;
  return {
    current,
    spaces,
    lease,
    unitId: lease?.unitId ?? null,
    /** For shopId columns: null is the main shop. */
    shopKey,
    /** The shop's public id (the tenant id for the main shop). */
    shopId: shopKey ?? tenantId,
  };
}

/**
 * The active space a bill belongs to: its lease, else its unit, else the first
 * (main) space, so older and ended-lease bills are never lost.
 */
export function spaceOfBill<S extends { id: string; unitId: string }>(
  spaces: S[],
  bill: { leaseId: string | null; unitId: string | null },
) {
  return spaces.find((s) => s.id === bill.leaseId) ?? spaces.find((s) => s.unitId === bill.unitId) ?? spaces[0];
}

/** For a tenant looking at one unit: only that unit's bills. Home, and mall staff, see all of them. */
export async function billsInWorkspace<B extends { leaseId: string | null; unitId: string | null }>(
  tenantId: string,
  bills: B[],
) {
  const account = await currentAccount();
  if (account?.type !== "TENANT") return { bills, lease: null };
  const { lease } = await resolveWorkspace(tenantId, account.tenantStaff?.leaseId);
  if (!lease) return { bills: account.tenantStaff ? [] : bills, lease };
  const spaces = await tenantSpaces(tenantId);
  return { bills: bills.filter((b) => spaceOfBill(spaces, b)?.id === lease.id), lease };
}

export async function rememberWorkspace(id: WorkspaceId) {
  (await cookies()).set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export const workspaceHome = (id: WorkspaceId) => (id === "home" ? "/tenantdashboard/home" : "/tenantdashboard");

/**
 * The signed-in tenant (owner or staff) and, for staff, their one space and
 * permissions. Throws AccessDenied otherwise.
 */
export async function requireTenant() {
  const account = await currentAccount();
  if (!account || account.type !== "TENANT") throw new AccessDenied("Please sign in at the tenant portal.");
  if (account.isBlacklisted) throw new AccessDenied("Your account is restricted. Please contact the management office.");
  const staff = account.tenantStaff;
  const tenant = await prisma.tenant.findUnique({
    where: staff ? { id: staff.tenantId } : { userId: account.id },
    select: { id: true, userId: true, shopName: true, status: true },
  });
  if (!tenant) throw new AccessDenied("Tenant record not found. Please contact the management office.");
  return { ...tenant, staff };
}

/** Owner-only actions (renting spaces, managing staff). */
export async function requireTenantOwner() {
  const tenant = await requireTenant();
  if (tenant.staff) throw new AccessDenied("Only the store owner can do this.");
  return tenant;
}
