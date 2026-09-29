import { notificationTypeInfo, roleHome } from "./notification-types";

export interface NotificationLike {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  /** Stored by notify() when the notification was created. */
  link?: string | null;
}

/**
 * Where a notification leads when clicked.
 *
 *  1. The link stored with the notification (set by notify(); always right).
 *  2. Chat messages → the right messenger (customers: the sender's thread).
 *  3. The type's destination for the viewer's role.
 *  4. The role's dashboard / home page.
 *
 * (The old version guessed from words in the title — e.g. any title with "ad"
 * in it, like "uploaded", went to the Ad Scheduler.)
 */
export function getNotificationRoute(notification: NotificationLike, userRole?: string | null): string {
  const role = (userRole || "").toUpperCase();
  const type = (notification.type || "").toUpperCase();

  if (notification.link && notification.link.startsWith("/")) {
    // Customers' message links open the chat on the public page. New links
    // already name the thread; older ones (/public-view) are read from the text.
    if (type === "MESSAGE" && role !== "ADMIN" && role !== "TENANT" && !notification.link.includes("chat=open")) {
      return customerChatRoute(notification.message);
    }
    return notification.link;
  }

  if (type === "MESSAGE") {
    if (role === "ADMIN") return "/admindashboard/messenger-hub";
    if (role === "TENANT") return "/tenantdashboard/customer-messenger";
    return customerChatRoute(notification.message);
  }

  const info = notificationTypeInfo(type);
  return (info.route as Record<string, string | undefined>)[role] || info.route.DEFAULT || roleHome(role);
}

/** Message text looks like `New message from <Sender>: "<excerpt>"`. */
function customerChatRoute(message?: string) {
  const sender = (message || "").match(/from\s+(.+?)(?::|$)/i)?.[1]?.trim() || "";
  if (!sender || /admin/i.test(sender)) return "/public-view?chat=open&recipient=admin";
  return `/public-view?chat=open&recipient=shop&shop=${encodeURIComponent(sender)}`;
}
