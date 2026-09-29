/**
 * One time format for every chat surface (public chat box, tenant messenger,
 * admin messenger hub):
 *   message bubble   → "11:35 AM"            (the day comes from the separator)
 *   conversation row → "11:35 AM" · "Yesterday" · "Sep 28" · "Sep 28, 2025"
 *   day separator    → "Today" · "Yesterday" · "Monday, Sep 28" · "Sep 28, 2025"
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysAgo(d: Date) {
  return Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
}

export function formatMessageTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

export function formatConversationTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  const ago = daysAgo(d);
  if (ago <= 0) return formatMessageTime(d);
  if (ago === 1) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatDayLabel(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  const ago = daysAgo(d);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    ...(ago < 7 ? { weekday: "long" } : {}),
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** True when `current` starts a new calendar day compared with `previous`. */
export function startsNewDay(
  previous: string | Date | null | undefined,
  current: string | Date | null | undefined,
) {
  const a = toDate(previous);
  const b = toDate(current);
  if (!b) return false;
  if (!a) return true;
  return startOfDay(a) !== startOfDay(b);
}
