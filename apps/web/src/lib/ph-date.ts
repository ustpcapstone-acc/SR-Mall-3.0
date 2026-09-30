/**
 * Campaign dates in Philippine time (UTC+8), client/server safe.
 *
 * A date input gives "YYYY-MM-DD". `new Date("2026-09-30")` is midnight UTC —
 * 8:00 AM in Manila — so a campaign "ending Sep 30" used to stop at 8 AM.
 * These helpers make a campaign run from 00:00 on its start day to 23:59 on
 * its end day, Manila time.
 */
export const phDayStart = (ymd: string) => new Date(`${ymd}T00:00:00.000+08:00`);
export const phDayEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999+08:00`);

/** A stored date → "YYYY-MM-DD" (Manila calendar day) for a date input. */
export function toPHDateInput(value: string | Date) {
  const d = new Date(value);
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "Sep 30, 2026" in Manila time. */
export function formatPHDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
