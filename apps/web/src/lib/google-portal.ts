/**
 * Google sign-in leaves the site and comes back to /auth/callback, so the
 * portal it started from is kept in sessionStorage for the callback to read.
 * (Not a security check: the server still verifies the account type.)
 */
import type { AccountType } from "@/lib/session";

const KEY = "srmall_google_portal";
const RETURN_KEY = "srmall_google_return";

/** `returnTo` is the page on this site to open after signing in, if not the account's home. */
export function rememberGooglePortal(portal: AccountType, returnTo?: string | null) {
  try {
    sessionStorage.setItem(KEY, portal);
    if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {}
}

export function takeGoogleReturn(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    // Only paths on this site.
    if (value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  } catch {}
  return null;
}

export function takeGooglePortal(): AccountType {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (value === "ADMIN" || value === "TENANT") return value;
  } catch {}
  return "CUSTOMER";
}
