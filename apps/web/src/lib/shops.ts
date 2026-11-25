import { prisma, type Prisma, type Tenant, type UnitShop } from "@srmall/database";

/*
 * Shops and units.
 *
 * Every rented unit (lease) belongs to one shop. Lease.shopId says which: null
 * is the tenant's main shop (the Tenant row itself), otherwise a UnitShop row.
 * Units that point to the same shop share one workspace; different shops are
 * fully separate (products, details, promos, reviews, favourites, customer
 * chats and notices). Payments, leases, staff accounts and complaints stay per
 * unit either way.
 *
 * A shop's `id` is what public links use (/shop/[id]); for the main shop it is
 * the tenant's id. In shopId columns the main shop is stored as null.
 */
export type Shop = {
  id: string;
  tenantId: string;
  ownerUserId: string;
  isMain: boolean;
  /** The tenant account's status (ACTIVE, PENDING, ...). */
  status: string;
  /** The units this shop trades from now. */
  unitIds: string[];
  /** The same as text for cards and headings, e.g. "FS1, FS8". */
  unitId: string;
  shopName: string;
  description: string | null;
  logoUrl: string | null;
  galleryUrls: string[];
  category: string;
  phone: string | null;
  openingHours: string | null;
  isOpen: boolean;
  products: Prisma.JsonValue;
  postSales: Prisma.JsonValue;
  createdAt: Date;
};

/** The value kept in shopId columns: null for the main shop. */
export const shopKey = (shop: Pick<Shop, "id" | "isMain">) => (shop.isMain ? null : shop.id);

type Account = Pick<Tenant, "id" | "userId" | "status" | "unitId">;

const content = (s: Tenant | UnitShop) => ({
  shopName: s.shopName,
  description: s.description,
  logoUrl: s.logoUrl,
  galleryUrls: s.galleryUrls,
  category: s.category,
  phone: s.phone,
  openingHours: s.openingHours,
  isOpen: s.isOpen,
  products: s.products,
  postSales: s.postSales,
  createdAt: s.createdAt,
});

const label = (units: string[], fallback: string) => (units.length ? units.join(", ") : fallback);

const mainShop = (t: Tenant, units: string[]): Shop => ({
  id: t.id,
  tenantId: t.id,
  ownerUserId: t.userId,
  isMain: true,
  status: t.status,
  unitIds: units,
  unitId: label(units, t.unitId),
  ...content(t),
});

const extraShop = (u: UnitShop, t: Account, units: string[]): Shop => ({
  id: u.id,
  tenantId: t.id,
  ownerUserId: t.userId,
  isMain: false,
  status: t.status,
  unitIds: units,
  unitId: label(units, u.unitId ?? ""),
  ...content(u),
});

const ACCOUNT = { select: { id: true, userId: true, status: true, unitId: true } } as const;

/** Active units per tenant, grouped by shop key ("" is the main shop). */
async function unitsByShop(tenantIds: string[]) {
  const leases = tenantIds.length
    ? await prisma.lease.findMany({
        where: { status: "ACTIVE", tenantId: { in: tenantIds } },
        orderBy: { startDate: "asc" },
        select: { tenantId: true, unitId: true, shopId: true },
      })
    : [];
  const byShop = new Map<string, string[]>();
  const rented = new Set<string>();
  for (const l of leases) {
    rented.add(l.tenantId);
    const key = `${l.tenantId}:${l.shopId ?? ""}`;
    byShop.set(key, [...(byShop.get(key) ?? []), l.unitId]);
  }
  return {
    of: (tenantId: string, shopId: string | null) => byShop.get(`${tenantId}:${shopId ?? ""}`) ?? [],
    hasLease: (tenantId: string) => rented.has(tenantId),
  };
}

/** Every shop shoppers can see, A to Z. */
export async function listPublicShops(): Promise<Shop[]> {
  const [tenants, extras] = await Promise.all([
    prisma.tenant.findMany({ where: { status: "ACTIVE" } }),
    prisma.unitShop.findMany({
      // An empty shop isn't listed until the tenant has named it.
      where: { shopName: { not: "" }, tenant: { status: "ACTIVE" } },
      include: { tenant: ACCOUNT },
    }),
  ]);
  const units = await unitsByShop(tenants.map((t) => t.id));
  const mains = tenants
    // A main shop with no units of its own is hidden while the others trade;
    // accounts without any lease are listed as before.
    .filter((t) => units.of(t.id, null).length || !units.hasLease(t.id))
    .map((t) => mainShop(t, units.of(t.id, null)));
  const separate = extras
    .filter((u) => units.of(u.tenantId, u.id).length)
    .map((u) => extraShop(u, u.tenant, units.of(u.tenantId, u.id)));
  return [...mains, ...separate].sort((a, b) => a.shopName.localeCompare(b.shopName));
}

