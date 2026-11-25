/**
 * Store products (Tenant.products) — stock and catalog visibility rules.
 * Client/server safe.
 */
import type { ProductStatus } from "@/types/storefront";

export interface ProductLike {
  id?: string;
  name?: string;
  stock?: number | string | null;
  status?: ProductStatus | string | null;
}

export const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "HIDDEN", label: "Hidden from catalog" },
];

/** Hidden products never appear on public pages. */
export const isListed = (p: ProductLike) => (p.status || "AVAILABLE") !== "HIDDEN";

/** Units on hand, or null when the shop doesn't track stock. */
export function stockCount(p: ProductLike): number | null {
  if (p.stock === null || p.stock === undefined || p.stock === "") return null;
  const n = Math.floor(Number(p.stock));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Marked out of stock, or a tracked stock of 0. */
export const isOutOfStock = (p: ProductLike) => p.status === "OUT_OF_STOCK" || stockCount(p) === 0;

/** Short availability text, e.g. "12 available", "Out of stock", "In stock". */
export function availabilityLabel(p: ProductLike): string {
  if (isOutOfStock(p)) return "Out of stock";
  const n = stockCount(p);
  return n === null ? "In stock" : `${n} available`;
}

/** Link to a product's page. */
export const productHref = (shopId: string, productId: string) =>
  `/products/${encodeURIComponent(shopId)}/${encodeURIComponent(productId)}`;

/**
 * Has the shop been given a real unit yet? New shops carry a placeholder
 * ("PENDING", "PENDING_ASSIGNMENT") until the admin assigns one, and that
 * placeholder was showing on public cards as "Unit PENDING".
 */
export function hasAssignedUnit(unitId?: string | null): unitId is string {
  return !!unitId && !/^pending/i.test(unitId.trim());
}
