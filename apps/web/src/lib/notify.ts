/**
 * Central notification dispatcher.
 *
 * Every producer (server actions, crons) should call `notify()` instead of
 * writing `prisma.notification` rows directly. That guarantees:
 *
 *   1. recipients are resolved from the catalogue (or an explicit list)
 *   2. each recipient's `NotificationPref` row is honoured (enabled + channels)
 *   3. legacy `NotificationPreference` booleans are respected as a fallback
 *   4. in-app rows and emails go out on the channels the user chose
 *
 * `notify()` never throws — notification delivery must not break the business
 * action that triggered it.
 */
import { prisma } from "@srmall/database";
import { getBaseUrl } from "@/utils/get-base-url";
import {
  getNotificationMeta,
  type NotificationChannel,
  type NotificationRole,
} from "./notification-catalog";

export interface NotifyInput {
  /** Explicit user ids. When omitted, recipients come from the catalogue audience. */
  recipients?: string[];
  /** Override the catalogue audience (e.g. "notify every tenant"). */
  roles?: NotificationRole[];
  title: string;
  message: string;
  /** Absolute or app-relative link used as the email CTA. */
  link?: string;
  /** Email subject override (defaults to `title`). */
  subject?: string;
  /** Set false when the caller sends its own bespoke email. Default: true. */
  email?: boolean;
  /**
   * Suppress repeats: skip any recipient that already received a notification
   * of this type with the same title within the last N hours. Used by crons
   * that re-run daily (lease expiry, digests).
   */
  dedupeHours?: number;
}

export interface NotifyResult {
  created: number;
  emailed: number;
  recipients: number;
}

export interface PrefDecision {
  enabled: boolean;
  channels: NotificationChannel[];
}

const FALLBACK_META = {
  audience: [] as NotificationRole[],
  defaultEnabled: true,
  defaultChannels: ["IN_APP"] as NotificationChannel[],
  legacyKey: undefined as string | undefined,
};

/**
 * Resolve the effective preference (enabled + channels) for a set of users for
 * one alert type. Falls back to the legacy boolean column, then to the
 * catalogue default, so existing admins/tenants keep their current behaviour.
 */
export async function resolveChannels(
  type: string,
  userIds: string[],
): Promise<Record<string, PrefDecision>> {
  const out: Record<string, PrefDecision> = {};
  if (userIds.length === 0) return out;

  const meta = getNotificationMeta(type);
  const needsLegacy = Boolean(meta?.legacyKey);

  // The row-per-type table is new; if it has not been migrated in yet, fall
  // back to the legacy booleans so alerts keep flowing instead of failing.
  let prefs: Array<{ userId: string; enabled: boolean; channels: unknown }> = [];
  try {
    prefs = await prisma.notificationPref.findMany({
      where: { userId: { in: userIds }, type },
    });
  } catch (err) {
    console.error(
      "[notify] NotificationPref lookup failed — run `npm run db:push`:",
      err,
    );
  }

  const legacy = await (async () => {
    if (!needsLegacy) return [] as Array<Record<string, any>>;
    try {
      return (await prisma.notificationPreference.findMany({
        where: { userId: { in: userIds } },
      })) as Array<Record<string, any>>;
    } catch {
      return [] as Array<Record<string, any>>;
    }
  })();

  const prefByUser = new Map(prefs.map((p) => [p.userId, p]));
  const legacyByUser = new Map((legacy as Array<Record<string, any>>).map((l) => [l.userId, l]));

  for (const userId of userIds) {
    const pref = prefByUser.get(userId);
    if (pref) {
      out[userId] = {
        enabled: pref.enabled,
        channels: (pref.channels as NotificationChannel[]) || ["IN_APP"],
      };
      continue;
    }

    const legacyRow = meta?.legacyKey ? legacyByUser.get(userId) : undefined;
    out[userId] = {
      enabled: legacyRow && meta?.legacyKey
        ? Boolean(legacyRow[meta.legacyKey])
        : (meta ?? FALLBACK_META).defaultEnabled,
      channels: (meta ?? FALLBACK_META).defaultChannels,
    };
  }

  return out;
}

