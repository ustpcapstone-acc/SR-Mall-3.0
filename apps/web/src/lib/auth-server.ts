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

export type Account = {
  id: string;
  type: AccountType;
  isBlacklisted: boolean;
  isSuperuser: boolean;
  roleName: string | null;
  permissions: StaffPermission[];
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
    },
  });
  const type = u ? accountTypeOf(u.role) : null;
  const value: Account | null = u
    ? {
        id: u.id,
        type: type!,
        isBlacklisted: u.isBlacklisted,
        isSuperuser: type === "ADMIN" && u.isSuperuser,
        roleName: u.staffRole?.name ?? null,
        permissions:
          type !== "ADMIN"
            ? []
            : u.isSuperuser
              ? [...ALL_PERMISSIONS]
              : (u.staffRole?.permissions ?? []).filter(isStaffPermission),
      }
    : null;
  cache.set(userId, { at: Date.now(), value });
  return value;
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
