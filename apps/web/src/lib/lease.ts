/**
 * Lease term rule — the single place it lives.
 *
 * There is no explicit contract table in the schema, so a lease is treated as
 * a one-year term starting the day the tenant record was created. Used by the
 * lease-expiry cron and the admin dashboard so both agree on end dates.
 */
export const LEASE_TERM_YEARS = 1;

export function atMidnight(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function leaseEndDate(createdAt: Date) {
  const end = atMidnight(createdAt);
  end.setFullYear(end.getFullYear() + LEASE_TERM_YEARS);
  return end;
}

/** Whole days from today (midnight) until `date`; negative when past. */
export function daysFromToday(date: Date) {
  return Math.round(
    (atMidnight(date).getTime() - atMidnight(new Date()).getTime()) /
      (1000 * 60 * 60 * 24),
  );
}
