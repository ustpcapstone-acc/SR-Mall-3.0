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
    select: { id: true, unitId: true, startDate: true, endDate: true, monthlyRent: true },
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
