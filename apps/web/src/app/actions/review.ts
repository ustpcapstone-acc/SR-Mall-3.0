"use server";

import { ownShop, shopRef } from "@/lib/shops";
import { workspaceScope } from "@/lib/workspace-server";
import { currentAccount, requireStaff } from "@/lib/auth-server";
import { holds, requireSelf, requireStore } from "@/lib/action-guard";
import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { findInappropriateLanguage } from "@/lib/comment-moderation";
import { PAGE_SIZE, clampPage, likeText } from "@/lib/paging";

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

/**
 * Progressive warnings are stored in the existing `commentStatus` column, so
 * no database migration is needed:
 *   ACTIVE → 0 offenses, WARNED_1 → 1, WARNED_2 → 2, MUTED/RESTRICTED → 3+.
 * `effectiveCommentStatus` deliberately treats WARNED_* as ACTIVE: the user
 * can still comment, they have just used up their warnings.
 */
function commentOffenseCount(status?: string | null) {
  if (status === "WARNED_1") return 1;
  if (status === "WARNED_2") return 2;
  if (status === "MUTED" || status === "RESTRICTED") return 3;
  return 0;
}

type CommentGate =
  | { ok: true; status: string | null }
  | { ok: false; error: string };

/** Banned / muted accounts cannot post or edit reviews. */
async function checkCommentPermission(userId: string): Promise<CommentGate> {
  const userData = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { commentStatus: true, commentRestrictedUntil: true },
  });

  if (userData?.commentStatus === "BANNED") {
    return {
      ok: false,
      error: "Your account has been banned from commenting.",
    };
  }

  if (effectiveCommentStatus(userData) === "MUTED") {
    if (!userData?.commentRestrictedUntil) {
      return {
        ok: false,
        error: "You have been muted from posting reviews.",
      };
    }
    const until = new Date(userData.commentRestrictedUntil).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );
    return {
      ok: false,
      error: `You cannot post reviews until ${until}.`,
    };
  }

  return { ok: true, status: userData?.commentStatus ?? null };
}

type CommentLanguageResult =
  | { blocked: false }
  | {
      blocked: true;
      offense: number;
      muted: boolean;
      mutedUntil?: string;
      message: string;
    };

/**
 * Progressive penalty for inappropriate language:
 *  - 1st and 2nd offense → warning only (the comment is not saved)
 *  - 3rd offense → 24-hour comment mute
 */
async function moderateCommentLanguage(
  userId: string,
  comment: string | undefined,
  currentStatus: string | null,
): Promise<CommentLanguageResult> {
  const match = findInappropriateLanguage(comment);
  if (!match) return { blocked: false };

  const offense = commentOffenseCount(currentStatus) + 1;

  if (offense >= 3) {
    const mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await (prisma as any).user.update({
      where: { id: userId },
      data: {
        commentStatus: "MUTED",
        commentRestrictedUntil: mutedUntil,
      },
    });
    return {
      blocked: true,
      offense,
      muted: true,
      mutedUntil: mutedUntil.toISOString(),
      message:
        "This is your third inappropriate-language offense. Commenting is paused for 24 hours.",
    };
  }

  await (prisma as any).user.update({
    where: { id: userId },
    data: { commentStatus: `WARNED_${offense}` },
  });

  return {
    blocked: true,
    offense,
    muted: false,
    message:
      offense === 1
        ? "Your comment contains inappropriate language. This is warning 1 of 2. Please revise it before posting."
        : "Your comment still contains inappropriate language. This is warning 2 of 2. A third offense pauses commenting for 24 hours.",
  };
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

/** Moderators: from the signed session, never from the id the browser sends. */
async function requireAdmin(_adminUserId?: string) {
  const account = await currentAccount();
  return !!account && holds(account, "users");
}

export async function submitReviewAction(
  userId: string,
  rating: number,
  comment?: string,
  tenantId?: string,
) {
  try {
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    await requireSelf(userId);
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

    // ── Comment permission + inappropriate-language checks ──────────────────
    const gate = await checkCommentPermission(userId);
    if (!gate.ok) {
      return { success: false, error: gate.error };
    }

    const language = await moderateCommentLanguage(
      userId,
      comment,
      gate.status,
    );
    if (language.blocked) {
      return {
        success: false,
        error: language.message,
        warning: language.message,
        inappropriate: true,
        offense: language.offense,
        muted: language.muted,
        mutedUntil: language.mutedUntil,
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
        shopId,
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

    revalidatePath("/");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${shopId ?? tenantId}`);
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
          shopId: shopId ?? tenantId,
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
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    await requireSelf(userId);
    if (!userId) return { success: false, error: "Unauthorized" };
    if (rating < 1 || rating > 5)
      return { success: false, error: "Invalid rating" };

    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
        shopId,
      },
    });
    if (!existingReview) return { success: false, error: "Review not found." };

    const gate = await checkCommentPermission(userId);
    if (!gate.ok) {
      return { success: false, error: gate.error };
    }

    const language = await moderateCommentLanguage(
      userId,
      comment,
      gate.status,
    );
    if (language.blocked) {
      return {
        success: false,
        error: language.message,
        warning: language.message,
        inappropriate: true,
        offense: language.offense,
        muted: language.muted,
        mutedUntil: language.mutedUntil,
      };
    }

    const review = await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment: comment || null },
    });

    revalidatePath("/");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${shopId ?? tenantId}`);
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
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    await requireSelf(userId);
    if (!userId) return { success: false, error: "Unauthorized" };

    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
        shopId,
      },
    });
    if (!existingReview) return { success: false, error: "Review not found." };

    await prisma.review.delete({ where: { id: existingReview.id } });

    revalidatePath("/");
    revalidatePath("/admindashboard");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/tenantdashboard");
    revalidatePath("/tenantdashboard/feedback-reviews");
    if (tenantId) {
      revalidatePath(`/shop/${shopId ?? tenantId}`);
    }
    return { success: true, message: "Review deleted successfully!" };
  } catch (error) {
    console.error("Delete review error:", error);
    return { success: false, error: "Failed to delete review." };
  }
}

