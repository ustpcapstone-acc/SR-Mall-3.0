import { NextResponse } from "next/server";
import { runWeeklyDigest } from "@/lib/weekly-digest";

/**
 * Weekly operations digest endpoint.
 *
 * The daily lease-expiry cron already fires this on Mondays to stay within
 * Vercel's cron limits — this route exists so you can trigger it manually
 * (or schedule it separately on a plan that allows a third cron).
 */
export async function GET() {
  try {
    const result = await runWeeklyDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Weekly digest cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
