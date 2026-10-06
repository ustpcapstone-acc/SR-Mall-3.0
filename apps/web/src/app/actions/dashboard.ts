"use server";

import { prisma } from "@srmall/database";

export async function getRecentActivity(limit = 10) {
  try {
    const activities: any[] = [];
    const queryTake = Math.max(10, Math.ceil(limit / 2));

    // 1. Recent Event Inquiries
    const inquiries = await prisma.eventInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: queryTake,
    });

    inquiries.forEach((inquiry: any) => {
      activities.push({
        id: `inquiry-${inquiry.id}`,
        type: "booking",
        title: "Booking Inquiry",
        description: `${inquiry.eventType || "Event"} - ${inquiry.eventName || inquiry.name || "Special Exhibit"}`,
        time: inquiry.createdAt,
        urgent: inquiry.status === "PENDING",
        status: inquiry.status,
        targetUrl: "/admindashboard/bookings",
      });
    });

    // 2. Recent Invoices (Payments)
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: queryTake,
      include: { tenant: { select: { shopName: true } } },
    });

    invoices.forEach((inv: any) => {
      activities.push({
        id: `invoice-${inv.id}`,
        type: "payment",
        title: inv.status === "PAID" ? "Payment Received" : "Invoice Issued",
        description: `${inv.tenant?.shopName || "Tenant"} - ₱${(inv.amount || 0).toLocaleString()} (${inv.status})`,
        time: inv.createdAt,
        urgent: inv.status === "OVERDUE",
        status: inv.status,
        targetUrl: "/admindashboard/tenant-monitoring",
      });
    });

    // 3. Recent Promos (Ads)
    const promos = await prisma.tenantPromo.findMany({
      orderBy: { createdAt: "desc" },
      take: queryTake,
      include: { tenant: { select: { shopName: true } } },
    });

    promos.forEach((promo: any) => {
      activities.push({
        id: `promo-${promo.id}`,
        type: "promo",
        title: promo.status === "PENDING" ? "Ad Approval Request" : "Active Campaign",
        description: `${promo.tenant?.shopName || "Tenant"} - "${promo.title}"`,
        time: promo.createdAt,
        urgent: promo.status === "PENDING",
        status: promo.status,
        targetUrl: "/admindashboard/ad-scheduler",
      });
    });

    // 4. Recent Reviews
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: queryTake,
      include: {
        user: { select: { name: true } },
        tenant: { select: { shopName: true } },
      },
    });

    reviews.forEach((review: any) => {
      activities.push({
        id: `review-${review.id}`,
        type: "review",
        title: "Customer Review",
        description: `${review.user?.name || "Customer"} rated ${review.rating}★ ${review.tenant ? "for " + review.tenant.shopName : "for Mall Experience"}`,
        time: review.createdAt,
        urgent: review.rating <= 2,
        status: review.isApproved ? "Approved" : "Pending",
        targetUrl: "/admindashboard/user-management",
      });
    });

    // Sort all activities by time descending
    activities.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );

    // Format time relatively (e.g. "2h ago")
    const formatTime = (date: Date) => {
      const seconds = Math.floor(
        (new Date().getTime() - new Date(date).getTime()) / 1000,
      );
      let interval = seconds / 31536000;
      if (interval > 1) return Math.floor(interval) + "y ago";
      interval = seconds / 2592000;
      if (interval > 1) return Math.floor(interval) + "mo ago";
      interval = seconds / 86400;
      if (interval > 1) return Math.floor(interval) + "d ago";
      interval = seconds / 3600;
      if (interval > 1) return Math.floor(interval) + "h ago";
      interval = seconds / 60;
      if (interval > 1) return Math.floor(interval) + "m ago";
      return Math.max(1, Math.floor(seconds)) + "s ago";
    };

    const formattedActivities = activities.slice(0, limit).map((act) => ({
      ...act,
      rawTime: act.time,
      fullDate: new Date(act.time).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      time: formatTime(act.time),
    }));

    return { success: true, data: formattedActivities };
  } catch (error: any) {
    console.error("Failed to fetch recent activity:", error);
    return { success: false, error: error.message };
  }
}

// ─── Admin dashboard ─────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RESERVATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESERVATION_URGENT_MS = 6 * 60 * 60 * 1000;
const LEASE_LOOKAHEAD_DAYS = 60;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function percentChange(current: number, previous: number) {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? 100 : 0;
}

