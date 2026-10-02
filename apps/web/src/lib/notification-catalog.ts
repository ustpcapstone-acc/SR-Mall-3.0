/**
 * Notification catalogue — single source of truth for every alert the system
 * can emit.
 *
 * One entry per alert type defines:
 *  - how it is labelled / described in Profile Settings → Notifications
 *  - which group it is filed under in the settings UI
 *  - which roles receive it by default (used when no explicit recipient is given)
 *  - whether it is on by default and on which channels
 *  - the legacy `NotificationPreference` column it maps to (for backfill)
 *
 * Keep this file server/client safe (no prisma, no node APIs) — it is imported
 * by client components for the settings UI and by `lib/notify.ts` on the server.
 */

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";
export type NotificationRole = "ADMIN" | "TENANT" | "CUSTOMER";
export type NotificationGroup = "MONEY" | "ACTION" | "SECURITY" | "INFO";

export interface NotificationTypeMeta {
  /** Stored in `Notification.type` */
  type: string;
  label: string;
  description: string;
  group: NotificationGroup;
  /** Roles that receive this alert unless the caller passes explicit recipients */
  audience: NotificationRole[];
  defaultEnabled: boolean;
  defaultChannels: NotificationChannel[];
  /** Matching column on the legacy `NotificationPreference` table (backfill) */
  legacyKey?: string;
  /** Deep link used for the email CTA, per role */
  link?: Partial<Record<NotificationRole | "DEFAULT", string>>;
}

export const NOTIFICATION_GROUPS: Record<
  NotificationGroup,
  { label: string; hint: string }
> = {
  MONEY: {
    label: "Money & Legal",
    hint: "Payments, invoices and lease deadlines. Sent in-app and by email.",
  },
  ACTION: {
    label: "Action Required",
    hint: "Things waiting on a decision or a reply.",
  },
  SECURITY: {
    label: "Security & System",
    hint: "Abuse detection and site-wide operational state.",
  },
  INFO: {
    label: "Informational",
    hint: "Low priority summaries. In-app only.",
  },
};

