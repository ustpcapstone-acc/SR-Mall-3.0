/**
 * What a tenant rents, from real records only. Active leases give the units,
 * monthly rent and dates. A current tenant with a unit but no lease (older
 * records) shows that unit's listed rent and no dates. Nothing is guessed.
 */
export type RentLease = { unitId: string; startDate: Date | string; endDate: Date | string; monthlyRent: number };
export type RentSlot = { unit_id: string; base_rent: number | null; sqm_size: number | null };

export function rentOf(
  tenant: { status: string; unitId: string | null; leases: RentLease[] },
  slots: RentSlot[],
) {
  const leases = [...tenant.leases].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const slotOf = (unitId: string | null) => slots.find((s) => s.unit_id === unitId);
  const listed = !leases.length && tenant.status === "ACTIVE" ? slotOf(tenant.unitId) : undefined;
  const units = leases.length ? leases.map((l) => l.unitId) : tenant.unitId ? [tenant.unitId] : [];
  const earliest = (dates: (Date | string)[]) =>
    dates.length ? new Date(Math.min(...dates.map((d) => new Date(d).getTime()))) : null;
  return {
    leases,
    units,
    /** Total for a month across the tenant's units; 0 when no rent is recorded. */
    monthlyRent: leases.length ? leases.reduce((sum, l) => sum + l.monthlyRent, 0) : (listed?.base_rent ?? 0),
    /** Where that figure comes from. */
    source: leases.length ? ("lease" as const) : listed?.base_rent ? ("listed" as const) : ("none" as const),
    sqm: (leases.length ? units : listed ? [listed.unit_id] : []).reduce((sum, u) => sum + (slotOf(u)?.sqm_size ?? 0), 0),
    startDate: earliest(leases.map((l) => l.startDate)),
    /** The first date any of the leases runs out (rent is paid through it). */
    paidThrough: earliest(leases.map((l) => l.endDate)),
  };
}
