/**
 * Signed session token kept in an HttpOnly cookie. The browser cannot read or
 * forge it, so the server (proxy, server actions) can trust who is signed in.
 * Uses Web Crypto only, so it runs in proxy and server code alike.
 *
 * Token: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
 */

export const SESSION_COOKIE = "srmall_sid";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours, same as the client session

export type AccountType = "ADMIN" | "TENANT" | "CUSTOMER";
export type SessionPayload = { uid: string; typ: AccountType; exp: number };

const encoder = new TextEncoder();

function secret() {
  // SESSION_SECRET should be set in every environment. DATABASE_URL is a
  // server-only fallback so a missing variable never signs with an empty key.
  const value = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return value;
}

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey() {
  keyPromise ??= crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  return keyPromise;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signSession(uid: string, typ: AccountType) {
  const payload: SessionPayload = { uid, typ, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(sig), encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!payload?.uid || !payload.typ || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Account type stored in User.role, narrowed. Old "USER" rows count as customers. */
export function accountTypeOf(role: string | null | undefined): AccountType {
  if (role === "ADMIN") return "ADMIN";
  // Tenant staff sign in at the tenant portal too (lib/tenant-permissions.ts).
  if (role === "TENANT" || role === "TENANT_STAFF") return "TENANT";
  return "CUSTOMER";
}

export const PORTAL_LOGIN: Record<AccountType, string> = {
  ADMIN: "/staff-portal",
  TENANT: "/tenant-portal",
  CUSTOMER: "/login",
};
