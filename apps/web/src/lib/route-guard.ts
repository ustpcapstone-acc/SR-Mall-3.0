import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/auth-server";

/**
 * For diagnostic API routes (/api/test-*, /api/debug-*): they read private data
 * or write test records, so only the superuser may call them. Returns the
 * refusal to send, or null to carry on.
 */
export async function denyUnlessSuperuser(): Promise<NextResponse | null> {
  const account = await currentAccount();
  if (account?.isSuperuser) return null;
  return NextResponse.json({ error: "You don't have access to this." }, { status: account ? 403 : 401 });
}
