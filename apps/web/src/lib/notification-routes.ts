export interface NotificationLike {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
}

/**
 * Determines the target route for a notification based on its type, content, and the current user's role.
 */
export function getNotificationRoute(
  notification: NotificationLike,
  userRole?: string | null,
): string {
  const type = (notification.type || "").toUpperCase();
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();
  const role = (userRole || "").toUpperCase();

  // 1. Space Reservations & Unit Slots (e.g. Unit A-02 reserved)
  if (
    type === "SPACE_RESERVATION" ||
    title.includes("reservation") ||
    title.includes("space reservation") ||
    (title.includes("space") && message.includes("unit")) ||
    message.includes("reservation request") ||
    message.includes("placed a reservation")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/space-manager";
    }
    if (role === "TENANT") {
      return "/tenantdashboard";
    }
    return "/profile";
  }

  // 2. Event Bookings & Space Inquiries
  if (
    type === "NEW_BOOKING_INQUIRY" ||
    type === "EVENT_BOOKING" ||
    title.includes("project inquiry") ||
    title.includes("event") ||
    title.includes("booking") ||
    message.includes("planned for")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/bookings";
    }
    return "/profile";
  }

  // 3. Merchant Applications & Storefront Onboarding
  if (
    title.includes("merchant") ||
    title.includes("partnership") ||
    message.includes("merchant") ||
    message.includes("storefront partnership")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/bookings";
    }
    return "/tenantdashboard";
  }

  // 4. Messages & Conversations
  if (
    type === "MESSAGE" ||
    title.includes("message") ||
    message.includes("message from")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/messenger-hub";
    }
    if (role === "TENANT") {
      return "/tenantdashboard/customer-messenger";
    }
    return "/profile";
  }

  // 5. Ad & Promotion Submissions
  if (
    type === "AD_SUBMISSION_RECEIVED" ||
    title.includes("promo") ||
    title.includes("campaign") ||
    title.includes("ad") ||
    message.includes("campaign for review")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/ad-scheduler";
    }
    if (role === "TENANT") {
      return "/tenantdashboard/ad-promo-manager";
    }
    return "/admindashboard/ad-scheduler";
  }

  // 6. Billing, Rent, & Invoices
  if (
    type === "BILLING_REMINDER" ||
    type === "OVERDUE_RENT_PAYMENTS" ||
    title.includes("billing") ||
    title.includes("overdue") ||
    title.includes("rent") ||
    title.includes("invoice") ||
    message.includes("lease payment") ||
    message.includes("invoice")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/tenant-monitoring";
    }
    if (role === "TENANT") {
      return "/tenantdashboard/lease-payments";
    }
    return "/profile";
  }

  // 7. Feedback, Reviews, & Moderation
  if (
    type === "FEEDBACK_SPAM_DETECTED" ||
    title.includes("feedback") ||
    title.includes("review") ||
    title.includes("spam")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/user-management";
    }
    if (role === "TENANT") {
      return "/tenantdashboard/feedback-reviews";
    }
    return "/profile";
  }

  // 8. Contracts & Leases
  if (
    type === "EXPIRING_CONTRACTS" ||
    title.includes("contract") ||
    title.includes("lease")
  ) {
    if (role === "ADMIN") {
      return "/admindashboard/tenant-monitoring";
    }
    if (role === "TENANT") {
      return "/tenantdashboard/lease-payments";
    }
    return "/profile";
  }

  // Fallback defaults
  if (role === "ADMIN") {
    return "/admindashboard";
  }
  if (role === "TENANT") {
    return "/tenantdashboard";
  }
  return "/public-view";
}
