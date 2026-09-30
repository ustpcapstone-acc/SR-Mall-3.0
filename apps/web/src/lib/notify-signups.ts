/**
 * "New sign-ups today" for admins — one running notification per day instead
 * of an alert for every account. Each new sign-up replaces today's unread
 * notice with an updated count (a new row, so it pops up live in the bell).
 *
 * Server-only. Runs after the response via `after()` so sign-up isn't slowed.
 */
import { prisma } from "@srmall/database";
import { notify } from "./notify";

const TITLE_PREFIX = "New sign-ups today";

export async function notifyNewSignup(newUserName: string) {
  try {
    // "Today" in Philippine time (UTC+8), stored timestamps are UTC.
    const now = new Date();
    const ph = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const startOfDay = new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()) - 8 * 60 * 60 * 1000);

    const count = await prisma.user.count({ where: { createdAt: { gte: startOfDay }, role: { not: "ADMIN" } } });
    if (count === 0) return;

    await prisma.notification.deleteMany({
      where: { type: "NEW_USER_SIGNUPS", isRead: false, createdAt: { gte: startOfDay } },
    });
    await notify("NEW_USER_SIGNUPS", {
      roles: ["ADMIN"],
      title: `${TITLE_PREFIX}: ${count}`,
      message:
        count === 1
          ? `${newUserName} created an account today.`
          : `${count} accounts were created today — latest: ${newUserName}.`,
      link: "/admindashboard/user-management",
      email: false,
    });
  } catch (error) {
    console.error("[notify-signups] failed:", error);
  }
}
