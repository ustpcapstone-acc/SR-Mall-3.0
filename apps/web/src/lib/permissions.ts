/**
 * Staff-portal permissions. A StaffRole stores a list of these keys; each key
 * opens one sidebar section (and the pages listed under it). The superuser
 * always has every key. Safe to import from client and server code.
 */

export type StaffPermission =
  | "dashboard"
  | "bookings"
  | "leasing"
  | "payments"
  | "spaces"
  | "messages"
  | "complaints"
  | "tenant_monitoring"
  | "ads"
  | "users"
  | "cms"
  | "staff";

type Section = {
  key: StaffPermission;
  label: string;
  description: string;
  /** Page paths this key opens. "/admindashboard" matches only itself. */
  paths: string[];
};

export const STAFF_SECTIONS: Section[] = [
  { key: "dashboard", label: "Dashboard", description: "Mall overview, sales and finance summary.", paths: ["/admindashboard"] },
  { key: "bookings", label: "Bookings", description: "Space reservations and event bookings.", paths: ["/admindashboard/bookings"] },
  { key: "leasing", label: "Leasing", description: "Rent requests, renewals and e-invoices.", paths: ["/admindashboard/rent-requests", "/admindashboard/renewals"] },
  // Opens parts of pages other sections own; their other buttons stay off limits.
  { key: "payments", label: "Payments", description: "Check deposit slips, record and void payments, post bills and renewal payments. Tenant details are view only.", paths: ["/admindashboard/payments", "/admindashboard/tenant-monitoring", "/admindashboard/renewals"] },
  { key: "spaces", label: "Floor Spaces & Map", description: "Units, floor map and availability.", paths: ["/admindashboard/space-manager"] },
  { key: "messages", label: "Messages", description: "Chats with tenants and customers.", paths: ["/admindashboard/messenger-hub", "/admindashboard/messages"] },
  { key: "complaints", label: "Complaints", description: "Tenant complaints and their replies.", paths: ["/admindashboard/complaints"] },
  { key: "tenant_monitoring", label: "Tenant Monitoring", description: "Tenants, leases and payments.", paths: ["/admindashboard/tenant-monitoring", "/admindashboard/merchant-requests"] },
  { key: "ads", label: "Ad Scheduler", description: "Mall ads and tenant promos.", paths: ["/admindashboard/ad-scheduler"] },
  { key: "users", label: "User Management", description: "Customer and tenant accounts, reviews.", paths: ["/admindashboard/user-management"] },
  { key: "cms", label: "Website Content", description: "Home page content and site settings.", paths: ["/admindashboard/public-view-cms", "/admindashboard/site-config", "/admindashboard/site-editor", "/admin"] },
  { key: "staff", label: "Roles & Staff", description: "Create roles and staff accounts.", paths: ["/admindashboard/roles-staff"] },
];

export const ALL_PERMISSIONS: StaffPermission[] = STAFF_SECTIONS.map((s) => s.key);

/** Pages every staff account may open, whatever its role. */
const ALWAYS_ALLOWED = ["/admindashboard/notifications", "/admindashboard/profile-settings"];

export function isStaffPermission(value: string): value is StaffPermission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

function under(path: string, base: string) {
  return path === base || path.startsWith(base + "/");
}

/**
 * What a staff-portal path needs: any one of these permission keys, "any" for
 * pages open to all staff, or "superuser" for paths no section claims.
 */
export function permissionsForPath(path: string): StaffPermission[] | "any" | "superuser" {
  if (ALWAYS_ALLOWED.some((p) => under(path, p))) return "any";
  if (path === "/admindashboard" || path === "/admindashboard/") return ["dashboard"];
  const keys = STAFF_SECTIONS.filter((s) => s.key !== "dashboard" && s.paths.some((p) => under(path, p))).map((s) => s.key);
  return keys.length ? keys : "superuser";
}

export type StaffAccess = { isSuperuser: boolean; permissions: StaffPermission[] };

export function canOpen(access: StaffAccess, path: string) {
  if (access.isSuperuser) return true;
  const need = permissionsForPath(path);
  if (need === "any") return true;
  if (need === "superuser") return false;
  return need.some((key) => access.permissions.includes(key));
}

/** Where a staff account lands after sign-in: the first section it can open. */
export function staffHomePath(access: StaffAccess) {
  if (access.isSuperuser) return "/admindashboard";
  const first = STAFF_SECTIONS.find((s) => access.permissions.includes(s.key));
  return first ? first.paths[0] : "/admindashboard/profile-settings";
}
