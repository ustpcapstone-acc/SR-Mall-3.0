/**
 * Google sign-in leaves the site and comes back to /auth/callback, so the
 * portal it started from is kept in sessionStorage for the callback to read.
 * (Not a security check: the server still verifies the account type.)
 */
import type { AccountType } from "@/lib/session";

const KEY = "srmall_google_portal";

export function rememberGooglePortal(portal: AccountType) {
  try {
    sessionStorage.setItem(KEY, portal);
  } catch {}
}

export function takeGooglePortal(): AccountType {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (value === "ADMIN" || value === "TENANT") return value;
  } catch {}
  return "CUSTOMER";
}
