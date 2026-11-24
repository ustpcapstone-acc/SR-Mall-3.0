/**
 * Tenant staff permissions: the sections of one space workspace a staff
 * account can open. The tenant owner always has all of them, plus the Home
 * workspace, Rent a Space, Staff and their profile. Client/server safe.
 */

export type SpacePermission = "overview" | "storefront" | "ads" | "messages" | "payments" | "reviews" | "complaints";

type Section = { key: SpacePermission; label: string; description: string; paths: string[] };

export const SPACE_SECTIONS: Section[] = [
  { key: "overview", label: "Overview", description: "Store summary and sales figures.", paths: ["/tenantdashboard"] },
  { key: "storefront", label: "Storefront", description: "Store details, photos and products.", paths: ["/tenantdashboard/digital-storefront"] },
  { key: "ads", label: "Ads & Promo", description: "Promos shown on the mall site.", paths: ["/tenantdashboard/ad-promo-manager"] },
  { key: "messages", label: "Messages", description: "Chats with shoppers.", paths: ["/tenantdashboard/customer-messenger"] },
  { key: "payments", label: "Payments", description: "Rent, invoices and receipts for this space.", paths: ["/tenantdashboard/payments", "/tenantdashboard/lease-payments"] },
  { key: "reviews", label: "Reviews", description: "Shopper reviews and replies.", paths: ["/tenantdashboard/feedback-reviews"] },
  { key: "complaints", label: "Complaints", description: "Complaints filed with the mall office.", paths: ["/tenantdashboard/complaints"] },
];

export const ALL_SPACE_PERMISSIONS: SpacePermission[] = SPACE_SECTIONS.map((s) => s.key);

/** Built-in roles every space starts with. */
export const DEFAULT_SPACE_ROLES: { name: string; permissions: SpacePermission[] }[] = [
  { name: "Manager", permissions: [...ALL_SPACE_PERMISSIONS] },
  { name: "Cashier", permissions: ["overview", "payments", "messages"] },
  { name: "Marketing", permissions: ["storefront", "ads", "reviews"] },
];

/** Pages any staff account may open. */
const STAFF_ALWAYS = ["/tenantdashboard/notifications"];

export function isSpacePermission(v: string): v is SpacePermission {
  return (ALL_SPACE_PERMISSIONS as string[]).includes(v);
}

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

/** Can a staff account with these permissions open this tenant-dashboard path? */
export function staffCanOpen(permissions: string[], path: string) {
  if (STAFF_ALWAYS.some((p) => under(path, p))) return true;
  const clean = path.replace(/\/$/, "") || "/";
  if (clean === "/tenantdashboard") return permissions.includes("overview");
  const section = SPACE_SECTIONS.find((s) => s.key !== "overview" && s.paths.some((p) => under(clean, p)));
  return !!section && permissions.includes(section.key);
}

/** Where a staff account lands: the first section its role opens. */
export function staffHome(permissions: string[]) {
  const first = SPACE_SECTIONS.find((s) => permissions.includes(s.key));
  if (!first) return "/tenantdashboard/notifications";
  return first.key === "messages" ? "/tenantdashboard/customer-messenger?inbox=customers" : first.paths[0];
}
