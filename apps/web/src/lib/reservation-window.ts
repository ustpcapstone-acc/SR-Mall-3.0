/**
 * Space reservation review window, one place for the hold length, so the
 * public pages, admin countdown, dashboard and auto-release all agree.
 * Client/server safe.
 */

/** How long a reserved unit is held while the admin checks the business permit. */
export const RESERVATION_HOLD_MS = 48 * 60 * 60 * 1000;
export const RESERVATION_HOLD_LABEL = "2 days";

/** Countdown colours / reminders (time remaining). */
export const RESERVATION_URGENT_MS = 6 * 60 * 60 * 1000;
export const RESERVATION_WARNING_MS = 12 * 60 * 60 * 1000;

/** Business permit upload rules. */
export const PERMIT_MAX_BYTES = 10 * 1024 * 1024;
export const PERMIT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
export const PERMIT_FOLDER = "business-permits";
