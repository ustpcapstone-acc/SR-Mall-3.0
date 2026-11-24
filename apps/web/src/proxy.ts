import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type AccountType } from "@/lib/session";
import { canOpen, staffHomePath } from "@/lib/permissions";
import { loadAccount, staffAccess } from "@/lib/auth-server";

/**
 * Keeps each dashboard behind its own portal:
 *   /admindashboard, /admin  -> staff accounts, and only the sections their role allows
 *   /tenantdashboard         -> tenant accounts
 * Server actions also check access themselves; this is the first gate.
 */
const AREAS: { prefix: string; type: AccountType; login: string }[] = [
  { prefix: "/admindashboard", type: "ADMIN", login: "/staff-portal" },
  { prefix: "/admin", type: "ADMIN", login: "/staff-portal" },
  { prefix: "/tenantdashboard", type: "TENANT", login: "/tenant-portal" },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/"));
  if (!area) return NextResponse.next();

  const toLogin = () => {
    const url = new URL(area.login, request.url);
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  };

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.typ !== area.type) return toLogin();

  const account = await loadAccount(session.uid);
  if (!account || account.isBlacklisted || account.type !== area.type) return toLogin();

  if (area.type === "ADMIN") {
    const access = staffAccess(account);
    if (!canOpen(access, pathname)) {
      const home = staffHomePath(access);
      // Avoid a loop if even the home page is off limits.
      if (home === pathname) return toLogin();
      return NextResponse.redirect(new URL(home, request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admindashboard/:path*", "/admin/:path*", "/tenantdashboard/:path*"],
};
