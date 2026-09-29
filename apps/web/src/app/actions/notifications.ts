"use server";

import { prisma } from "@srmall/database";
import { getBaseUrl } from "@/utils/get-base-url";
import {
  NOTIFICATION_CATALOG,
  getNotificationMeta,
  type NotificationChannel,
} from "@/lib/notification-catalog";
import { notify } from "@/lib/notify";

export type NotificationSetting = {
  enabled: boolean;
  channels: NotificationChannel[];
};

export type NotificationSettings = Record<string, NotificationSetting>;

export async function sendMassEmailAnnouncement(
  subject: string,
  message: string,
) {
  try {
    const appUrl = await getBaseUrl();

    // Call the internal API route
    const response = await fetch(`${appUrl}/api/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "GENERAL_ANNOUNCEMENT",
        data: {
          subject,
          message,
        },
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to dispatch emails API");
    }

    return { success: true, message: "Mass email sent successfully." };
  } catch (error: any) {
    console.error("Error sending mass email announcement:", error);
    return {
      success: false,
      error: error.message || "Failed to send mass emails",
    };
  }
}

/**
 * Build the default settings for a user from the catalogue, seeded from the
 * legacy `NotificationPreference` booleans where a mapping exists.
 */
async function seedSettings(userId: string): Promise<NotificationSettings> {
  let legacy: Record<string, any> | null = null;
  try {
    legacy = (await prisma.notificationPreference.findUnique({
      where: { userId },
    })) as Record<string, any> | null;
  } catch (err) {
    console.error("Legacy preference lookup failed:", err);
  }

  const settings: NotificationSettings = {};
  for (const meta of NOTIFICATION_CATALOG) {
    const fromLegacy =
      legacy && meta.legacyKey
        ? Boolean((legacy as Record<string, any>)[meta.legacyKey])
        : null;

    settings[meta.type] = {
      enabled: fromLegacy === null ? meta.defaultEnabled : fromLegacy,
      channels: [...meta.defaultChannels],
    };
  }

  // Best effort — if the row-per-type table has not been migrated in yet the
  // defaults are still returned so the settings screen stays usable.
  try {
    await prisma.notificationPref.createMany({
      data: Object.entries(settings).map(([type, value]) => ({
        userId,
        type,
        enabled: value.enabled,
        channels: value.channels,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error(
      "NotificationPref seed failed — run `npm run db:push`:",
      err,
    );
  }

  return settings;
}

/**
 * Read every alert's enabled/channels state for this user.
 * Seeds the row-per-type table from the legacy booleans on first read.
 */
export async function getNotificationSettings(
  userId: string,
): Promise<{ success: boolean; data?: NotificationSettings; error?: string }> {
  try {
    let existing: Array<{ type: string; enabled: boolean; channels: unknown }> =
      [];
    try {
      existing = await prisma.notificationPref.findMany({
        where: { userId },
      });
    } catch (err) {
      console.error(
        "NotificationPref read failed — run `npm run db:push`:",
        err,
      );
      return { success: true, data: await seedSettings(userId) };
    }

    if (existing.length === 0) {
      return { success: true, data: await seedSettings(userId) };
    }

    const data: NotificationSettings = {};
    for (const meta of NOTIFICATION_CATALOG) {
      const row = existing.find((r) => r.type === meta.type);
      data[meta.type] = row
        ? {
            enabled: row.enabled,
            channels: (row.channels as NotificationChannel[]) || [
              "IN_APP",
            ],
          }
        : {
            enabled: meta.defaultEnabled,
            channels: [...meta.defaultChannels],
          };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching notification settings:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch notification settings",
    };
  }
}

/** Persist enabled + channels per alert type (only touches known types). */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = NOTIFICATION_CATALOG.filter((m) => settings[m.type]).map(
      (m) => ({
        userId,
        type: m.type,
        enabled: Boolean(settings[m.type].enabled),
        channels:
          settings[m.type].channels && settings[m.type].channels.length > 0
            ? settings[m.type].channels
            : ["IN_APP"],
      }),
    );

    for (const row of rows) {
      await prisma.notificationPref.upsert({
        where: { userId_type: { userId, type: row.type } },
        update: { enabled: row.enabled, channels: row.channels },
        create: row,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error saving notification settings:", error);
    const missingTable =
      typeof error?.message === "string" &&
      error.message.includes("NotificationPref");
    return {
      success: false,
      error: missingTable
        ? "The NotificationPref table is missing — run `npm run db:push` (or apply the migration), then try again."
        : error.message || "Failed to save notification settings",
    };
  }
}

/**
 * Fire a sample alert so an admin/tenant can verify the bell + email wiring
 * from the settings screen.
 */
export async function sendTestNotification(
  userId: string,
  type: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const meta = getNotificationMeta(type);
    if (!meta) {
      return { success: false, error: "Unknown notification type." };
    }

    const appUrl = await getBaseUrl();
    const link = meta.link?.DEFAULT || meta.link?.ADMIN || appUrl;

    const result = await notify(type, {
      recipients: [userId],
      title: `Test alert: ${meta.label}`,
      message: `${meta.description} If you can read this, your channels are wired correctly.`,
      link,
      email: true,
    });

    const channels: string[] = [];
    if (result.created > 0) channels.push("in-app");
    if (result.emailed > 0) channels.push("email");

    if (channels.length === 0) {
      return {
        success: true,
        message:
          "Nothing was sent — this alert is turned off or has no channels selected.",
      };
    }

    return {
      success: true,
      message: `Test alert sent via ${channels.join(" + ")}.`,
    };
  } catch (error: any) {
    console.error("Error sending test notification:", error);
    return {
      success: false,
      error: error.message || "Failed to send test notification",
    };
  }
}
