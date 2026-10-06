/**
 * Shop sale posts (Tenant.postSales) — when they expire. Client/server safe.
 *
 * A post runs until the end of its `ends_at` day in Philippine time
 * (11:59 PM, UTC+8). Older posts saved before `ends_at` existed run until the
 * end of the day DEFAULT_SALE_DAYS days after their posting `date`.
 */

export const DEFAULT_SALE_DAYS = 7;

export interface PostSaleLike {
  date?: string | null;
  ends_at?: string | null;
}

/** Today's date in the Philippines as YYYY-MM-DD (for date inputs). */
export function phToday(offsetDays = 0): string {
  const d = new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** The moment a post stops showing on the public page. */
export function saleEndsAt(sale: PostSaleLike): Date {
  if (sale.ends_at && /^\d{4}-\d{2}-\d{2}$/.test(sale.ends_at)) {
    return new Date(`${sale.ends_at}T23:59:59.999+08:00`);
  }
  // Older posts: end of the day DEFAULT_SALE_DAYS after posting (PH time).
  const posted = sale.date ? new Date(sale.date) : new Date();
  const base = Number.isNaN(posted.getTime()) ? new Date() : posted;
  const day = new Date(base.getTime() + 8 * 3600_000 + DEFAULT_SALE_DAYS * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${day}T23:59:59.999+08:00`);
}

/** The end day as YYYY-MM-DD (Philippine time), for a date input. */
export function saleEndDateInput(sale: PostSaleLike): string {
  if (sale.ends_at && /^\d{4}-\d{2}-\d{2}$/.test(sale.ends_at)) return sale.ends_at;
  return new Date(saleEndsAt(sale).getTime() + 8 * 3600_000 - 1000).toISOString().slice(0, 10);
}

export function isSaleActive(sale: PostSaleLike, now: Date = new Date()): boolean {
  return saleEndsAt(sale).getTime() >= now.getTime();
}

/** e.g. "Oct 14, 2026" in Philippine time. */
export function formatSaleDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}
