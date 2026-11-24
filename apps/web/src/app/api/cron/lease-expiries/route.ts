import { NextResponse } from "next/server";
import { runRenewalSweep } from "@/lib/leasing-server";
import { runWeeklyDigest } from "@/lib/weekly-digest";
import { processExpiredMerchantApplicationsAction } from "@/app/actions/tenant";
import { processExpiredEventBookingsAction } from "@/app/actions/inquiry";

/**
 * Daily leasing sweep (Vercel cron, see vercel.json).
 *
 * Renewals: reminders before each lease's due date, the due-day notice,
 * grace-period notices and, once grace runs out, removal from the space. The
 * schedule (reminder days, grace days, final warning) is set by staff on the
 * Renewals page; the rules live in lib/leasing.ts and lib/leasing-server.ts.
 *
 * Because this removes tenants, it only runs for Vercel's cron (or anyone
 * holding CRON_SECRET) when that variable is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const today = new Date();
    const renewals = await runRenewalSweep(today);

    // 72-hour auto-rejection sweep — merchant applications and event bookings
    // that sat in PENDING for 3+ days flip to REJECTED through the same
    // actions the admin buttons use (identical notification behaviour).
    // Run daily here so the rule holds even if nobody opens a dashboard;
    // the admin list fetches and /api/cron/process-reservations run it too.
    const [merchantApplications, eventBookings] = await Promise.all([
      processExpiredMerchantApplicationsAction(),
      processExpiredEventBookingsAction(),
    ]);

    // Monday → also publish the weekly operations digest (opt-in, default off).
    // Keeps the project on two cron entries, which fits Vercel's hobby tier.
    let digest = null;
    if (today.getDay() === 1) {
      digest = await runWeeklyDigest();
    }

    return NextResponse.json({
      success: true,
      renewals,
      autoRejected: {
        merchantApplications: merchantApplications.rejected,
        eventBookings: eventBookings.rejected,
      },
      digest,
    });
  } catch (error) {
    console.error("Leasing cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
