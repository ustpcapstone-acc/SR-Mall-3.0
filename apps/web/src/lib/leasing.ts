/**
 * Leasing rules shared by the admin pages, the tenant pages and the renewal
 * cron. Client/server safe.
 *
 * A lease's endDate is the day rent is paid through, so it is also the day the
 * next renewal payment is due. After it come the grace days; when those run
 * out without a payment, the tenant is removed from the space.
 */

export const PAYMENT_METHODS = ["Cash", "Check", "Bank transfer", "GCash", "Maya", "Card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TERM_CHOICES = [1, 3, 6, 12, 24] as const;
export const MAX_MONTHS = 60;

export type LeaseSettingsData = { reminderDays: number[]; graceDays: number; finalWarningDays: number };
export const DEFAULT_LEASE_SETTINGS: LeaseSettingsData = { reminderDays: [7, 1], graceDays: 7, finalWarningDays: 1 };

/** Window the Renewals page calls "upcoming". */
export const UPCOMING_WINDOW_DAYS = 30;

export type RenewalStage = "ACTIVE" | "UPCOMING" | "DUE" | "GRACE" | "OVERDUE";

export const STAGE_LABEL: Record<RenewalStage, string> = {
  ACTIVE: "Active",
  UPCOMING: "Upcoming",
  DUE: "Due today",
  GRACE: "Grace period",
  OVERDUE: "Overdue",
};

const DAY = 24 * 60 * 60 * 1000;

/** Manila calendar day number (whole days since epoch, UTC+8). */
function phDay(d: Date | string) {
  return Math.floor((new Date(d).getTime() + 8 * 60 * 60 * 1000) / DAY);
}

/** Whole Manila days from `now` until `date` (negative when past). */
export function daysUntil(date: Date | string, now: Date = new Date()) {
  return phDay(date) - phDay(now);
}

const PH_OFFSET = 8 * 60 * 60 * 1000;

/** Same Manila day of month, `months` later (clamped to the month's last day). */
export function addMonths(date: Date | string, months: number) {
  // Work on the Manila calendar: shift to UTC+8, do the maths in UTC, shift back.
  const r = new Date(new Date(date).getTime() + PH_OFFSET);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return new Date(r.getTime() - PH_OFFSET);
}

export function addDays(date: Date | string, days: number) {
  return new Date(new Date(date).getTime() + days * DAY);
}

/**
 * Where a lease is in its renewal cycle. Grace covers the `graceDays` days
 * after the due date; the day after that it is overdue and gets removed.
 */
export function renewalStage(endDate: Date | string, s: LeaseSettingsData, now: Date = new Date()): RenewalStage {
  const days = daysUntil(endDate, now);
  if (days > Math.max(UPCOMING_WINDOW_DAYS, ...s.reminderDays)) return "ACTIVE";
  if (days > 0) return "UPCOMING";
  if (days === 0) return "DUE";
  if (days >= -s.graceDays) return "GRACE";
  return "OVERDUE";
}

/** Last day of grace; removal happens the day after. */
export function graceEndDate(endDate: Date | string, s: LeaseSettingsData) {
  return addDays(endDate, s.graceDays);
}

export function cleanSettings(input: Partial<LeaseSettingsData>): LeaseSettingsData | string {
  const reminderDays = [...new Set((input.reminderDays ?? []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90)
    .sort((a, b) => b - a);
  const graceDays = Number(input.graceDays);
  const finalWarningDays = Number(input.finalWarningDays);
  if (!reminderDays.length) return "Add at least one reminder day (1 to 90).";
  if (reminderDays.length > 5) return "Use at most 5 reminder days.";
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 60) return "Grace period must be 0 to 60 days.";
  if (!Number.isInteger(finalWarningDays) || finalWarningDays < 0 || finalWarningDays > graceDays) {
    return "The final warning must fall inside the grace period.";
  }
  return { reminderDays, graceDays, finalWarningDays };
}

export type InvoiceLine = { description: string; quantity: number; unitPrice: number; amount: number };

export const peso = (n: number) =>
  `PHP ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Invoice status as shown to people: Paid, Due, Overdue or Void. */
export type EInvoiceStatus = "PAID" | "DUE" | "OVERDUE" | "VOID";
export function invoiceStatus(status: string, dueDate: Date | string, now: Date = new Date()): EInvoiceStatus {
  if (status === "PAID") return "PAID";
  if (status === "VOID") return "VOID";
  if (status === "OVERDUE" || daysUntil(dueDate, now) < 0) return "OVERDUE";
  return "DUE";
}
