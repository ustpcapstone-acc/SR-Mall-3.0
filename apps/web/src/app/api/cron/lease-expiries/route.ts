import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { notify } from "@/lib/notify";
import { atMidnight, leaseEndDate } from "@/lib/lease";
import { runWeeklyDigest } from "@/lib/weekly-digest";
import { processExpiredMerchantApplicationsAction } from "@/app/actions/tenant";
import { processExpiredEventBookingsAction } from "@/app/actions/inquiry";

/**
 * Daily lease-expiry sweep.
 *
 * The lease term rule (one year from the tenant record's creation) lives in
 * `lib/lease.ts`, shared with the admin dashboard.
 *
 * Fires at the 30 / 7 / 1 day milestones (and once a day after expiry) for
 * both the admin and the tenant, respecting each side's EXPIRING_CONTRACTS
 * preference. Re-runs on the same day are suppressed by `dedupeHours`.
 */
const MILESTONES = [30, 7, 1];

export async function GET() {
  try {
    const today = atMidnight(new Date());

    const tenants = await prisma.tenant.findMany({
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    let flagged = 0;

    for (const tenant of tenants) {
      if (!tenant.user) continue;

      const end = leaseEndDate(new Date(tenant.createdAt));
      const days = Math.round(
        (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (days > MILESTONES[0]) continue;

      const milestone = MILESTONES.find((m) => days <= m) ?? 1;
      const expired = days <= 0;
      const unitLabel = `Unit ${tenant.unitId}`;

      const adminTitle = expired
        ? "Lease Expired — Renewal Required"
        : `Lease Expiring in ${milestone} Day${milestone === 1 ? "" : "s"}`;
      const adminMessage = expired
        ? `${tenant.shopName} (${unitLabel}) passed its lease end date on ${end.toLocaleDateString()}. Renewal or removal is required.`
        : `${tenant.shopName} (${unitLabel}) lease ends ${end.toLocaleDateString()} — ${days} day${
            days === 1 ? "" : "s"
          } left before renewal is due.`;

      const tenantTitle = expired
        ? "Your Lease Has Expired"
        : `Your Lease Expires in ${milestone} Day${milestone === 1 ? "" : "s"}`;
      const tenantMessage = expired
        ? `The lease for ${tenant.shopName} (${unitLabel}) ended on ${end.toLocaleDateString()}. Contact the management office to renew.`
        : `Your lease for ${tenant.shopName} (${unitLabel}) ends on ${end.toLocaleDateString()} — ${days} day${
            days === 1 ? "" : "s"
          } remaining. Reach out to the management office to renew.`;

      await notify("EXPIRING_CONTRACTS", {
        roles: ["ADMIN"],
        title: adminTitle,
        message: adminMessage,
        link: "/admindashboard/tenant-monitoring",
        dedupeHours: 20,
      });

      await notify("EXPIRING_CONTRACTS", {
        recipients: [tenant.user.id],
        title: tenantTitle,
        message: tenantMessage,
        link: "/tenantdashboard/lease-payments",
        dedupeHours: 20,
      });

      flagged++;
    }

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
      tenantsFlagged: flagged,
      autoRejected: {
        merchantApplications: merchantApplications.rejected,
        eventBookings: eventBookings.rejected,
      },
      digest,
    });
  } catch (error) {
    console.error("Lease expiry cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
