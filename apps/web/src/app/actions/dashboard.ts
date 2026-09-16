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
