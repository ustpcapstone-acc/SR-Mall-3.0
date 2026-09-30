"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

/**
 * The comment status that actually applies right now:
 *  - BANNED stays banned
 *  - MUTED (and the legacy RESTRICTED) is MUTED until its end date passes;
 *    no end date means an indefinite mute
 *  - everything else is ACTIVE
 */
function effectiveCommentStatus(user?: {
  commentStatus?: string | null;
  commentRestrictedUntil?: Date | string | null;
} | null): "ACTIVE" | "MUTED" | "BANNED" {
  const status = user?.commentStatus || "ACTIVE";
  if (status === "BANNED") return "BANNED";
  if (status === "MUTED" || status === "RESTRICTED") {
    const until = user?.commentRestrictedUntil;
    if (!until || new Date(until) > new Date()) return "MUTED";
  }
  return "ACTIVE";
}

/** reply / report columns for a set of reviews (raw SQL: new columns). */
async function reviewExtras(ids: string[]) {
  const map = new Map<
    string,
    { reply: string | null; repliedAt: Date | null; reportedAt: Date | null; reportReason: string | null }
  >();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "reply", "repliedAt", "reportedAt", "reportReason" FROM "Review" WHERE "id" = ANY($1::text[])`,
      ids,
    );
    rows.forEach((r) => map.set(r.id, r));
  } catch (error) {
    console.error("[reviews] extras lookup failed:", error);
  }
  return map;
}

async function tenantForUser(userId?: string) {
  if (!userId) return null;
  return prisma.tenant.findUnique({
    where: { userId },
    select: { id: true, shopName: true, userId: true },
  });
}

async function requireAdmin(adminUserId?: string) {
  if (!adminUserId) return false;
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });
  return admin?.role === "ADMIN";
}

export async function submitReviewAction(
  userId: string,
  rating: number,
  comment?: string,
  tenantId?: string,
) {
  try {
    if (!userId) {
      return {
        success: false,
        error: "You must be logged in to submit a review",
      };
    }

    if (rating < 1 || rating > 5) {
      return {
        success: false,
        error: "Rating must be between 1 and 5 stars",
      };
    }

    // ── Check user comment restrictions ──────────────────────────────────────
    const userData = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { commentStatus: true, commentRestrictedUntil: true },
    });

    if (userData?.commentStatus === "BANNED") {
      return {
        success: false,
        error: "Your account has been banned from commenting.",
      };
    }

    if (effectiveCommentStatus(userData) === "MUTED") {
      if (!userData?.commentRestrictedUntil) {
        return {
          success: false,
          error: "You have been muted from posting reviews.",
        };
      }
      const until = new Date(userData.commentRestrictedUntil).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      );
      return {
        success: false,
        error: `You cannot post reviews until ${until}.`,
      };
    }
    // ── Spam detection: count reviews in past 24 hours ───────────────────────
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await (prisma as any).review.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    });

    // 3rd+ review in a 24h window → auto-mark as spam
    const isSpam = recentCount >= 2;

    const review = await (prisma as any).review.create({
      data: {
        userId,
        tenantId: tenantId || null,
        rating,
        comment: comment || null,
        isApproved: !isSpam, // Auto-approve legitimate reviews!
        isSpam,
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${tenantId}`);
    }

    // ⭐ A published review on a shop → tell the shop owner.
    if (tenantId && !isSpam) {
      const shop = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { userId: true },
      });
      if (shop?.userId && shop.userId !== userId) {
        const { notify } = await import("@/lib/notify");
        await notify("NEW_REVIEW", {
          recipients: [shop.userId],
          title: `New ${rating}-star review`,
          message: `${review?.user?.name || "A customer"} rated your shop ${rating}/5${
            comment ? `: "${comment.length > 120 ? `${comment.slice(0, 120)}…` : comment}"` : "."
          }`,
          link: "/tenantdashboard/feedback-reviews",
        });
      }
    }

    // 🛡️ Anti-spam protocol tripped → flag it for moderation.
    if (isSpam) {
      const { notify } = await import("@/lib/notify");
      await notify("FEEDBACK_SPAM_DETECTED", {
        title: "Review Flagged as Spam",
        message: `${
          review?.user?.name || "A shopper"
        } posted ${recentCount + 1} reviews within 24 hours${
          tenantId ? ` on shop ${tenantId}` : ""
        }. The latest one was auto-held for moderation.`,
        link: "/admindashboard/user-management",
      });
    }

    return {
      success: true,
      data: review,
      message: isSpam
        ? "Review submitted but flagged for moderation due to high activity."
        : "Review submitted successfully and is now live!",
    };
  } catch (error) {
    console.error("Submit review error:", error);
    return {
      success: false,
      error: "Failed to submit review. Please try again.",
    };
  }
}