async function resolveRecipients(
  type: string,
  input: NotifyInput,
): Promise<string[]> {
  if (input.recipients?.length) return [...new Set(input.recipients)];

  const meta = getNotificationMeta(type);
  // The catalogue audience says who *may* get this type (and whose settings
  // list it). With no explicit recipients, an admin-facing alert goes to
  // admins only — broadcasting it to every tenant must be asked for via `roles`.
  const audience = meta?.audience ?? [];
  const roles = input.roles ?? (audience.includes("ADMIN") ? ["ADMIN" as NotificationRole] : audience);
  if (roles.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { role: { in: roles as string[] } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

function buildEmailHtml(opts: {
  title: string;
  message: string;
  link?: string;
}) {
  const cta = opts.link
    ? `<div style="text-align:center;margin:28px 0;">
         <a href="${opts.link}" style="display:inline-block;background:#BE1E2D;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Dashboard</a>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;background:#f4f4f5;font-family:Inter,'Segoe UI',Tahoma,sans-serif;color:#3f3f46;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);">
    <div style="background:#BE1E2D;padding:24px;text-align:center;color:#fff;font-size:24px;font-weight:600;">SR Mall</div>
    <div style="padding:32px;">
      <h2 style="margin-top:0;color:#18181b;font-size:20px;">${opts.title}</h2>
      <p style="line-height:1.6;font-size:15px;">${opts.message}</p>
      ${cta}
    </div>
    <div style="background:#f4f4f5;padding:20px;text-align:center;font-size:13px;color:#71717a;border-top:1px solid #e4e4e7;">
      This is an automated message. <strong>Please do not reply to this email.</strong><br/>SR Mall Management Office
    </div>
  </div>
</body></html>`;
}

/**
 * Dispatch a notification. Returns counts for logging/tests; never throws.
 */
export async function notify(
  type: string,
  input: NotifyInput,
): Promise<NotifyResult> {
  const empty: NotifyResult = { created: 0, emailed: 0, recipients: 0 };
  try {
    let userIds = await resolveRecipients(type, input);
    if (userIds.length === 0) return empty;

    if (input.dedupeHours && input.dedupeHours > 0) {
      const since = new Date(
        Date.now() - input.dedupeHours * 60 * 60 * 1000,
      );
      const recent = await prisma.notification.findMany({
        where: {
          userId: { in: userIds },
          type,
          title: input.title,
          createdAt: { gte: since },
        },
        select: { userId: true },
      });
      const already = new Set(recent.map((n) => n.userId));
      userIds = userIds.filter((id) => !already.has(id));
      if (userIds.length === 0) return empty;
    }

    const prefs = await resolveChannels(type, userIds);

    const inAppUsers = userIds.filter(
      (id) => prefs[id]?.enabled && prefs[id]?.channels.includes("IN_APP"),
    );

    let created = 0;
    if (inAppUsers.length > 0) {
      // Store the page this notification opens (app-relative only), so the
      // bell never has to guess the destination from words in the title.
      const inAppLink = input.link && input.link.startsWith("/") ? input.link : null;
      created = await prisma.$executeRawUnsafe(
        `INSERT INTO "Notification" ("id", "userId", "type", "title", "message", "isRead", "createdAt", "link")
         SELECT gen_random_uuid()::text, u, $2, $3, $4, false, $5::timestamp, $6
           FROM unnest($1::text[]) AS u`,
        inAppUsers,
        type,
        input.title,
        input.message,
        new Date(),
        inAppLink,
      );
    }

    let emailed = 0;
    if (input.email !== false) {
      const emailUsers = userIds.filter(
        (id) => prefs[id]?.enabled && prefs[id]?.channels.includes("EMAIL"),
      );

      if (emailUsers.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: emailUsers } },
          select: { email: true },
        });

        const baseUrl = await getBaseUrl();
        const link = input.link
          ? input.link.startsWith("http")
            ? input.link
            : `${baseUrl}${input.link}`
          : undefined;

        const html = buildEmailHtml({
          title: input.title,
          message: input.message,
          link,
        });

        const { sendGmail } = await import("./gmail");
        for (const user of users) {
          if (!user.email) continue;
          try {
            await sendGmail({
              to: user.email,
              subject: input.subject || input.title,
              html,
            });
            emailed++;
          } catch (err) {
            console.error("[notify] email failed:", err);
          }
        }
      }
    }

    return { created, emailed, recipients: userIds.length };
  } catch (error) {
    console.error("[notify] dispatch failed:", type, error);
    return empty;
  }
}
