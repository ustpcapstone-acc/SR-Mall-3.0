/**
 * Product prices are free text ("99.0", "1111", "---"). Real numbers are shown
 * as pesos, other text as typed, and empty or dash-only values as null.
 */
export function formatPrice(raw?: string | null): string | null {
  const value = (raw || "").trim();
  if (!value || /^[-–—.\s]+$/.test(value)) return null;
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || !/\d/.test(value)) return value;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}