export async function editMyReviewAction(
  userId: string,
  rating: number,
  comment?: string,
  tenantId?: string,
) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };
    if (rating < 1 || rating > 5)
      return { success: false, error: "Invalid rating" };

    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
      },
    });
    if (!existingReview) return { success: false, error: "Review not found." };

    const review = await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment: comment || null },
    });

    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${tenantId}`);
    }
    return {
      success: true,
      data: review,
      message: "Review updated successfully!",
    };
  } catch (error) {
    console.error("Edit review error:", error);
    return { success: false, error: "Failed to update review." };
  }
}

export async function deleteMyReviewAction(userId: string, tenantId?: string) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };

    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
      },
    });
    if (!existingReview) return { success: false, error: "Review not found." };

    await prisma.review.delete({ where: { id: existingReview.id } });

    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${tenantId}`);
    }
    return { success: true, message: "Review deleted successfully!" };
  } catch (error) {
    console.error("Delete review error:", error);
    return { success: false, error: "Failed to delete review." };
  }
}

export async function getTenantStoreRatingAction(tenantId: string) {
  try {
    if (!tenantId) return { success: false, error: "Tenant ID required" };
    const reviews = await prisma.review.findMany({
      where: {
        tenantId,
        isApproved: true,
        isSpam: false,
      },
      select: { rating: true },
    });

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            ).toFixed(1),
          )
        : 0;

    return { success: true, data: { avgRating, totalReviews } };
  } catch (error) {
    console.error("Get tenant rating error:", error);
    return { success: false, error: "Failed to load store rating" };
  }
}

export async function getAllTenantRatingsAction() {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        tenantId: { not: null },
        isApproved: true,
        isSpam: false,
      },
      select: { tenantId: true, rating: true },
    });

    const ratingsMap: Record<
      string,
      { sum: number; count: number; avg: number }
    > = {};

    for (const r of reviews) {
      if (!r.tenantId) continue;
      if (!ratingsMap[r.tenantId]) {
        ratingsMap[r.tenantId] = { sum: 0, count: 0, avg: 0 };
      }
      ratingsMap[r.tenantId].sum += r.rating;
      ratingsMap[r.tenantId].count += 1;
    }

    for (const tid in ratingsMap) {
      ratingsMap[tid].avg = Number(
        (ratingsMap[tid].sum / ratingsMap[tid].count).toFixed(1),
      );
    }

    return { success: true, data: ratingsMap };
  } catch (error) {
    console.error("Get all tenant ratings error:", error);
    return { success: false, data: {} };
  }
}

export async function getMyReviewAction(userId: string, tenantId?: string) {
  try {
    const review = await (prisma as any).review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: review };
  } catch (error) {
    console.error("Get my review error:", error);
    return { success: false, error: "Failed to fetch your review." };
  }
}

/**
 * Public-facing: returns only non-spam, approved reviews
 */
