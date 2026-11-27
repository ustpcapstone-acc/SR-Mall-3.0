/**
 * What the unit editor (Floor Spaces & Map) may change. Status and Unit ID are
 * how leases, tenants and reservations find a unit, so editing them by hand can
 * silently end a lease. Used by the editor and enforced again on the server.
 */
export type UnitStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

/** Who is tied to a unit. Both empty for a free one. */
export type UnitHold = {
  /** Shop with an active lease on the unit. */
  leasedTo: string | null;
  /** Shop whose tenant record is on the unit, with or without a lease. */
  assignedTo: string | null;
  /** That tenant, for a link to Tenant Monitoring. */
  tenantId: string | null;
};

export const NO_HOLD: UnitHold = { leasedTo: null, assignedTo: null, tenantId: null };

/** Unit IDs that differ only by capitals or spaces name the same unit to people. */
export const unitKey = (unitId: string) => unitId.replace(/\s+/g, "").toUpperCase();

export const twinMessage = (existing: string) =>
  `Unit "${existing}" already exists. IDs that differ only by capitals or spaces count as the same.`;

export const MAX_UNIT_RENT = 100_000_000;

export type UnitLock = {
  /** Statuses that may be saved. */
  statuses: UnitStatus[];
  /** True while a lease, tenant or reservation points at the Unit ID. */
  idLocked: boolean;
  /** Why something is locked, or what to expect. */
  note: string;
};

/** `current` is the saved unit, or null for a new one. */
export function unitLock(current: { status: string; tenant_id?: string | null } | null, hold: UnitHold = NO_HOLD): UnitLock {
  const empty: UnitStatus[] = ["AVAILABLE", "MAINTENANCE"];
  const automatic = "Occupied is set automatically when a tenant moves in.";
  if (!current) return { statuses: empty, idLocked: false, note: automatic };

  const now = current.status as UnitStatus;
  // Unchanged is always fine; a held unit may also be put right to Occupied.
  const held: UnitStatus[] = now === "OCCUPIED" ? ["OCCUPIED"] : [now, "OCCUPIED"];

  if (hold.leasedTo) {
    return {
      statuses: held,
      idLocked: true,
      note: `Rented by ${hold.leasedTo}. To free this unit or change its ID, end the lease on the Renewals page first.`,
    };
  }
  if (now === "RESERVED" && current.tenant_id) {
    return {
      statuses: ["RESERVED"],
      idLocked: true,
      note: "This unit is reserved. Approve or reject the reservation to change its status or ID.",
    };
  }
  if (hold.assignedTo) {
    return {
      statuses: held,
      idLocked: true,
      note: `Assigned to ${hold.assignedTo}. To free this unit or change its ID, change their unit in Tenant Monitoring first.`,
    };
  }
  if (now === "OCCUPIED" || now === "RESERVED") {
    return {
      statuses: [now, ...empty],
      idLocked: false,
      note: "No tenant is linked to this unit. Set it to Available if it's empty.",
    };
  }
  return { statuses: empty, idLocked: false, note: automatic };
}
