"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

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

    if (
      (userData?.commentStatus === "MUTED" ||
        userData?.commentStatus === "RESTRICTED") &&
      userData?.commentRestrictedUntil &&
      new Date(userData.commentRestrictedUntil) > new Date()
    ) {
      const until = new Date(userData.commentRestrictedUntil).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      );
      const label =
        userData.commentStatus === "MUTED"
          ? "cannot comment"
          : "are restricted";
      return {
        success: false,
        error: `You ${label} until ${until}.`,
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
        isApproved: false, // Requires admin approval before going public
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

    return {
      success: true,
      data: review,
      message: isSpam
        ? "Review submitted."
        : "Thank you! Your review has been submitted and is pending admin approval.",
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
) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };
    if (rating < 1 || rating > 5)
      return { success: false, error: "Invalid rating" };

    const existingReview = await prisma.review.findFirst({ where: { userId } });
    if (!existingReview) return { success: false, error: "Review not found." };

    const review = await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment: comment || null },
    });

    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
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

export async function deleteMyReviewAction(userId: string) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };

    const existingReview = await prisma.review.findFirst({ where: { userId } });
    if (!existingReview) return { success: false, error: "Review not found." };

    await prisma.review.delete({ where: { id: existingReview.id } });

    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    return { success: true, message: "Review deleted successfully!" };
  } catch (error) {
    console.error("Delete review error:", error);
    return { success: false, error: "Failed to delete review." };
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
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      success: true,
      data: reviews.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: {
          name: review.user.name || "Anonymous",
          email: review.user.email,
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
export async function getAllReviewsAction() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("srmall_user")?.value;
    if (!userCookie) return { success: false, error: "Unauthorized" };

    let user;
    try {
      user = JSON.parse(userCookie);
    } catch {
      return { success: false, error: "Invalid authentication data" };
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (userData?.role !== "ADMIN")
      return { success: false, error: "Admin access required" };

    const reviews = await (prisma as any).review.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            commentStatus: true,
            commentRestrictedUntil: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: reviews };
  } catch (error) {
    console.error("Get all reviews error:", error);
    return { success: false, error: "Failed to load reviews" };
  }
}

/**
 * Admin: toggle spam flag on a review
 */
export async function markReviewSpamAction(reviewId: string, isSpam: boolean) {
  try {
    await (prisma as any).review.update({
      where: { id: reviewId },
      data: { isSpam },
    });
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
    const until =
      days && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;

    await (prisma as any).user.update({
      where: { id: userId },
      data: {
        commentStatus: status,
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

export async function deleteReviewAction(reviewId: string) {
  try {
    await prisma.review.delete({ where: { id: reviewId } });
    revalidatePath("/public-view");
    revalidatePath("/admindashboard");
    return { success: true, message: "Review deleted successfully" };
  } catch (error) {
    console.error("Delete review error:", error);
    return { success: false, error: "Failed to delete review" };
  }
}
