/**
 * Tenant History — a permanent snapshot saved whenever a tenant leaves, so the
 * record survives the tenant being deleted or re-applying later.
 *
 * Call `recordTenantExit()` BEFORE the unit is freed / the record deleted
 * (it reads the unit, floor, invoices and rating at that moment).
 * Server-only. Raw SQL: the table is newer than the generated Prisma client.
 */
import { prisma } from "@srmall/database";

export type TenantExitReason = "REMOVED" | "ROLE_CHANGED" | "MARKED_PAST";

export const TENANT_EXIT_REASONS: Record<TenantExitReason, string> = {
  REMOVED: "Removed by admin",
  ROLE_CHANGED: "Changed to customer",
  MARKED_PAST: "Marked as past tenant",
};

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