/**
 * Everything the admin home page shows, in one request. The browser runs
 * server actions one at a time, so the old page's five sequential calls were
 * five round trips; here every query runs in parallel on the server.
 *
 * Money timing: an invoice counts as *billed* in the month it was created and
 * as *collected* in the month it was paid (`paidAt`, set by a DB trigger when
 * the status becomes PAID; older rows fall back to `updatedAt`).
 */
export async function getAdminDashboardAction(adminUserId?: string) {
  try {
    const { leaseEndDate, daysFromToday } = await import("@/lib/lease");
    const now = new Date();
    const reservationCutoff = new Date(now.getTime() - RESERVATION_WINDOW_MS);

    const [
      invoices,
      tenants,
      slots,
      reservations,
      pendingApplications,
      pendingInquiries,
      pendingPromos,
      flaggedReviews,
      totalUsers,
      customerUsers,
      newUsersThisMonth,
      unreadMessages,
      activity,
      paidAtRows,
    ] = await Promise.all([
      prisma.invoice.findMany({
        select: {
          id: true,
          invoiceNumber: true,
          month: true,
          amount: true,
          status: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          tenantId: true,
          tenant: { select: { shopName: true, unitId: true, logoUrl: true } },
        },
      }),
      prisma.tenant.findMany({
        select: {
          id: true,
          shopName: true,
          unitId: true,
          status: true,
          logoUrl: true,
          createdAt: true,
        },
      }),
      prisma.areaSlot.findMany({
        select: {
          id: true,
          unit_id: true,
          status: true,
          base_rent: true,
          floor: true,
        },
        orderBy: { unit_id: "asc" },
      }),
      prisma.areaSlot.findMany({
        where: { status: "RESERVED", updatedAt: { gt: reservationCutoff } },
        select: { updatedAt: true },
      }),
      prisma.tenant.count({ where: { status: "PENDING" } }),
      prisma.eventInquiry.count({ where: { status: "PENDING" } }),
      prisma.tenantPromo.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { isSpam: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      }),
      adminUserId
        ? prisma.user
            .findMany({ where: { role: "ADMIN" }, select: { id: true } })
            .then((admins) =>
              prisma.notification.count({
                where: {
                  userId: { in: admins.map((a) => a.id) },
                  isRead: false,
                  type: "MESSAGE",
                },
              }),
            )
        : Promise.resolve(0),
      getRecentActivity(6),
      // Newer column (raw SQL until the Prisma client is regenerated)
      prisma
        .$queryRawUnsafe<{ id: string; paidAt: Date }[]>(
          `SELECT "id", "paidAt" FROM "Invoice" WHERE "paidAt" IS NOT NULL`,
        )
        .catch(() => [] as { id: string; paidAt: Date }[]),
    ]);
    const paidAtById = new Map(paidAtRows.map((r) => [r.id, new Date(r.paidAt)]));

    // ── Money ────────────────────────────────────────────────────────────────
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    let collectedThisMonth = 0;
    let collectedLastMonth = 0;
    // Same point last month (e.g. Oct 3 → Sep 1–3), so early-month trends
    // compare like with like instead of a few days against a whole month.
    let collectedLastMonthToDate = 0;
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const lastMonthCutoff = new Date(
      lastMonthStart.getFullYear(),
      lastMonthStart.getMonth(),
      Math.min(now.getDate(), daysInLastMonth),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );
    let billedThisMonth = 0;
    let outstanding = 0;
    let overdueAmount = 0;
    let awaitingVerification = 0;
    let unpaidInvoices = 0;
    const overdueTenantIds = new Set<string>();
    const overdueInvoices: Array<{
      id: string;
      invoiceNumber: string;
      month: string;
      amount: number;
      status: string;
      dueDate: string;
      daysLate: number;
      shopName: string;
      unitId: string;
      logoUrl: string | null;
    }> = [];

    // 12 monthly buckets, oldest → newest
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { key: monthKey(d), label: MONTHS[d.getMonth()], billed: 0, collected: 0 };
    });
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

    for (const inv of invoices) {
      const amount = Number(inv.amount || 0);
      const createdKey = monthKey(new Date(inv.createdAt));
      const billedBucket = bucketByKey.get(createdKey);
      if (billedBucket) billedBucket.billed += amount;
      if (createdKey === thisMonth) billedThisMonth += amount;

      if (inv.status === "PAID") {
        const paidAt = paidAtById.get(inv.id) ?? new Date(inv.updatedAt);
        const paidKey = monthKey(paidAt);
        const paidBucket = bucketByKey.get(paidKey);
        if (paidBucket) paidBucket.collected += amount;
        if (paidKey === thisMonth) collectedThisMonth += amount;
        if (paidKey === lastMonth) {
          collectedLastMonth += amount;
          if (paidAt <= lastMonthCutoff) collectedLastMonthToDate += amount;
        }
        continue;
      }

      outstanding += amount;
      unpaidInvoices++;
      if (inv.status === "REVIEWING") awaitingVerification++;

      const isOverdue =
        inv.status === "OVERDUE" ||
        (inv.status === "PENDING" && new Date(inv.dueDate) < now);
      if (isOverdue) {
        overdueAmount += amount;
        overdueTenantIds.add(inv.tenantId);
        overdueInvoices.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          month: inv.month,
          amount,
          status: inv.status,
          dueDate: new Date(inv.dueDate).toISOString(),
          daysLate: Math.max(0, -daysFromToday(new Date(inv.dueDate))),
          shopName: inv.tenant?.shopName || "Unknown tenant",
          unitId: inv.tenant?.unitId || "",
          logoUrl: inv.tenant?.logoUrl || null,
        });
      }
    }
    overdueInvoices.sort((a, b) => b.daysLate - a.daysLate || b.amount - a.amount);

    // ── Spaces & tenants ─────────────────────────────────────────────────────
    const countSlots = (status: string) => slots.filter((s) => s.status === status).length;
    const occupancy = {
      total: slots.length,
      occupied: countSlots("OCCUPIED"),
      reserved: countSlots("RESERVED"),
      available: countSlots("AVAILABLE"),
      maintenance: countSlots("MAINTENANCE"),
    };

    const activeTenants = tenants.filter((t) => t.status === "ACTIVE");
    const newTenantsThisMonth = activeTenants.filter(
      (t) => monthKey(new Date(t.createdAt)) === thisMonth,
    ).length;

    const leasesEnding = activeTenants
      .map((t) => {
        const end = leaseEndDate(new Date(t.createdAt));
        return {
          id: t.id,
          shopName: t.shopName,
          unitId: t.unitId,
          logoUrl: t.logoUrl,
          endDate: end.toISOString(),
          daysLeft: daysFromToday(end),
        };
      })
      .filter((l) => l.daysLeft <= LEASE_LOOKAHEAD_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const tenantByUnit = new Map(tenants.map((t) => [t.unitId, t.shopName]));
    const floor = slots.slice(0, 12).map((s) => ({
      id: s.id,
      unitId: s.unit_id,
      status: s.status,
      baseRent: s.base_rent,
      floor: s.floor,
      shopName: s.status === "OCCUPIED" ? tenantByUnit.get(s.unit_id) || null : null,
    }));

    const nowMs = now.getTime();
    const urgentReservations = reservations.filter(
      (r) =>
        RESERVATION_WINDOW_MS - (nowMs - new Date(r.updatedAt).getTime()) <=
        RESERVATION_URGENT_MS,
    ).length;

    return {
      success: true as const,
      data: {
        generatedAt: now.toISOString(),
        kpis: {
          collectedThisMonth,
          collectedLastMonth,
          collectedLastMonthToDate,
          collectedChange: percentChange(collectedThisMonth, collectedLastMonthToDate),
          billedThisMonth,
          outstanding,
          overdueAmount,
          overdueTenants: overdueTenantIds.size,
          activeTenants: activeTenants.length,
          newTenantsThisMonth,
          unpaidInvoices,
          overdueInvoices: overdueInvoices.length,
          totalUsers,
          customerUsers,
          newUsersThisMonth,
        },
        occupancy,
        attention: {
          merchantApplications: pendingApplications,
          reservations: reservations.length,
          urgentReservations,
          depositSlips: awaitingVerification,
          eventInquiries: pendingInquiries,
          promos: pendingPromos,
          flaggedReviews,
          unreadMessages,
        },
        revenue: buckets.map(({ label, billed, collected }) => ({ label, billed, collected })),
        overdueInvoices: overdueInvoices.slice(0, 6),
        overdueInvoiceCount: overdueInvoices.length,
        leasesEnding: leasesEnding.slice(0, 5),
        leasesEndingCount: leasesEnding.length,
        floor,
        activity: activity.success ? activity.data ?? [] : [],
      },
    };
  } catch (error: any) {
    console.error("Failed to load admin dashboard:", error);
    return { success: false as const, error: String(error?.message || error) };
  }
}

export type AdminDashboardData = Extract<
  Awaited<ReturnType<typeof getAdminDashboardAction>>,
  { success: true }
>["data"];
