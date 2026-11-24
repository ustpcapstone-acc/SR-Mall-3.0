"use server";

/**
 * Customer dashboard (/account): bookings, saved shops, promotions from mall
 * tenants, recent chats and the customer's own activity. Read from the
 * signed-in session only.
 */
import { prisma } from "@srmall/database";
import { currentAccount } from "@/lib/auth-server";
import { getMyChatListAction, type MyChatRow } from "@/app/actions/chat-queries";

export type CustomerDashboard = {
  name: string;
  /** upcoming: the event day hasn't passed yet. */
  bookings: { id: string; title: string; eventType: string; date: string; time: string; status: string; upcoming: boolean }[];
  savedShops: { id: string; name: string; unitId: string; logo: string | null; category: string; isOpen: boolean; promoCount: number }[];
  promos: {
    id: string;
    title: string;
    description: string | null;
    image: string | null;
    endDate: string;
    shopId: string;
    shopName: string;
    fromSaved: boolean;
  }[];
  chats: MyChatRow[];
  reviews: { id: string; shopId: string | null; shopName: string; rating: number; comment: string | null; date: string; status: "Published" | "Waiting for approval" | "Hidden" }[];
  reports: { id: string; type: string; title: string; status: string; date: string }[];
};

export async function getCustomerDashboardAction(): Promise<{ success: true; data: CustomerDashboard } | { success: false; error: string }> {
  try {
    const account = await currentAccount();
    if (!account || account.type !== "CUSTOMER") return { success: false, error: "Please sign in to see your account." };
    const userId = account.id;
    const now = new Date();

    const [user, bookings, favorites, promos, chats, reviews, reports] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      prisma.eventInquiry.findMany({
        where: { userId },
        orderBy: { eventDate: "desc" },
        take: 20,
        select: { id: true, eventName: true, eventType: true, eventDate: true, eventTime: true, status: true },
      }),
      prisma.favorite.findMany({
        where: { userId, tenant: { status: "ACTIVE" } },
        orderBy: { createdAt: "desc" },
        select: { tenant: { select: { id: true, shopName: true, unitId: true, logoUrl: true, category: true, isOpen: true } } },
      }),
      prisma.tenantPromo.findMany({
        where: { status: "APPROVED", startDate: { lte: now }, endDate: { gte: now }, tenant: { status: "ACTIVE" } },
        orderBy: { endDate: "asc" },
        take: 40,
        select: {
          id: true,
          title: true,
          description: true,
          promoImage: true,
          mediaType: true,
          endDate: true,
          tenant: { select: { id: true, shopName: true } },
        },
      }),
      getMyChatListAction(userId),
      prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          rating: true,
          comment: true,
          isApproved: true,
          isSpam: true,
          createdAt: true,
          tenant: { select: { id: true, shopName: true } },
        },
      }),
      prisma.lostAndFoundItem.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, title: true, status: true, createdAt: true },
      }),
    ]);

    const saved = new Set(favorites.map((f) => f.tenant.id));
    const promoCount = new Map<string, number>();
    promos.forEach((p) => promoCount.set(p.tenant.id, (promoCount.get(p.tenant.id) ?? 0) + 1));

    return {
      success: true,
      data: {
        name: user?.name || user?.email.split("@")[0] || "there",
        bookings: bookings.map((b) => ({
          id: b.id,
          title: b.eventName || b.eventType,
          eventType: b.eventType,
          date: b.eventDate.toISOString(),
          time: b.eventTime,
          status: b.status,
          upcoming: b.eventDate.getTime() >= now.getTime() - 24 * 3600_000,
        })),
        savedShops: favorites.map(({ tenant: t }) => ({
          id: t.id,
          name: t.shopName,
          unitId: t.unitId,
          logo: t.logoUrl,
          category: t.category,
          isOpen: t.isOpen,
          promoCount: promoCount.get(t.id) ?? 0,
        })),
        // Saved shops' promos first, then the rest, ending soonest first.
        promos: promos
          .map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            image: p.mediaType === "IMAGE" ? p.promoImage : null,
            endDate: p.endDate.toISOString(),
            shopId: p.tenant.id,
            shopName: p.tenant.shopName,
            fromSaved: saved.has(p.tenant.id),
          }))
          .sort((a, b) => Number(b.fromSaved) - Number(a.fromSaved))
          .slice(0, 9),
        chats: chats.slice(0, 6),
        reviews: reviews.map((r) => ({
          id: r.id,
          shopId: r.tenant?.id ?? null,
          shopName: r.tenant?.shopName ?? "SR Mall",
          rating: r.rating,
          comment: r.comment,
          date: r.createdAt.toISOString(),
          status: r.isSpam ? "Hidden" : r.isApproved ? "Published" : "Waiting for approval",
        })),
        reports: reports.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          status: r.status,
          date: r.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("[CUSTOMER_DASHBOARD]", error);
    return { success: false, error: "Couldn't load your account." };
  }
}