export const NOTIFICATION_CATALOG: NotificationTypeMeta[] = [
  // ── 💰 Money & Legal ───────────────────────────────────────────────────────
  {
    type: "DEPOSIT_SLIP_SUBMITTED",
    label: "Deposit Slip Awaiting Review",
    description: "A tenant uploaded proof of payment that needs verification.",
    group: "MONEY",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { ADMIN: "/admindashboard/tenant-monitoring" },
  },
  {
    type: "INVOICE_STATUS_CHANGED",
    label: "Invoice Approved or Rejected",
    description: "The result of a submitted invoice or deposit slip review.",
    group: "MONEY",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { TENANT: "/tenantdashboard/lease-payments" },
  },
  {
    type: "PAYMENT_CONFIRMED",
    label: "Payment Confirmed",
    description: "Your payment was recorded and the balance updated.",
    group: "MONEY",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { TENANT: "/tenantdashboard/lease-payments" },
  },
  {
    type: "BILLING_REMINDER",
    label: "Upcoming Bill Reminder",
    description: "Reminders 10, 5, 3 and 1 day before a bill is due.",
    group: "MONEY",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { TENANT: "/tenantdashboard/lease-payments" },
  },
  {
    type: "INVOICE_ISSUED",
    label: "New Invoice Issued",
    description: "The mall office issued a new bill for your shop.",
    group: "MONEY",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { TENANT: "/tenantdashboard/lease-payments" },
  },
  {
    type: "OVERDUE_RENT_PAYMENTS",
    label: "Overdue Rent Payment",
    description: "An invoice passed its due date without payment.",
    group: "MONEY",
    audience: ["ADMIN", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    legacyKey: "overdueRentPayments",
    link: { ADMIN: "/admindashboard/tenant-monitoring", TENANT: "/tenantdashboard/lease-payments" },
  },
  {
    type: "EXPIRING_CONTRACTS",
    label: "Lease Expiring in 30 Days",
    description: "A tenant lease enters its renewal window (30 / 7 / 1 day marks).",
    group: "MONEY",
    audience: ["ADMIN", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    legacyKey: "expiringContracts",
    link: { ADMIN: "/admindashboard/tenant-monitoring", TENANT: "/tenantdashboard/lease-payments" },
  },

  // ── ⚡ Action Required ─────────────────────────────────────────────────────
  {
    type: "NEW_TENANT_APPLICATION",
    label: "New Tenant Application",
    description: "A merchant applied for a storefront or partnership slot.",
    group: "ACTION",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { ADMIN: "/admindashboard/bookings?tab=merchant" },
  },
  {
    type: "AD_SUBMISSION_RECEIVED",
    label: "Promo Submission Awaiting Review",
    description: "A billboard, banner or storefront creative is queued for approval.",
    group: "ACTION",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    legacyKey: "adSubmissionReceived",
    link: { ADMIN: "/admindashboard/ad-scheduler" },
  },
  {
    type: "AD_DECISION",
    label: "Promo Approved or Rejected",
    description: "The verdict on a submitted advertising campaign.",
    group: "ACTION",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { TENANT: "/tenantdashboard/ad-promo-manager" },
  },
  {
    type: "NEW_BOOKING_INQUIRY",
    label: "New Event or Space Inquiry",
    description: "A booking, event or space enquiry was submitted.",
    group: "ACTION",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    legacyKey: "newBookingInquiry",
    link: { ADMIN: "/admindashboard/bookings?tab=event" },
  },
  {
    type: "MESSAGE",
    label: "New Message",
    description: "A new message arrived in the Messenger Hub.",
    group: "ACTION",
    audience: ["ADMIN", "TENANT", "CUSTOMER"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { DEFAULT: "/public-view" },
  },
  {
    type: "SPACE_RESERVATION",
    label: "Space Reservation Received",
    description: "A unit or slot reservation was placed or auto-processed.",
    group: "ACTION",
    audience: ["ADMIN", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { ADMIN: "/admindashboard/bookings?tab=reservation" },
  },
  {
    type: "RESERVATION_EXPIRING",
    label: "Reservation Expiring in 24 Hours",
    description: "A pending reservation is about to be auto-released.",
    group: "ACTION",
    audience: ["ADMIN", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { ADMIN: "/admindashboard/bookings?tab=reservation" },
  },
  {
    type: "RESERVATION_UPDATE",
    label: "Your Reservation Status",
    description: "Your unit reservation was received, approved or declined.",
    group: "ACTION",
    audience: ["CUSTOMER", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { DEFAULT: "/available-spaces" },
  },
  {
    type: "EVENT_INQUIRY_UPDATE",
    label: "Your Event Inquiry Status",
    description: "Your event or space inquiry was approved, declined or expired.",
    group: "ACTION",
    audience: ["CUSTOMER", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { DEFAULT: "/public-view" },
  },
  {
    type: "MERCHANT_APPLICATION_UPDATE",
    label: "Merchant Application Result",
    description: "Your application to open a shop was approved or declined.",
    group: "ACTION",
    audience: ["CUSTOMER", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { TENANT: "/tenantdashboard", DEFAULT: "/public-view" },
  },
  {
    type: "LOST_AND_FOUND_REPORT",
    label: "New Lost & Found Report",
    description: "A shopper reported a lost or found item.",
    group: "ACTION",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { ADMIN: "/admindashboard/public-view-cms" },
  },

  {
    type: "COMPLAINT_ACTIVITY",
    label: "Tenant Complaints",
    description: "A tenant filed a complaint or replied to one.",
    group: "ACTION",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { ADMIN: "/admindashboard/complaints" },
  },
  {
    type: "COMPLAINT_UPDATE",
    label: "Your Complaints",
    description: "The admin replied to or updated a complaint you filed.",
    group: "ACTION",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { TENANT: "/tenantdashboard/complaints" },
  },
  {
    type: "NEW_REVIEW",
    label: "New Review",
    description: "A customer rated your shop.",
    group: "ACTION",
    audience: ["TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { TENANT: "/tenantdashboard/feedback-reviews" },
  },
  {
    type: "REVIEW_REPLY",
    label: "Shop Replied to Your Review",
    description: "A shop answered a review you posted.",
    group: "INFO",
    audience: ["CUSTOMER"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
  },
  {
    type: "LOST_AND_FOUND_UPDATE",
    label: "Your Lost & Found Item",
    description: "An item you reported was found, claimed or closed.",
    group: "INFO",
    audience: ["CUSTOMER", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { DEFAULT: "/lost-and-found" },
  },
  {
    type: "REVIEW_MODERATION",
    label: "Review Moderation Update",
    description: "The admin acted on a review you wrote, received or reported.",
    group: "INFO",
    audience: ["CUSTOMER", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
  },

  // ── 🛡️ Security & System ──────────────────────────────────────────────────
  {
    type: "REVIEW_REPORTED",
    label: "Review Reported by a Shop",
    description: "A tenant asked the admin to check a review.",
    group: "SECURITY",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { ADMIN: "/admindashboard/user-management" },
  },
  {
    type: "FEEDBACK_SPAM_DETECTED",
    label: "Review Flagged as Spam",
    description: "The anti-spam protocol auto-flagged a review for moderation.",
    group: "SECURITY",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    legacyKey: "feedbackSpamDetected",
    link: { ADMIN: "/admindashboard/user-management" },
  },
  {
    type: "MAINTENANCE_MODE",
    label: "Maintenance Mode On / Off",
    description: "The public storefront was taken offline or restored.",
    group: "SECURITY",
    audience: ["ADMIN", "TENANT"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP", "EMAIL"],
    link: { DEFAULT: "/public-view" },
  },

  // ── ℹ️ Informational ───────────────────────────────────────────────────────
  {
    type: "SYSTEM_HEALTH_REPORTS",
    label: "Weekly Operations Digest",
    description: "A weekly summary of tenants, payments, promos and activity.",
    group: "INFO",
    audience: ["ADMIN"],
    defaultEnabled: false,
    defaultChannels: ["IN_APP"],
    legacyKey: "systemHealthReports",
    link: { ADMIN: "/admindashboard" },
  },
  {
    type: "NEW_USER_SIGNUPS",
    label: "New Sign-ups Today",
    description: "One running count of new accounts created today.",
    group: "INFO",
    audience: ["ADMIN"],
    defaultEnabled: true,
    defaultChannels: ["IN_APP"],
    link: { ADMIN: "/admindashboard/user-management" },
  },
];

export const NOTIFICATION_TYPES = NOTIFICATION_CATALOG.map((m) => m.type);

const BY_TYPE = new Map(NOTIFICATION_CATALOG.map((m) => [m.type, m]));

export function getNotificationMeta(type: string): NotificationTypeMeta | null {
  return BY_TYPE.get(type) ?? null;
}

/** Catalogue entries relevant to a role, grouped for the settings UI. */
export function catalogForRole(role?: string | null) {
  const normalized = (role || "").toUpperCase() as NotificationRole;
  return NOTIFICATION_CATALOG.filter((m) =>
    m.audience.includes(normalized),
  );
}
