/**
 * The HTML email every notification sends (see lib/notify.ts).
 *
 * Email clients only understand simple HTML, so this is table-based with
 * inline styles, a hidden preview line, a real button (plus a plain link
 * under it in case the button is blocked), and a settings link in the footer.
 * All text is escaped — chat excerpts and names come from users.
 */

const BRAND = "#BE1E2D";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Button text from where the link goes. */
export function defaultCtaLabel(link?: string) {
  if (!link) return "Open SR Mall";
  if (/messenger|chat=open/.test(link)) return "Reply to message";
  if (/bookings\?tab=reservation|available-spaces/.test(link)) return "View reservation";
  if (/bookings/.test(link)) return "Review request";
  if (/lease-payments|tenant-monitoring/.test(link)) return "View payments";
  if (/ad-scheduler|ad-promo-manager/.test(link)) return "View campaign";
  if (/feedback-reviews|user-management/.test(link)) return "View reviews";
  if (/lost-and-found|public-view-cms/.test(link)) return "View item";
  if (/tenantdashboard/.test(link)) return "Open my dashboard";
  if (/admindashboard/.test(link)) return "Open admin dashboard";
  return "Open SR Mall";
}

export interface NotificationEmail {
  /** Small label above the title, e.g. "New message" */
  eyebrow?: string;
  title: string;
  message: string;
  /** A quoted block, e.g. the chat message itself. */
  quote?: { author: string; text: string } | null;
  /** Absolute URL for the button. */
  link?: string;
  ctaLabel?: string;
  /** Absolute URL to the recipient's notification settings. */
  settingsUrl?: string;
  /** Absolute URL of the site (logo / footer link). */
  siteUrl?: string;
}

export function buildNotificationEmail(e: NotificationEmail) {
  const title = escapeHtml(e.title);
  const message = escapeHtml(e.message).replace(/\n/g, "<br/>");
  const preview = escapeHtml(e.quote ? `${e.quote.author}: ${e.quote.text}` : e.message).slice(0, 140);
  const cta = e.ctaLabel || defaultCtaLabel(e.link);

  const quote = e.quote
    ? `<tr><td style="padding:0 32px 8px;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:4px solid ${BRAND};border-radius:8px;">
           <tr><td style="padding:14px 18px;">
             <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${escapeHtml(e.quote.author)}</div>
             <div style="font-size:15px;line-height:1.55;color:#0f172a;">&ldquo;${escapeHtml(e.quote.text)}&rdquo;</div>
           </td></tr>
         </table>
       </td></tr>`
    : "";

  const button = e.link
    ? `<tr><td align="center" style="padding:24px 32px 8px;">
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           <td align="center" bgcolor="${BRAND}" style="border-radius:10px;">
             <a href="${escapeHtml(e.link)}" target="_blank" rel="noopener"
                style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND};">
               ${escapeHtml(cta)} &rarr;
             </a>
           </td>
         </tr></table>
       </td></tr>
       <tr><td align="center" style="padding:10px 32px 0;font-size:12px;color:#94a3b8;line-height:1.5;">
         Button not working? Copy this link:<br/>
         <a href="${escapeHtml(e.link)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(e.link)}</a>
       </td></tr>`
    : "";

  const settings = e.settingsUrl
    ? `<a href="${escapeHtml(e.settingsUrl)}" style="color:#64748b;text-decoration:underline;">Manage notification settings</a>`
    : "";
  const site = e.siteUrl
    ? `<a href="${escapeHtml(e.siteUrl)}" style="color:#64748b;text-decoration:none;font-weight:700;">SR Mall</a>`
    : "SR Mall";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;color:#334155;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
        <tr><td style="background:${BRAND};padding:20px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.02em;">SR MALL</td>
            <td align="right" style="font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.12em;">Notification</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 32px 12px;">
          ${e.eyebrow ? `<div style="font-size:11px;font-weight:800;color:${BRAND};text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;">${escapeHtml(e.eyebrow)}</div>` : ""}
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${message}</p>
        </td></tr>
        ${quote}
        ${button}
        <tr><td style="padding:28px 32px 0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
        <tr><td style="padding:18px 32px 28px;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
          This is an automated message from ${site} — replies to this email aren&rsquo;t read.<br/>
          ${settings}
        </td></tr>
      </table>
      <div style="font-size:11px;color:#94a3b8;padding-top:14px;">SR Mall Management Office</div>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Plain-text version (shown by clients that don't render HTML, and helps deliverability). */
export function buildNotificationText(e: NotificationEmail) {
  return [
    e.eyebrow ? e.eyebrow.toUpperCase() : null,
    e.title,
    "",
    e.message,
    e.quote ? `\n${e.quote.author}: "${e.quote.text}"` : null,
    e.link ? `\n${e.ctaLabel || defaultCtaLabel(e.link)}: ${e.link}` : null,
    "",
    "— SR Mall (automated message, replies aren't read)",
    e.settingsUrl ? `Manage notification settings: ${e.settingsUrl}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
