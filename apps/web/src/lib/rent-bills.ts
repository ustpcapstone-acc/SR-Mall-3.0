/**
 * Monthly rent bills. A rent bill is an invoice that covers a period of one
 * lease; paying it moves the lease's "paid through" date to the end of that
 * period. Safe to import from client and server code.
 */
import { addMonths, daysUntil } from "@/lib/leasing";

/** Bills still waiting for money (a slip being checked counts). */
export const OPEN_BILL = ["PENDING", "OVERDUE", "REJECTED", "REVIEWING"];

export type BillPeriod = {
  leaseId?: string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
};

export const isRentBill = <B extends BillPeriod>(b: B): b is B & { leaseId: string; periodStart: Date | string; periodEnd: Date | string } =>
  Boolean(b.leaseId && b.periodStart && b.periodEnd);

/** The same Philippine calendar day. */
export const sameDay = (a: Date | string, b: Date | string) => daysUntil(a, new Date(b)) === 0;

/** How many months a bill period spans (at least 1). */
export function monthsCovered(start: Date | string, end: Date | string) {
  let months = 1;
  while (months < 60 && daysUntil(addMonths(start, months), new Date(end)) < 0) months++;
  return months;
}

export type ExtraCharge = { description: string; amount: number };

export const CHARGE_LIMITS = { rows: 10, description: 80, amount: 10_000_000 };

/** Charges added to a rent bill, checked; or what is wrong with them. */
export function checkCharges(input: ExtraCharge[] | undefined): ExtraCharge[] | string {
  const rows = Array.isArray(input) ? input : [];
  if (rows.length > CHARGE_LIMITS.rows) return `Add at most ${CHARGE_LIMITS.rows} charges.`;
  const out: ExtraCharge[] = [];
  for (const row of rows) {
    const description = String(row?.description ?? "").trim().slice(0, CHARGE_LIMITS.description);
    const amount = Math.round(Number(row?.amount) * 100) / 100;
    if (!description) return "Name each charge.";
    if (!Number.isFinite(amount) || amount <= 0 || amount > CHARGE_LIMITS.amount) return `Enter an amount for "${description}".`;
    out.push({ description, amount });
  }
  return out;
}

/** Rent plus charges, added in centavos. */
export const billTotal = (rent: number, charges: { amount: number }[]) =>
  charges.reduce((sum, c) => sum + Math.round((Number(c.amount) || 0) * 100), Math.round(rent * 100)) / 100;
