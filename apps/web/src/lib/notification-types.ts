/**
 * Display + routing info for every notification type the database can hold
 * (current catalogue types and a few legacy ones). Client-safe.
 *
 * `group` drives the filter tabs on the notifications page and matches the
 * groups in notification settings (MONEY / ACTION / SECURITY / INFO), plus
 * MESSAGE for chat alerts (the bell shows chats from the live unread store).
 */
export type NotificationTabGroup = "MONEY" | "ACTION" | "SECURITY" | "INFO" | "MESSAGE";
export type NotificationIconKey = "money" | "check" | "calendar" | "alert" | "message" | "store" | "star" | "megaphone" | "settings" | "search" | "bell";
type Role = "ADMIN" | "TENANT" | "CUSTOMER";

interface TypeInfo {
  label: string;
  group: NotificationTabGroup;
  icon: NotificationIconKey;
  tone: string;
  /** Destination per role (used when the notification has no stored link). */
  route: Partial<Record<Role | "DEFAULT", string>>;
}

const T: Record<string, TypeInfo> = {
  // Money & legal
  DEPOSIT_SLIP_SUBMITTED: { label: "Deposit slip", group: "MONEY", icon: "money", tone: "text-amber-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  INVOICE_STATUS_CHANGED: { label: "Invoice", group: "MONEY", icon: "money", tone: "text-blue-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  PAYMENT_CONFIRMED: { label: "Payment", group: "MONEY", icon: "check", tone: "text-emerald-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  OVERDUE_RENT_PAYMENTS: { label: "Overdue rent", group: "MONEY", icon: "alert", tone: "text-red-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  BILLING_REMINDER: { label: "Bill reminder", group: "MONEY", icon: "money", tone: "text-amber-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  INVOICE_ISSUED: { label: "New invoice", group: "MONEY", icon: "money", tone: "text-blue-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },
  EXPIRING_CONTRACTS: { label: "Lease", group: "MONEY", icon: "calendar", tone: "text-orange-500", route: { ADMIN: "/admindashboard/tenant-monitoring", DEFAULT: "/tenantdashboard/lease-payments" } },

  // Action required
  NEW_TENANT_APPLICATION: { label: "Merchant application", group: "ACTION", icon: "store", tone: "text-blue-500", route: { ADMIN: "/admindashboard/merchant-requests", TENANT: "/tenantdashboard", DEFAULT: "/profile" } },
  AD_SUBMISSION_RECEIVED: { label: "Promo submitted", group: "ACTION", icon: "megaphone", tone: "text-purple-500", route: { ADMIN: "/admindashboard/ad-scheduler", DEFAULT: "/tenantdashboard/ad-promo-manager" } },
  AD_DECISION: { label: "Promo decision", group: "ACTION", icon: "megaphone", tone: "text-purple-500", route: { ADMIN: "/admindashboard/ad-scheduler", DEFAULT: "/tenantdashboard/ad-promo-manager" } },
  NEW_BOOKING_INQUIRY: { label: "Event inquiry", group: "ACTION", icon: "calendar", tone: "text-blue-500", route: { ADMIN: "/admindashboard/bookings?tab=event", DEFAULT: "/public-view#event-inquiry" } },
  EVENT_BOOKING: { label: "Event booking", group: "ACTION", icon: "calendar", tone: "text-blue-500", route: { ADMIN: "/admindashboard/bookings?tab=event", DEFAULT: "/public-view#event-inquiry" } },
  SPACE_RESERVATION: { label: "Space reservation", group: "ACTION", icon: "calendar", tone: "text-emerald-500", route: { ADMIN: "/admindashboard/bookings?tab=reservation", TENANT: "/tenantdashboard", DEFAULT: "/available-spaces" } },
  RESERVATION_EXPIRING: { label: "Reservation expiring", group: "ACTION", icon: "alert", tone: "text-orange-500", route: { ADMIN: "/admindashboard/bookings?tab=reservation", DEFAULT: "/available-spaces" } },
  RESERVATION_UPDATE: { label: "Reservation", group: "ACTION", icon: "calendar", tone: "text-emerald-500", route: { DEFAULT: "/available-spaces" } },
  EVENT_INQUIRY_UPDATE: { label: "Event inquiry", group: "ACTION", icon: "calendar", tone: "text-blue-500", route: { DEFAULT: "/public-view" } },
  MERCHANT_APPLICATION_UPDATE: { label: "Application", group: "ACTION", icon: "store", tone: "text-blue-500", route: { TENANT: "/tenantdashboard", DEFAULT: "/public-view" } },
  LOST_AND_FOUND_REPORT: { label: "Lost & found", group: "ACTION", icon: "search", tone: "text-sky-500", route: { DEFAULT: "/admindashboard/public-view-cms" } },
  COMPLAINT_ACTIVITY: { label: "Complaint", group: "ACTION", icon: "alert", tone: "text-orange-500", route: { ADMIN: "/admindashboard/complaints", DEFAULT: "/tenantdashboard/complaints" } },
  COMPLAINT_UPDATE: { label: "Complaint", group: "ACTION", icon: "alert", tone: "text-orange-500", route: { ADMIN: "/admindashboard/complaints", DEFAULT: "/tenantdashboard/complaints" } },
  NEW_REVIEW: { label: "New review", group: "ACTION", icon: "star", tone: "text-amber-500", route: { ADMIN: "/admindashboard/user-management", TENANT: "/tenantdashboard/feedback-reviews", DEFAULT: "/tenant-directory" } },
  NEW_REVIEW_SUBMITTED: { label: "New review", group: "ACTION", icon: "star", tone: "text-amber-500", route: { ADMIN: "/admindashboard/user-management", TENANT: "/tenantdashboard/feedback-reviews", DEFAULT: "/tenant-directory" } },

  // Security & system
  FEEDBACK_SPAM_DETECTED: { label: "Spam review", group: "SECURITY", icon: "alert", tone: "text-yellow-500", route: { DEFAULT: "/admindashboard/user-management" } },
  REVIEW_REPORTED: { label: "Review reported", group: "SECURITY", icon: "alert", tone: "text-yellow-500", route: { DEFAULT: "/admindashboard/user-management" } },
  MAINTENANCE_MODE: { label: "Maintenance", group: "SECURITY", icon: "settings", tone: "text-orange-600", route: { ADMIN: "/admindashboard/site-config", TENANT: "/tenantdashboard", DEFAULT: "/public-view" } },

  // Informational
  SYSTEM_HEALTH_REPORTS: { label: "Weekly digest", group: "INFO", icon: "settings", tone: "text-slate-500", route: { DEFAULT: "/admindashboard" } },
  REVIEW_REPLY: { label: "Shop reply", group: "INFO", icon: "star", tone: "text-amber-500", route: { DEFAULT: "/tenant-directory" } },
  LOST_AND_FOUND: { label: "Lost & found", group: "INFO", icon: "search", tone: "text-sky-500", route: { DEFAULT: "/lost-and-found" } },
  LOST_AND_FOUND_UPDATE: { label: "Lost & found", group: "INFO", icon: "search", tone: "text-sky-500", route: { DEFAULT: "/lost-and-found" } },
  REVIEW_MODERATION: { label: "Review update", group: "INFO", icon: "star", tone: "text-slate-500", route: { TENANT: "/tenantdashboard/feedback-reviews", DEFAULT: "/tenant-directory" } },
  NEW_USER_SIGNUPS: { label: "New users", group: "INFO", icon: "bell", tone: "text-emerald-500", route: { DEFAULT: "/admindashboard/user-management" } },

  // Chat
  MESSAGE: { label: "Message", group: "MESSAGE", icon: "message", tone: "text-blue-500", route: { ADMIN: "/admindashboard/messenger-hub", TENANT: "/tenantdashboard/customer-messenger", DEFAULT: "/public-view?chat=open" } },
};

const FALLBACK: TypeInfo = { label: "Update", group: "INFO", icon: "bell", tone: "text-slate-400", route: {} };

export function notificationTypeInfo(type?: string | null): TypeInfo {
  return T[(type || "").toUpperCase()] ?? FALLBACK;
}

/** Every known type in a tab group (used to filter on the server). */
export function typesInGroup(group: NotificationTabGroup): string[] {
  return Object.entries(T)
    .filter(([, info]) => info.group === group)
    .map(([type]) => type);
}

export function roleHome(role?: string | null) {
  const r = (role || "").toUpperCase();
  return r === "ADMIN" ? "/admindashboard" : r === "TENANT" ? "/tenantdashboard" : "/public-view";
}

/** Where the notification settings live for each role. */
export function notificationSettingsHref(role?: string | null) {
  const r = (role || "").toUpperCase();
  if (r === "ADMIN") return "/admindashboard/profile-settings?tab=notifications";
  if (r === "TENANT") return "/tenantdashboard/profile-settings?tab=notifications";
  return "/profile?tab=notifications";
}

export function notificationsPageHref(role?: string | null) {
  const r = (role || "").toUpperCase();
  if (r === "ADMIN") return "/admindashboard/notifications";
  if (r === "TENANT") return "/tenantdashboard/notifications";
  return "/profile/notifications";
}
