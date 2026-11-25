/**
 * "May this caller do that?" for server actions. Anyone can call a server
 * action with any arguments, so an id sent by the browser is only a request:
 * it is checked here against the signed session cookie. Every require* helper
 * throws AccessDenied.
 */
import { prisma } from "@srmall/database";
import { AccessDenied, actingUserId, currentAccount, type Account } from "@/lib/auth-server";
import type { StaffPermission } from "@/lib/permissions";
import type { SpacePermission } from "@/lib/tenant-permissions";

const SIGN_IN = "Please sign in again.";

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) throw new AccessDenied(SIGN_IN);
  return account;
}

/** Staff-portal account holding any of these permissions. */
export function holds(account: Account, ...permissions: StaffPermission[]) {
  return account.type === "ADMIN" && (account.isSuperuser || permissions.some((p) => account.permissions.includes(p)));
}

export async function requireStaffAny(...permissions: StaffPermission[]): Promise<Account> {
  const account = await requireAccount();
  if (!holds(account, ...permissions)) throw new AccessDenied();
  return account;
}

/**
 * The tenant owner, or store staff acting for that owner. Staff also need one of
 * the listed sections (none listed: any of the owner's staff).
 */
export function worksFor(account: Account, ownerUserId: string | null | undefined, ...sections: SpacePermission[]) {
  if (!ownerUserId || account.type !== "TENANT" || actingUserId(account) !== ownerUserId) return false;
  const staff = account.tenantStaff;
  return !staff || !sections.length || sections.some((s) => staff.permissions.includes(s));
}

/** For personal data (password, profile, reviews): only the account itself. */
export async function requireSelf(userId: string | null | undefined): Promise<Account> {
  const account = await requireAccount();
  if (account.id !== userId) throw new AccessDenied(SIGN_IN);
  return account;
}

/** The account itself, or store staff using the owner's id (as the dashboard does). */
export async function requireActingAs(userId: string | null | undefined): Promise<Account> {
  const account = await requireAccount();
  if (account.id !== userId && !worksFor(account, userId)) throw new AccessDenied(SIGN_IN);
  return account;
}

type StoreAccess = { sections: SpacePermission[]; staff?: StaffPermission[] };

/** A store's own people (by the owner's user id), or the listed mall staff. */
export async function requireStore(ownerUserId: string | null | undefined, access: StoreAccess): Promise<Account> {
  const account = await requireAccount();
  if (worksFor(account, ownerUserId, ...access.sections) || holds(account, ...(access.staff ?? []))) return account;
  throw new AccessDenied();
}

/** requireStore, starting from the Tenant record's id. */
export async function requireTenantRecord(tenantId: string, access: StoreAccess): Promise<Account> {
  await requireAccount();
  const tenant = await prisma.tenant.findUnique({ where: { id: String(tenantId) }, select: { userId: true } });
  return requireStore(tenant?.userId, access);
}