export async function getApprovedReviewsAction(tenantId?: string) {
  try {
    const reviews = await (prisma as any).review.findMany({
      where: {
        isApproved: true,
        isSpam: false,
        tenantId: tenantId || null,
      },
      include: {
        user: {
          select: { name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const extras = await reviewExtras(reviews.map((r: any) => r.id));
    return {
      success: true,
      data: reviews.map((review: any) => ({
        id: review.id,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reply: extras.get(review.id)?.reply ?? null,
        repliedAt: extras.get(review.id)?.repliedAt ?? null,
        // No email: this list is shown publicly.
        user: {
          name: review.user.name || "Anonymous",
          role: review.user.role,
        },
      })),
    };
  } catch (error) {
    console.error("Get reviews error:", error);
    return { success: false, error: "Failed to load reviews" };
  }
}

/**
 * Admin: returns ALL reviews with spam + user info
 */
export async function getAllReviewsAction(adminUserId?: string) {
  try {
    // The session lives in localStorage, so there is no auth cookie to read;
    // the caller passes the signed-in admin's id and we check the role in the DB.
    if (!(await requireAdmin(adminUserId))) {
      return { success: false, error: "Admin access required" };
    }

    const reviews = await (prisma as any).review.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            commentStatus: true,
            commentRestrictedUntil: true,
          },
        },
        tenant: { select: { id: true, shopName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const extras = await reviewExtras(reviews.map((r: any) => r.id));
    return {
      success: true,
      data: reviews.map((r: any) => ({
        ...r,
        ...(extras.get(r.id) || {}),
        user: r.user
          ? { ...r.user, effectiveCommentStatus: effectiveCommentStatus(r.user) }
          : null,
      })),
    };
  } catch (error) {
    console.error("Get all reviews error:", error);
    return { success: false, error: "Failed to load reviews" };
  }
}

/** Who a moderation decision affects: the review's author and the shop. */
async function reviewParties(reviewId: string) {
  const rows = await prisma.$queryRawUnsafe<
    { userId: string; tenantUserId: string | null; shopName: string | null; reportedAt: Date | null }[]
  >(
    `SELECT r."userId", t."userId" AS "tenantUserId", t."shopName", r."reportedAt"
       FROM "Review" r LEFT JOIN "Tenant" t ON t."id" = r."tenantId" WHERE r."id" = $1`,
    reviewId,
  );
  return rows[0] ?? null;
}

/** Bell notices after the admin hides / restores / deletes a review or closes a report. */
async function notifyReviewModeration(
  parties: Awaited<ReturnType<typeof reviewParties>>,
  outcome: "hidden" | "restored" | "deleted" | "report-dismissed",
) {
  if (!parties) return;
  const { notify } = await import("@/lib/notify");
  const shop = parties.shopName || "SR Mall";
  const wasReported = Boolean(parties.reportedAt);

  if (outcome !== "report-dismissed") {
    await notify("REVIEW_MODERATION", {
      recipients: [parties.userId],
      title:
        outcome === "restored" ? `Your review of ${shop} is visible again` : `Your review of ${shop} was removed`,
      message:
        outcome === "restored"
          ? "The moderators checked your review and published it again."
          : "The moderators removed your review because it didn't follow the community guidelines.",
      link: "/tenant-directory",
    });
  }

  if (parties.tenantUserId && (wasReported || outcome === "report-dismissed")) {
    await notify("REVIEW_MODERATION", {
      recipients: [parties.tenantUserId],
      title: outcome === "report-dismissed" ? "Your report was reviewed" : "Your report was upheld",
      message:
        outcome === "report-dismissed"
          ? "The mall office checked the review you reported and decided to keep it published."
          : outcome === "restored"
            ? "The mall office reviewed the report and kept the review published."
            : "The mall office removed the review you reported.",
      link: "/tenantdashboard/feedback-reviews",
    });
  }
}

/**
 * Admin: toggle spam flag on a review
 */
export async function markReviewSpamAction(reviewId: string, isSpam: boolean) {
  try {
    const parties = await reviewParties(reviewId);
    // Flagging hides the review; clearing the flag publishes it again. That
    // keeps every review in exactly one moderation bucket.
    await (prisma as any).review.update({
      where: { id: reviewId },
      data: { isSpam, isApproved: !isSpam },
    });
    // The admin has decided — a shop's report on this review is resolved.
    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "reportedAt" = NULL, "reportReason" = NULL WHERE "id" = $1`,
      reviewId,
    );
    await notifyReviewModeration(parties, isSpam ? "hidden" : "restored");
    revalidatePath("/public-view");
    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Admin: set a user's comment restriction status
 * status: "ACTIVE" | "MUTED" | "RESTRICTED" | "BANNED"
 * days: optional duration (null = permanent for BANNED)
 */
export async function setCommentStatusAction(
  userId: string,
  status: "ACTIVE" | "MUTED" | "RESTRICTED" | "BANNED",
  days?: number,
) {
  try {
    // RESTRICTED was enforced exactly like MUTED — fold it in.
    const normalized = status === "RESTRICTED" ? "MUTED" : status;
    const muteDays = days && days > 0 ? days : 7;
    const until =
      normalized === "MUTED"
        ? new Date(Date.now() + muteDays * 24 * 60 * 60 * 1000)
        : null;

    await (prisma as any).user.update({
      where: { id: userId },
      data: {
        commentStatus: normalized,
        commentRestrictedUntil: until,
      },
    });

    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("[SET_COMMENT_STATUS_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function approveReviewAction(reviewId: string) {
  try {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true, isSpam: false },
      include: {
        user: { select: { name: true, email: true } },
      },
    });
    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    return { success: true, data: review, message: "Review approved" };
  } catch (error) {
    console.error("Approve review error:", error);
    return { success: false, error: "Failed to approve review" };
  }
}

export async function unpublishReviewAction(reviewId: string) {
  try {
    const parties = await reviewParties(reviewId);
    await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: false },
    });
    await notifyReviewModeration(parties, "hidden");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Unpublish review error:", error);
    return { success: false, error: "Failed to unpublish review" };
  }
}

export async function deleteReviewAction(reviewId: string) {
  try {
    const parties = await reviewParties(reviewId);
    await prisma.review.delete({ where: { id: reviewId } });
    await notifyReviewModeration(parties, "deleted");
    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    return { success: true, message: "Review deleted successfully" };
  } catch (error) {
    console.error("Delete review error:", error);
    return { success: false, error: "Failed to delete review" };
  }
}

// ─── Tenant: Feedback & Reviews ──────────────────────────────────────────────

export type TenantReviewSort = "newest" | "oldest" | "highest" | "lowest";

const TENANT_REVIEW_ORDER: Record<TenantReviewSort, string> = {
  newest: `r."createdAt" DESC, r."id" DESC`,
  oldest: `r."createdAt" ASC, r."id" ASC`,
  highest: `r."rating" DESC, r."createdAt" DESC`,
  lowest: `r."rating" ASC, r."createdAt" DESC`,
};

/**
 * Everything the tenant Feedback & Reviews page needs in one request:
 * stats over ALL of the shop's published reviews (same numbers customers
 * see) plus one filtered, sorted page of reviews. Never falls back to mall
 * reviews, and never returns reviewer emails.
 */
export async function getTenantReviewsAction(
  userId: string,
  options: {
    rating?: number | null;
    withComment?: boolean;
    needsReply?: boolean;
    sort?: TenantReviewSort;
    offset?: number;
    limit?: number;
  } = {},
) {
  try {
    const tenant = await tenantForUser(userId);
    if (!tenant) return { success: false as const, error: "No storefront is linked to this account." };

    const rating = options.rating && options.rating >= 1 && options.rating <= 5 ? options.rating : null;
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const order = TENANT_REVIEW_ORDER[options.sort ?? "newest"] ?? TENANT_REVIEW_ORDER.newest;
    const base = `r."tenantId" = $1 AND r."isApproved" = true AND r."isSpam" = false`;
    const filters = `${base}
      AND ($2::int IS NULL OR r."rating" = $2::int)
      AND (NOT $3::boolean OR COALESCE(TRIM(r."comment"), '') <> '')
      AND (NOT $4::boolean OR (COALESCE(TRIM(r."comment"), '') <> '' AND r."reply" IS NULL))`;
    const params = [tenant.id, rating, Boolean(options.withComment), Boolean(options.needsReply)];

    const [statsRows, countRows, rows, pendingCount] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS total,
                COALESCE(AVG(r."rating"), 0)::float AS avg,
                COUNT(*) FILTER (WHERE r."rating" = 5)::int AS r5,
                COUNT(*) FILTER (WHERE r."rating" = 4)::int AS r4,
                COUNT(*) FILTER (WHERE r."rating" = 3)::int AS r3,
                COUNT(*) FILTER (WHERE r."rating" = 2)::int AS r2,
                COUNT(*) FILTER (WHERE r."rating" = 1)::int AS r1,
                COUNT(*) FILTER (WHERE r."createdAt" >= date_trunc('month', timezone('utc', now())))::int AS "thisMonth",
                AVG(r."rating") FILTER (WHERE r."createdAt" >= timezone('utc', now()) - interval '30 days')::float AS "avg30",
                AVG(r."rating") FILTER (WHERE r."createdAt" < timezone('utc', now()) - interval '30 days'
                                          AND r."createdAt" >= timezone('utc', now()) - interval '60 days')::float AS "avgPrev30",
                COUNT(*) FILTER (WHERE COALESCE(TRIM(r."comment"), '') <> '')::int AS "withComment",
                COUNT(*) FILTER (WHERE COALESCE(TRIM(r."comment"), '') <> '' AND r."reply" IS NOT NULL)::int AS "replied"
           FROM "Review" r WHERE ${base}`,
        tenant.id,
      ),
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM "Review" r WHERE ${filters}`, ...params),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT r."id", r."rating", r."comment", r."createdAt", r."reply", r."repliedAt",
                r."reportedAt", r."reportReason", u."name" AS "userName", u."avatarUrl" AS "userAvatar"
           FROM "Review" r JOIN "User" u ON u."id" = r."userId"
          WHERE ${filters}
          ORDER BY ${order}
          LIMIT ${limit} OFFSET ${offset}`,
        ...params,
      ),
      prisma.review.count({ where: { tenantId: tenant.id, isApproved: false, isSpam: false } }),
    ]);

    const st = statsRows[0] || {};
    const total = Number(st.total) || 0;
    const distribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = Number(st[`r${stars}`]) || 0;
      return { stars, count, pct: total ? Math.round((count / total) * 100) : 0 };
    });

    return {
      success: true as const,
      data: {
        shopName: tenant.shopName,
        stats: {
          total,
          average: total ? Number(Number(st.avg).toFixed(2)) : 0,
          distribution,
          thisMonth: Number(st.thisMonth) || 0,
          avg30: st.avg30 == null ? null : Number(Number(st.avg30).toFixed(2)),
          avgPrev30: st.avgPrev30 == null ? null : Number(Number(st.avgPrev30).toFixed(2)),
          withComment: Number(st.withComment) || 0,
          replied: Number(st.replied) || 0,
          awaitingApproval: pendingCount,
        },
        matching: Number(countRows[0]?.n) || 0,
        reviews: rows.map((r) => ({
          id: r.id as string,
          rating: Number(r.rating),
          comment: (r.comment as string | null) ?? null,
          createdAt: new Date(r.createdAt).toISOString(),
          reply: (r.reply as string | null) ?? null,
          repliedAt: r.repliedAt ? new Date(r.repliedAt).toISOString() : null,
          reportedAt: r.reportedAt ? new Date(r.reportedAt).toISOString() : null,
          reportReason: (r.reportReason as string | null) ?? null,
          user: { name: (r.userName as string | null) || "Customer", avatarUrl: (r.userAvatar as string | null) ?? null },
        })),
      },
    };
  } catch (error: any) {
    console.error("Get tenant reviews error:", error);
    return { success: false as const, error: "Failed to load reviews" };
  }
}

