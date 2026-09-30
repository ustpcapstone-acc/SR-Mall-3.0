/** Local / private-network hosts are served over plain http by `next dev`. */
function isLocalHost(host: string) {
  const name = host.split(":")[0];
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name.endsWith(".local") ||
    /^10\./.test(name) ||
    /^192\.168\./.test(name) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(name)
  );
}

export async function getBaseUrl() {
  // 1. If we're on the client, use window.location.origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 2. If we're on the server
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    // No proxy header in local dev → http (https://192.168.x.x:3000 doesn't load).
    const protocol = headerList.get("x-forwarded-proto") || (host && isLocalHost(host) ? "http" : "https");

    if (host) {
      return `${protocol}://${host}`;
    }
  } catch (e) {
    // Fallback if headers() is called outside of request context
  }

  // 3. Fallback to Vercel Environment Variable (for build time / static generation)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 4. Fallback to manually set App URL or localhost
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Base URL for links inside emails (server-only). Emails are opened later, on
 * any device, so they always point at the live site: EMAIL_BASE_URL
 * (e.g. https://sr-mall-3-0-web.vercel.app), then NEXT_PUBLIC_APP_URL.
 */
const LIVE_SITE_URL = "https://sr-mall-3-0-web.vercel.app";

export function emailBaseUrl() {
  const clean = (v?: string) => (v || "").trim().replace(/\/+$/, "");
  const explicit = clean(process.env.EMAIL_BASE_URL);
  if (explicit) return explicit;
  // A local / LAN address (e.g. http://192.168.0.103:3000) can't be opened from
  // an email on another device — use the live site instead.
  const app = clean(process.env.NEXT_PUBLIC_APP_URL);
  if (app) {
    try {
      if (!isLocalHost(new URL(app).host)) return app;
    } catch {
      /* not a URL — ignore */
    }
  }
  return LIVE_SITE_URL;
}

export async function getEmailBaseUrl() {
  return emailBaseUrl();
}