/**
 * The shop with this public id, or null. A separate shop is returned only while
 * it is listed; a main shop is returned whatever its status (callers that must
 * hide inactive shops check `status`).
 */
export async function findShop(id: string): Promise<Shop | null> {
  if (!id) return null;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (tenant) return mainShop(tenant, (await unitsByShop([tenant.id])).of(tenant.id, null));
  const row = await prisma.unitShop.findUnique({ where: { id }, include: { tenant: ACCOUNT } });
  if (!row || !row.shopName || row.tenant.status !== "ACTIVE") return null;
  const units = (await unitsByShop([row.tenantId])).of(row.tenantId, row.id);
  return units.length ? extraShop(row, row.tenant, units) : null;
}

/** A public shop id as stored on records: the account, and its shopId column. */
export async function shopRef(shopOrTenantId: string): Promise<{ tenantId: string; shopId: string | null }> {
  const row = await prisma.unitShop.findUnique({ where: { id: String(shopOrTenantId) }, select: { id: true, tenantId: true } });
  return row ? { tenantId: row.tenantId, shopId: row.id } : { tenantId: shopOrTenantId, shopId: null };
}

/** One of this tenant's own shops by id (listed or not), or null. */
export async function ownShop(tenantId: string, shopId: string): Promise<Shop | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;
  const units = await unitsByShop([tenantId]);
  if (shopId === tenant.id) return mainShop(tenant, units.of(tenantId, null));
  const row = await prisma.unitShop.findFirst({ where: { id: shopId, tenantId } });
  return row ? extraShop(row, tenant, units.of(tenantId, row.id)) : null;
}

/** The shop of a lease's unit (the main shop when there is no lease). */
export async function shopOfLease(tenantId: string, lease: { shopId: string | null } | null | undefined) {
  return ownShop(tenantId, lease?.shopId ?? tenantId);
}

/** Names for menus: pass a lease's shopId. "" until the tenant names the shop. */
export async function shopNames(tenantId: string) {
  const [tenant, extras] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { shopName: true } }),
    prisma.unitShop.findMany({ where: { tenantId }, select: { id: true, shopName: true } }),
  ]);
  const names = new Map(extras.map((u) => [u.id, u.shopName]));
  return (shopId: string | null) => (shopId ? (names.get(shopId) ?? "") : (tenant?.shopName ?? ""));
}

/**
 * Put a unit in a shop: "main", "new" (a separate, empty shop) or the id of
 * another of the tenant's shops. Nothing is deleted: a shop the unit leaves
 * keeps all its records and can be chosen again.
 */
export async function assignUnitShop(tenantId: string, leaseId: string, choice: string) {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, tenantId, status: "ACTIVE" },
    select: { id: true, unitId: true, shopId: true },
  });
  if (!lease) return { ok: false as const, error: "That unit is no longer yours." };

  let shopId: string | null = null;
  if (choice === "new") {
    // Reuse this unit's earlier shop that nothing else is using, so switching
    // back and forth brings its data back instead of piling up empty shops.
    const previous = await prisma.unitShop.findFirst({
      where: { tenantId, unitId: lease.unitId, leases: { none: { status: "ACTIVE" } } },
      orderBy: { createdAt: "desc" },
    });
    const account = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { category: true } });
    shopId =
      previous?.id ??
      (await prisma.unitShop.create({ data: { tenantId, unitId: lease.unitId, category: account?.category ?? "Other" } })).id;
  } else if (choice !== "main") {
    const own = await prisma.unitShop.findFirst({ where: { id: choice, tenantId }, select: { id: true } });
    if (!own) return { ok: false as const, error: "That shop isn't linked to your account." };
    shopId = own.id;
  }
  await prisma.lease.update({ where: { id: lease.id }, data: { shopId } });
  return { ok: true as const, shopId };
}

/** A unit rented again goes back to the shop it had before. */
export async function previousShopOfUnit(db: Prisma.TransactionClient, tenantId: string, unitId: string) {
  const last = await db.lease.findFirst({
    where: { tenantId, unitId },
    orderBy: { startDate: "desc" },
    select: { shopId: true },
  });
  return last?.shopId ?? null;
}
