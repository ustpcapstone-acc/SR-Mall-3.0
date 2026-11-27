import { prisma } from "@srmall/database";
import type { UnitHold } from "@/lib/unit-rules";

/** Tenant records in these states no longer hold a unit. */
const GONE = ["PAST", "REJECTED", "REMOVED"];

/** Leases and tenant records per unit id; pass ids to look up only those. */
export async function unitHolds(unitIds?: string[]): Promise<Record<string, UnitHold>> {
  const only = unitIds ? { unitId: { in: unitIds } } : {};
  const [leases, tenants] = await Promise.all([
    prisma.lease.findMany({
      where: { status: "ACTIVE", ...only },
      select: { unitId: true, tenantId: true, shop: { select: { shopName: true } }, tenant: { select: { shopName: true } } },
    }),
    prisma.tenant.findMany({
      where: { status: { notIn: GONE }, ...only },
      select: { id: true, unitId: true, shopName: true },
    }),
  ]);
  const holds: Record<string, UnitHold> = {};
  const hold = (id: string) => (holds[id] ??= { leasedTo: null, assignedTo: null, tenantId: null });
  for (const l of leases) {
    const h = hold(l.unitId);
    // A unit can run its own shop; otherwise it trades under the tenant's main one.
    h.leasedTo = l.shop?.shopName || l.tenant.shopName || "a tenant";
    h.tenantId = l.tenantId;
  }
  for (const t of tenants) {
    if (!t.unitId) continue;
    const h = hold(t.unitId);
    h.assignedTo = t.shopName || "a tenant";
    h.tenantId ??= t.id;
  }
  return holds;
}
