/**
 * Server-side identity: who is signed in (from the signed session cookie) and
 * what a staff account may open. Use these in server actions instead of
 * trusting a user id sent from the browser.
 */
import { cookies } from "next/headers";
import { prisma } from "@srmall/database";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  accountTypeOf,
  signSession,
  verifySession,
  type AccountType,
} from "@/lib/session";
import { ALL_PERMISSIONS, isStaffPermission, type StaffAccess, type StaffPermission } from "@/lib/permissions";
import { isSpacePermission, type SpacePermission } from "@/lib/tenant-permissions";

export type Account = {
  id: string;
  type: AccountType;
  isBlacklisted: boolean;
  isSuperuser: boolean;
  roleName: string | null;
  permissions: StaffPermission[];
  /**
   * Set for tenant staff (User.role TENANT_STAFF): the one space they work in.
   * ownerUserId is the tenant owner they act for in the dashboard.
   */
  tenantStaff: { tenantId: string; leaseId: string; ownerUserId: string; roleName: string; permissions: SpacePermission[] } | null;
};

// Short in-process cache so page loads and prefetches don't each hit the
// database. A role change takes effect within this window.
const CACHE_MS = 10_000;
const cache = new Map<string, { at: number; value: Account | null }>();

export function forgetAccount(userId: string) {
  cache.delete(userId);
}

export async function loadAccount(userId: string): Promise<Account | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isBlacklisted: true,
      isSuperuser: true,
      staffRole: { select: { name: true, permissions: true } },
      spaceStaff: {
        select: {
          isActive: true,
          tenantId: true,
          leaseId: true,
          lease: { select: { status: true } },
          role: { select: { name: true, permissions: true } },
          tenant: { select: { userId: true } },
        },
      },
    },
  });
  // Tenant staff only work while they are active and their space is still rented.
  const ss = u?.role === "TENANT_STAFF" ? u.spaceStaff : null;
  const staffOk = !!ss && ss.isActive && ss.lease.status === "ACTIVE";
  const type = u ? accountTypeOf(u.role) : null;
  const value: Account | null = u
    ? {
        id: u.id,
        type: type!,
        isBlacklisted: u.isBlacklisted || (u.role === "TENANT_STAFF" && !staffOk),
        isSuperuser: type === "ADMIN" && u.isSuperuser,
        roleName: u.staffRole?.name ?? null,
        permissions:
          type !== "ADMIN"
            ? []
            : u.isSuperuser
              ? [...ALL_PERMISSIONS]
              : (u.staffRole?.permissions ?? []).filter(isStaffPermission),
        tenantStaff:
          ss && staffOk
            ? {
                tenantId: ss.tenantId,
                leaseId: ss.leaseId,
                ownerUserId: ss.tenant.userId,
                roleName: ss.role.name,
                permissions: ss.role.permissions.filter(isSpacePermission),
              }
            : null,
      }
    : null;
  cache.set(userId, { at: Date.now(), value });
  return value;
}

/**
 * The user id the browser works with. Tenant staff act for the tenant owner,
 * so the dashboard pages load the owner's store.
 */
export function actingUserId(account: Account) {
  return account.tenantStaff?.ownerUserId ?? account.id;
}

export function staffAccess(account: Account): StaffAccess {
  return { isSuperuser: account.isSuperuser, permissions: account.permissions };
}

/** Starts a session for this account (call after the password or Google check passed). */
export async function startSession(userId: string, type: AccountType) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId, type), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in, active account, or null. */
export async function currentAccount(): Promise<Account | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const account = await loadAccount(session.uid);
  if (!account || account.isBlacklisted || account.type !== session.typ) return null;
  return account;
}

export class AccessDenied extends Error {
  constructor(message = "You don't have access to this.") {
    super(message);
  }
}

/** The signed-in staff account; throws AccessDenied without the permission. */
export async function requireStaff(permission?: StaffPermission): Promise<Account> {
  const account = await currentAccount();
  if (!account || account.type !== "ADMIN") throw new AccessDenied("Please sign in at the staff portal.");
  if (permission && !account.isSuperuser && !account.permissions.includes(permission)) throw new AccessDenied();
  return account;
}

export async function requireSuperuser(): Promise<Account> {
  const account = await requireStaff();
  if (!account.isSuperuser) throw new AccessDenied("Only the superuser can do this.");
  return account;
}