export async function getTenantStoreRatingAction(tenantId: string) {
  try {
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    if (!tenantId) return { success: false, error: "Tenant ID required" };
    const reviews = await prisma.review.findMany({
      where: {
        tenantId,
        shopId,
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
      select: { tenantId: true, shopId: true, rating: true },
    });

    const ratingsMap: Record<
      string,
      { sum: number; count: number; avg: number }
    > = {};

    for (const r of reviews) {
      const key = r.shopId ?? r.tenantId;
      if (!key) continue;
      if (!ratingsMap[key]) {
        ratingsMap[key] = { sum: 0, count: 0, avg: 0 };
      }
      ratingsMap[key].sum += r.rating;
      ratingsMap[key].count += 1;
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
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    await requireSelf(userId);
    const review = await (prisma as any).review.findFirst({
      where: {
        userId,
        tenantId: tenantId || null,
        shopId,
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
    // Reviews belong to one shop: split the public id into account and shop.
    const ref = tenantId ? await shopRef(tenantId) : null;
    if (ref) tenantId = ref.tenantId;
    const shopId = ref?.shopId ?? null;
    const where = {
      isApproved: true,
      isSpam: false,
      tenantId: tenantId || null,
      shopId,
    };
    const [reviews, byRating] = await Promise.all([
      (prisma as any).review.findMany({
        where,
        include: {
          user: {
            select: { name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // The summary counts every published review, not only the 50 listed.
      (prisma as any).review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    ]);
    /** How many gave 1, 2, 3, 4 and 5 stars. */
    const counts = [1, 2, 3, 4, 5].map(
      (stars) => (byRating.find((row: any) => row.rating === stars)?._count._all as number) ?? 0,
    );
    const total = counts.reduce((sum, n) => sum + n, 0);
    const average = total ? counts.reduce((sum, n, i) => sum + n * (i + 1), 0) / total : 0;

    const extras = await reviewExtras(reviews.map((r: any) => r.id));
    return {
      success: true,
      summary: { total, average, counts },
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

export type ReviewBucket = "pending" | "published" | "flagged";

/** Flagged: spam, or reported by the shop and waiting for an admin decision. */
const REVIEW_BUCKETS = {
  pending: { isSpam: false, reportedAt: null, isApproved: false },
  published: { isSpam: false, reportedAt: null, isApproved: true },
  flagged: { OR: [{ isSpam: true }, { reportedAt: { not: null } }] },
};

/**
 * Admin: one page of reviews in a queue, newest first, with the search and
 * filters applied, plus the totals shown above the list.
 */
export async function getAdminReviewsAction(
  input: { bucket?: ReviewBucket | null; search?: string; shop?: string; rating?: string; page?: number } = {},
) {
  try {
    if (!(await requireAdmin())) {
      return { success: false as const, error: "Admin access required" };
    }
    const [pending, published, flagged, average, restricted, shops] = await Promise.all([
      prisma.review.count({ where: REVIEW_BUCKETS.pending }),
      prisma.review.count({ where: REVIEW_BUCKETS.published }),
      prisma.review.count({ where: REVIEW_BUCKETS.flagged }),
      prisma.review.aggregate({ where: REVIEW_BUCKETS.published, _avg: { rating: true } }),
      // Reviewers who are banned, or still muted.
      prisma.user.count({
        where: {
          reviews: { some: {} },
          OR: [
            { commentStatus: "BANNED" },
            {
              commentStatus: { in: ["MUTED", "RESTRICTED"] },
              OR: [{ commentRestrictedUntil: null }, { commentRestrictedUntil: { gt: new Date() } }],
            },
          ],
        },
      }),
      prisma.tenant.findMany({
        where: { reviews: { some: {} } },
        select: { id: true, shopName: true },
        orderBy: { shopName: "asc" },
      }),
    ]);
    const counts = { pending, published, flagged };
    // Open on the queue that needs work first.
    const bucket: ReviewBucket =
      input.bucket && input.bucket in REVIEW_BUCKETS
        ? input.bucket
        : pending > 0
          ? "pending"
          : flagged > 0
            ? "flagged"
            : "published";
    const search = likeText(input.search);
    const shop = String(input.shop ?? "all");
    const rating = Number(input.rating);
    const contains = { contains: search, mode: "insensitive" as const };
    const where = {
      AND: [
        REVIEW_BUCKETS[bucket],
        shop === "mall" ? { tenantId: null } : shop !== "all" ? { tenantId: shop } : {},
        Number.isInteger(rating) && rating >= 1 && rating <= 5 ? { rating } : {},
        search
          ? { OR: [{ comment: contains }, { user: { name: contains } }, { user: { email: contains } }, { tenant: { shopName: contains } }] }
          : {},
      ],
    };
    const total = await prisma.review.count({ where });
    const page = clampPage(input.page, total);
    const reviews = await prisma.review.findMany({
      where,
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    return {
      success: true as const,
      data: {
        rows: reviews.map((r) => ({
          ...r,
          user: r.user ? { ...r.user, effectiveCommentStatus: effectiveCommentStatus(r.user) } : null,
        })),
        total,
        page,
        bucket,
        counts,
        stats: { total: pending + published + flagged, average: average._avg.rating ?? 0, restricted },
        shops,
      },
    };
  } catch (error) {
    console.error("Get admin reviews error:", error);
    return { success: false as const, error: "Failed to load reviews" };
  }
}

/** Who a moderation decision affects: the review's author and the shop. */
async function reviewParties(reviewId: string) {
  const rows = await prisma.$queryRawUnsafe<
    { userId: string; tenantUserId: string | null; shopName: string | null; shopId: string | null; reportedAt: Date | null }[]
  >(
    `SELECT r."userId", t."userId" AS "tenantUserId", COALESCE(NULLIF(u."shopName", ''), t."shopName") AS "shopName",
            COALESCE(r."shopId", r."tenantId") AS "shopId", r."reportedAt"
       FROM "Review" r LEFT JOIN "Tenant" t ON t."id" = r."tenantId"
       LEFT JOIN "UnitShop" u ON u."id" = r."shopId" WHERE r."id" = $1`,
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
      shopId: parties.shopId,
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
    await requireStaff("users");
    const parties = await reviewParties(reviewId);
    // Flagging hides the review; clearing the flag publishes it again. That
    // keeps every review in exactly one moderation bucket.
    await (prisma as any).review.update({
      where: { id: reviewId },
      data: { isSpam, isApproved: !isSpam },
    });
    // The admin has decided, a shop's report on this review is resolved.
    await prisma.$executeRawUnsafe(
      `UPDATE "Review" SET "reportedAt" = NULL, "reportReason" = NULL WHERE "id" = $1`,
      reviewId,
    );
    await notifyReviewModeration(parties, isSpam ? "hidden" : "restored");
    revalidatePath("/");
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
    await requireStaff("users");
    // RESTRICTED was enforced exactly like MUTED, fold it in.
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
    await requireStaff("users");
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true, isSpam: false },
      include: {
        user: { select: { name: true, email: true } },
      },
    });
    revalidatePath("/");
    revalidatePath("/admindashboard");
    return { success: true, data: review, message: "Review approved" };
  } catch (error) {
    console.error("Approve review error:", error);
    return { success: false, error: "Failed to approve review" };
  }
}

export async function unpublishReviewAction(reviewId: string) {
  try {
    await requireStaff("users");
    const parties = await reviewParties(reviewId);
    await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: false },
    });
    await notifyReviewModeration(parties, "hidden");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Unpublish review error:", error);
    return { success: false, error: "Failed to unpublish review" };
  }
}

export async function deleteReviewAction(reviewId: string) {
  try {
    await requireStaff("users");
    const parties = await reviewParties(reviewId);
    await prisma.review.delete({ where: { id: reviewId } });
    await notifyReviewModeration(parties, "deleted");
    revalidatePath("/");
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
    const account = await requireStore(userId, { sections: ["reviews"] });
    const tenant = await tenantForUser(userId);
    if (!tenant) return { success: false as const, error: "No storefront is linked to this account." };
    const scope = await workspaceScope(tenant.id, account.tenantStaff?.leaseId);
    const shop = await ownShop(tenant.id, scope.shopId);

    const rating = options.rating && options.rating >= 1 && options.rating <= 5 ? options.rating : null;
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const order = TENANT_REVIEW_ORDER[options.sort ?? "newest"] ?? TENANT_REVIEW_ORDER.newest;
    const base = `r."tenantId" = $1 AND r."shopId" IS NOT DISTINCT FROM $2::text AND r."isApproved" = true AND r."isSpam" = false`;
    const filters = `${base}
      AND ($3::int IS NULL OR r."rating" = $3::int)
      AND (NOT $4::boolean OR COALESCE(TRIM(r."comment"), '') <> '')
      AND (NOT $5::boolean OR (COALESCE(TRIM(r."comment"), '') <> '' AND r."reply" IS NULL))`;
    const params = [tenant.id, scope.shopKey, rating, Boolean(options.withComment), Boolean(options.needsReply)];

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
        scope.shopKey,
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
      prisma.review.count({ where: { tenantId: tenant.id, shopId: scope.shopKey, isApproved: false, isSpam: false } }),
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
        shopName: shop?.shopName ?? "",
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
async function ownedReview(userId: string, reviewId: string, staffLeaseId?: string) {
  const tenant = await tenantForUser(userId);
  if (!tenant) return { error: "No storefront is linked to this account." } as const;
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, tenantId: true, shopId: true, userId: true },
  });
  if (!review || review.tenantId !== tenant.id) return { error: "Review not found." } as const;
  // Store staff only handle the reviews of the shop they work in.
  if (staffLeaseId && (await workspaceScope(tenant.id, staffLeaseId)).shopKey !== review.shopId) {
    return { error: "Review not found." } as const;
  }
  const shop = await ownShop(tenant.id, review.shopId ?? tenant.id);
  if (!shop) return { error: "Review not found." } as const;
  return { tenant, review, shop } as const;
}

/** Tenant: add, edit or (with an empty text) remove the shop's public reply. */
export async function replyToReviewAction(userId: string, reviewId: string, reply: string) {
  try {
    const account = await requireStore(userId, { sections: ["reviews"] });
    const owned = await ownedReview(userId, reviewId, account.tenantStaff?.leaseId);
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
        title: `${owned.shop.shopName} replied to your review`,
        message: `"${text.length > 140 ? `${text.slice(0, 140)}…` : text}"`,
        link: `/shop/${owned.shop.id}`,
      });
    }

    revalidatePath(`/shop/${owned.shop.id}`);
    return { success: true, reply: text || null };
  } catch (error: any) {
    console.error("Reply to review error:", error);
    return { success: false, error: "Couldn't save the reply." };
  }
}

/** Tenant: ask the mall admin to review a fake or abusive review. */
export async function reportReviewAction(userId: string, reviewId: string, reason: string) {
  try {
    const account = await requireStore(userId, { sections: ["reviews"] });
    const owned = await ownedReview(userId, reviewId, account.tenantStaff?.leaseId);
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
      title: `Review reported by ${owned.shop.shopName}`,
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
