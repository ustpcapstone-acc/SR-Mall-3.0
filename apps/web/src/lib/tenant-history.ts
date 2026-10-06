/**
 * Tenant History — a permanent snapshot saved whenever a tenant leaves, so the
 * record survives the tenant being deleted or re-applying later.
 *
 * Call `recordTenantExit()` BEFORE the unit is freed / the record deleted
 * (it reads the unit, floor, invoices and rating at that moment).
 * Server-only. Raw SQL: the table is newer than the generated Prisma client.
 */
import { prisma } from "@srmall/database";

export type TenantExitReason = "REMOVED" | "ROLE_CHANGED" | "MARKED_PAST" | "RESERVATION_REJECTED";

export const TENANT_EXIT_REASONS: Record<TenantExitReason, string> = {
  REMOVED: "Removed by admin",
  ROLE_CHANGED: "Changed to customer",
  MARKED_PAST: "Marked as past tenant",
  RESERVATION_REJECTED: "Reservation rejected",
};

/**
 * Snapshot when the admin rejects a unit reservation. The person reserving is
 * often a customer with no Tenant record yet, so the row is keyed by their
 * Tenant id when they have one, otherwise by their user id. "Lease start" is
 * when the reservation was made; "ended" is when it was rejected.
 */
export async function recordRejectedReservation(opts: {
  userId: string;
  unitId: string;
  floor?: string | null;
  category?: string | null;
  reservedAt: Date;
  feedback?: string | null;
  endedById?: string | null;
}) {
  try {
    const [user, admin] = await Promise.all([
      prisma.user.findUnique({
        where: { id: opts.userId },
        select: { name: true, email: true, tenant: { select: { id: true, shopName: true, category: true, logoUrl: true } } },
      }),
      opts.endedById ? prisma.user.findUnique({ where: { id: opts.endedById }, select: { name: true, email: true } }) : null,
    ]);
    if (!user) return;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "TenantHistory" ("id","tenantId","userId","shopName","ownerName","ownerEmail","unitId","floor","category","logoUrl",
                                    "leaseStart","endedAt","reason","note","endedById","endedByName")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      user.tenant?.id ?? opts.userId,
      opts.userId,
      user.tenant?.shopName || user.name || user.email,
      user.name ?? null,
      user.email ?? null,
      opts.unitId,
      opts.floor ?? null,
      user.tenant?.category ?? opts.category ?? null,
      user.tenant?.logoUrl ?? null,
      opts.reservedAt,
      new Date(),
      "RESERVATION_REJECTED",
      opts.feedback?.trim() || null,
      opts.endedById ?? null,
      admin ? admin.name || admin.email : null,
    );
  } catch (error) {
    // History must never block the action that triggered it.
    console.error("[tenant-history] reservation snapshot failed:", error);
  }
}

export async function recordTenantExit(
  tenantId: string,
  reason: TenantExitReason,
  opts: { endedById?: string | null; note?: string | null } = {},
) {
  try {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!t) return;

    const unit = t.unitId && !["UNASSIGNED", "PENDING_ASSIGNMENT"].includes(t.unitId) ? t.unitId : null;
    const [slot, money, rating, admin] = await Promise.all([
      unit ? prisma.areaSlot.findUnique({ where: { unit_id: unit }, select: { floor: true } }) : null,
      prisma.$queryRawUnsafe<{ paid: number; outstanding: number; n: number }[]>(
        `SELECT COALESCE(SUM(CASE WHEN "status" IN ('PAID','PAST') THEN "amount" END), 0)::float AS paid,
                COALESCE(SUM(CASE WHEN "status" NOT IN ('PAID','PAST','REJECTED') THEN "amount" END), 0)::float AS outstanding,
                COUNT(*)::int AS n
           FROM "Invoice" WHERE "tenantId" = $1`,
        tenantId,
      ),
      prisma.review.aggregate({ where: { tenantId, isApproved: true }, _avg: { rating: true }, _count: { _all: true } }),
      opts.endedById ? prisma.user.findUnique({ where: { id: opts.endedById }, select: { name: true, email: true } }) : null,
    ]);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "TenantHistory" ("id","tenantId","userId","shopName","ownerName","ownerEmail","unitId","floor","category","logoUrl",
                                    "leaseStart","endedAt","reason","note","totalPaid","outstanding","invoiceCount","avgRating","reviewCount",
                                    "endedById","endedByName")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      t.id,
      t.userId,
      t.shopName,
      t.user?.name ?? null,
      t.user?.email ?? null,
      unit,
      slot?.floor ?? null,
      t.category ?? null,
      t.logoUrl ?? null,
      t.createdAt,
      new Date(),
      reason,
      opts.note?.trim() || null,
      Number(money[0]?.paid || 0),
      Number(money[0]?.outstanding || 0),
      Number(money[0]?.n || 0),
      Number(rating._avg.rating || 0),
      rating._count._all,
      opts.endedById ?? null,
      admin ? admin.name || admin.email : null,
    );
  } catch (error) {
    // History must never block the action that triggered it.
    console.error("[tenant-history] snapshot failed:", error);
  }
}