export type TenantReviewsData = Extract<
  Awaited<ReturnType<typeof getTenantReviewsAction>>,
  { success: true }
>["data"];

/** Load a review and make sure it belongs to the signed-in tenant's shop. */
async function ownedReview(userId: string, reviewId: string) {
  const tenant = await tenantForUser(userId);
  if (!tenant) return { error: "No storefront is linked to this account." } as const;
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, tenantId: true, userId: true },
  });
  if (!review || review.tenantId !== tenant.id) return { error: "Review not found." } as const;
  return { tenant, review } as const;
}

/** Tenant: add, edit or (with an empty text) remove the shop's public reply. */
export async function replyToReviewAction(userId: string, reviewId: string, reply: string) {
  try {
    const owned = await ownedReview(userId, reviewId);
    if ("error" in owned) return { success: false, error: owned.error };

    const text = (reply || "").trim();
    if (text.length > 1000) return { success: false, error: "Replies can be up to 1,000 characters." };

    const before = await reviewExtras([reviewId]);
    const hadReply = Boolean(before.get(reviewId)?.reply);

    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "reply" = $2, "repliedAt" = $3 WHERE "id" = $1`,
      reviewId,
      text || null,
      text ? new Date() : null,
    );

    // First reply → let the customer know the shop answered.
    if (text && !hadReply && owned.review.userId !== userId) {
      const { notify } = await import("@/lib/notify");
      await notify("REVIEW_REPLY", {
        recipients: [owned.review.userId],
        title: `${owned.tenant.shopName} replied to your review`,
        message: `"${text.length > 140 ? `${text.slice(0, 140)}…` : text}"`,
        link: `/shop/${owned.tenant.id}`,
      });
    }

    revalidatePath(`/shop/${owned.tenant.id}`);
    return { success: true, reply: text || null };
  } catch (error: any) {
    console.error("Reply to review error:", error);
    return { success: false, error: "Couldn't save the reply." };
  }
}

/** Tenant: ask the mall admin to review a fake or abusive review. */
export async function reportReviewAction(userId: string, reviewId: string, reason: string) {
  try {
    const owned = await ownedReview(userId, reviewId);
    if ("error" in owned) return { success: false, error: owned.error };

    const text = (reason || "").trim();
    if (text.length < 5) return { success: false, error: "Tell the admin briefly why (at least 5 characters)." };
    if (text.length > 500) return { success: false, error: "Keep the reason under 500 characters." };

    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "reportedAt" = $2, "reportReason" = $3 WHERE "id" = $1`,
      reviewId,
      new Date(),
      text,
    );

    const { notify } = await import("@/lib/notify");
    await notify("REVIEW_REPORTED", {
      title: `Review reported by ${owned.tenant.shopName}`,
      message: `Reason: "${text.length > 160 ? `${text.slice(0, 160)}…` : text}"`,
      link: "/admindashboard/user-management",
    });

    return { success: true };
  } catch (error: any) {
    console.error("Report review error:", error);
    return { success: false, error: "Couldn't report the review." };
  }
}

/** Admin: keep a reported review published and close the report. */
export async function dismissReviewReportAction(adminUserId: string, reviewId: string) {
  try {
    if (!(await requireAdmin(adminUserId))) return { success: false, error: "Admin access required" };
    const parties = await reviewParties(reviewId);
    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "reportedAt" = NULL, "reportReason" = NULL WHERE "id" = $1`,
      reviewId,
    );
    await notifyReviewModeration(parties, "report-dismissed");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
