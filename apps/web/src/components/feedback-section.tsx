"use client";

import React, { useState, useEffect } from "react";
import {
  Star,
  MessageSquare,
  Send,
  LogIn,
  Heart,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  submitReviewAction,
  getApprovedReviewsAction,
  editMyReviewAction,
  deleteMyReviewAction,
  getMyReviewAction,
} from "@/app/actions/review";
import { LoginModal } from "@/components/login-modal";
import { useAuth } from "@/app/providers";

interface FeedbackSectionProps {
  isAuthenticated: boolean;
  tenantId?: string;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export const FeedbackSection = ({
  isAuthenticated,
  tenantId,
}: FeedbackSectionProps) => {
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [myPendingReview, setMyPendingReview] = useState<any>(null);

  // ── Data Loaders ───────────────────────────────────────
  const loadMyPendingReview = async (userId: string) => {
    try {
      const result = await getMyReviewAction(userId, tenantId);
      if (result.success && result.data && !(result.data as any).isApproved) {
        setMyPendingReview(result.data);
      } else {
        setMyPendingReview(null);
      }
    } catch {
      setMyPendingReview(null);
    }
  };

  const loadReviews = async () => {
    try {
      const result = await getApprovedReviewsAction(tenantId);
      if (result.success && result.data) {
        setReviews(result.data as Review[]);
      }
      if (user?.id) {
        await loadMyPendingReview(user.id);
      } else {
        setMyPendingReview(null);
      }
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────
  const myReview = user
    ? reviews.find((r) => r.user.email === user.email)
    : undefined;

  // ── Effects ────────────────────────────────────────────
  useEffect(() => {
    loadReviews();
  }, [user?.id]);

  useEffect(() => {
    if (myReview && rating === 0) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
    }
  }, [myReview]);

  const handleDelete = async () => {
    if (!user || !user.id) return;
    if (!confirm("Are you sure you want to delete your review?")) return;
    setIsSubmitting(true);
    try {
      const result = await deleteMyReviewAction(user.id);
      if (result.success) {
        setSubmitMessage({
          type: "success",
          message: "Review deleted successfully!",
        });
        setRating(0);
        setComment("");
        setMyPendingReview(null);
        setTimeout(loadReviews, 1000);
      } else {
        setSubmitMessage({
          type: "error",
          message: result.error || "Failed to delete review.",
        });
      }
    } catch (error) {
      setSubmitMessage({ type: "error", message: "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setSubmitMessage({
        type: "error",
        message: "Please select a rating before submitting.",
      });
      return;
    }

    if (!user || (!user.id && !isAuthenticated)) {
      setSubmitMessage({
        type: "error",
        message: "Session error. Please log in again.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const result = myReview
        ? await editMyReviewAction(user.id, rating, comment)
        : await submitReviewAction(user.id, rating, comment, tenantId);

      if (result.success) {
        setSubmitMessage({
          type: "success",
          message: result.message || "Your review is now live!",
        });
        setRating(0);
        setComment("");
        setTimeout(loadReviews, 800);
      } else {
        setSubmitMessage({
          type: "error",
          message: result.error || "Failed to submit review.",
        });
      }
    } catch (error) {
      setSubmitMessage({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    if (diffInHours < 48) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <>
      <div
        id="feedback"
        className={clsx(
          "py-16",
          "sm:py-20",
          "lg:py-24",
          "bg-gradient-to-b",
          "from-zinc-50",
          "to-white",
          "dark:from-zinc-950",
          "dark:to-zinc-900",
        )}
      >
        <div
          className={clsx("max-w-7xl", "mx-auto", "px-4", "sm:px-6", "lg:px-8")}
        >
          {/* Section Header */}
          <div className={clsx("text-center", "mb-12", "sm:mb-16")}>
            <span
              className={clsx(
                "inline-flex",
                "items-center",
                "gap-2",
                "text-xs",
                "uppercase",
                "tracking-[0.2em]",
                "text-primary",
                "font-bold",
                "bg-primary/10",
                "px-4",
                "py-1.5",
                "rounded-full",
                "mb-4",
              )}
            >
              <Heart size={14} />
              Community Voices
            </span>
            <h2
              className={clsx(
                "text-2xl",
                "sm:text-3xl",
                "lg:text-4xl",
                "font-black",
                "text-charcoal",
                "dark:text-white",
                "tracking-tight",
                "mb-3",
              )}
            >
              Customer Experiences
            </h2>
            <p
              className={clsx(
                "text-slate-500",
                "font-medium",
                "text-sm",
                "sm:text-base",
                "max-w-xl",
                "mx-auto",
              )}
            >
              Real feedback from our valued visitors and tenants
            </p>
          </div>

          <div
            className={clsx(
              "flex",
              "flex-row",
              "overflow-x-auto",
              "no-scrollbar",
              "snap-x",
              "snap-mandatory",
              "gap-4",
              "sm:gap-8",
              "lg:grid",
              "lg:grid-cols-2",
              "lg:gap-12",
              "pb-4",
            )}
          >
            <div
              className={clsx(
                "w-[85%] sm:w-[500px] lg:w-auto",
                "shrink-0",
                "snap-center",
                "space-y-3 sm:space-y-4",
                "max-h-[400px]",
                "sm:max-h-[600px]",
                "overflow-y-auto",
                "pr-1 sm:pr-4",
                "custom-scrollbar",
              )}
            >
              {myPendingReview && (
                <div
                  className={clsx(
                    "p-3",
                    "sm:p-6",
                    "bg-amber-500/5",
                    "border",
                    "border-amber-500/20",
                    "rounded-xl",
                    "sm:rounded-2xl",
                    "mb-4 animate-pulse",
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        <AlertCircle size={10} /> Review Pending
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 italic">
                    "{myPendingReview.comment}"
                  </p>
                </div>
              )}

              {/* Reviews appear instantly — no approval needed */}
              {isLoading ? (
                <div className={clsx("text-center", "py-12")}>
                  <div
                    className={clsx(
                      "inline-block",
                      "animate-spin",
                      "rounded-full",
                      "h-8",
                      "w-8",
                      "border-b-2",
                      "border-primary",
                    )}
                  ></div>
                </div>
              ) : reviews.length > 0 ? (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    className={clsx(
                      "p-3",
                      "sm:p-6",
                      "bg-white",
                      "dark:bg-zinc-900",
                      "rounded-xl",
                      "sm:rounded-2xl",
                      "shadow-sm",
                      "border",
                      "border-slate-100",
                      "dark:border-white/5",
                      "hover:shadow-md",
                      "transition-shadow",
                    )}
                  >
                    <div
                      className={clsx(
                        "flex",
                        "justify-between",
                        "items-start",
                        "mb-2",
                        "sm:mb-4",
                      )}
                    >
                      <div
                        className={clsx(
                          "flex",
                          "items-center",
                          "gap-2 sm:gap-3",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-8",
                            "h-8",
                            "sm:w-12",
                            "sm:h-12",
                            "bg-gradient-to-br",
                            "from-primary/20",
                            "to-primary/5",
                            "dark:from-zinc-800",
                            "dark:to-zinc-700",
                            "rounded-full",
                            "flex",
                            "items-center",
                            "justify-center",
                            "font-black",
                            "text-primary",
                            "text-[10px]",
                            "sm:text-base",
                          )}
                        >
                          {review.user?.name
                            ? review.user.name.charAt(0).toUpperCase()
                            : "U"}
                        </div>
                        <div>
                          <h4
                            className={clsx(
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                              "text-[10px]",
                              "sm:text-base",
                              "uppercase",
                              "tracking-tighter",
                            )}
                          >
                            {review.user?.name || "Anonymous"}
                          </h4>
                          <p
                            className={clsx(
                              "text-[8px]",
                              "sm:text-xs",
                              "text-slate-400",
                              "font-bold",
                            )}
                          >
                            {formatDate(review.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={clsx("flex", "gap-0.5")}>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={8}
                              className={
                                i < review.rating
                                  ? "fill-primary text-primary"
                                  : "text-slate-200"
                              }
                            />
                          ))}
                        </div>
                        {user && user.email === review.user?.email && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <a
                              href="#feedback-form"
                              onClick={() => {
                                setRating(review.rating);
                                setComment(review.comment || "");
                              }}
                              className="text-[8px] text-primary font-black uppercase tracking-widest hover:underline cursor-pointer"
                            >
                              Edit
                            </a>
                            <button
                              onClick={handleDelete}
                              disabled={isSubmitting}
                              className="text-[8px] text-red-500 font-black uppercase tracking-widest hover:underline cursor-pointer"
                            >
                              Del
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {review.comment && (
                      <p
                        className={clsx(
                          "text-[10px]",
                          "sm:text-sm",
                          "text-slate-600",
                          "dark:text-slate-300",
                          "leading-snug",
                          "font-medium",
                        )}
                      >
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div
                  className={clsx(
                    "text-center",
                    "py-8",
                    "bg-white",
                    "dark:bg-zinc-900",
                    "rounded-xl",
                    "border",
                    "border-dashed",
                    "border-slate-200",
                    "dark:border-white/10",
                  )}
                >
                  <MessageSquare
                    size={24}
                    className={clsx("mx-auto", "text-slate-300", "mb-2")}
                  />
                  <p
                    className={clsx(
                      "text-slate-500",
                      "font-bold",
                      "text-[10px]",
                    )}
                  >
                    Be the first to share.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Submit Form */}
            <div
              id="feedback-form"
              className={clsx(
                "w-[85%] sm:w-[500px] lg:w-auto",
                "shrink-0",
                "snap-center",
                "lg:sticky",
                "lg:top-24",
                "h-fit",
              )}
            >
              <div
                className={clsx(
                  "p-4",
                  "sm:p-6",
                  "lg:p-8",
                  "bg-white",
                  "dark:bg-zinc-900",
                  "rounded-xl",
                  "sm:rounded-3xl",
                  "shadow-xl",
                  "border",
                  "border-slate-100",
                  "dark:border-white/5",
                )}
              >
                <div
                  className={clsx(
                    "flex",
                    "items-center",
                    "gap-2 sm:gap-3",
                    "mb-4 sm:mb-6",
                  )}
                >
                  <div
                    className={clsx(
                      "w-8 h-8 sm:w-12 sm:h-12",
                      "bg-primary/10",
                      "rounded-lg sm:rounded-2xl",
                      "flex",
                      "items-center",
                      "justify-center",
                    )}
                  >
                    <MessageSquare
                      size={16}
                      className={clsx("text-primary", "sm:w-6", "sm:h-6")}
                    />
                  </div>
                  <h3
                    className={clsx(
                      "text-[14px]",
                      "sm:text-xl",
                      "lg:text-2xl",
                      "font-black",
                      "text-charcoal",
                      "dark:text-white",
                      "tracking-tighter",
                      "uppercase",
                    )}
                  >
                    Experience
                  </h3>
                </div>

                {!isAuthenticated ? (
                  <div
                    className={clsx(
                      "flex",
                      "flex-col",
                      "items-center",
                      "text-center",
                      "p-4",
                      "sm:p-10",
                      "bg-zinc-50",
                      "dark:bg-zinc-800/50",
                      "rounded-xl",
                      "sm:rounded-2xl",
                      "border-2",
                      "border-dashed",
                      "border-slate-200",
                      "dark:border-zinc-700",
                    )}
                  >
                    <LogIn
                      size={20}
                      className={clsx(
                        "text-primary",
                        "mb-3",
                        "sm:w-7",
                        "sm:h-7",
                      )}
                    />
                    <h4
                      className={clsx(
                        "text-[12px]",
                        "sm:text-lg",
                        "font-black",
                        "text-charcoal",
                        "dark:text-white",
                        "mb-1 uppercase tracking-widest",
                      )}
                    >
                      Community Auth
                    </h4>
                    <p
                      className={clsx(
                        "text-[9px]",
                        "sm:text-sm",
                        "text-slate-500",
                        "font-medium",
                        "leading-snug",
                        "mb-4 sm:mb-6",
                      )}
                    >
                      Sign in to share your journey.
                    </p>
                    <button
                      suppressHydrationWarning
                      onClick={() => setIsLoginModalOpen(true)}
                      className={clsx(
                        "w-full",
                        "px-6",
                        "py-2.5",
                        "sm:py-4",
                        "bg-primary",
                        "text-white",
                        "font-black",
                        "text-[10px] sm:text-xs",
                        "rounded-lg sm:rounded-xl",
                        "hover:bg-primary-hover",
                        "transition-all",
                        "active:scale-95",
                        "shadow-lg",
                        "shadow-primary/30",
                        "uppercase",
                        "tracking-[0.15em]",
                      )}
                    >
                      Auth Identity
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {submitMessage && (
                      <div
                        className={`p-2 sm:p-4 rounded-lg flex items-center gap-2 ${
                          submitMessage.type === "success"
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                        }`}
                      >
                        <AlertCircle size={14} />
                        <p
                          className={clsx(
                            "text-[9px] sm:text-sm",
                            "font-black",
                            "uppercase",
                          )}
                        >
                          {submitMessage.message}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5 sm:space-y-2">
                      <label
                        className={clsx(
                          "text-[9px]",
                          "font-black",
                          "text-slate-400",
                          "uppercase",
                          "tracking-widest",
                        )}
                      >
                        Rating Selection
                      </label>
                      <div className={clsx("flex", "gap-1.5")}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            suppressHydrationWarning
                            key={star}
                            onClick={() => setRating(star)}
                            disabled={isSubmitting}
                            className={clsx(
                              "transition-all",
                              "active:scale-90",
                              "disabled:opacity-50",
                            )}
                          >
                            <Star
                              size={20}
                              className={`transition-colors sm:size-8 ${
                                star <= rating
                                  ? "fill-primary text-primary"
                                  : "text-slate-200"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label
                        className={clsx(
                          "text-[9px]",
                          "font-black",
                          "text-slate-400",
                          "uppercase",
                          "tracking-widest",
                        )}
                      >
                        Protocol Detail
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Detail your experience..."
                        disabled={isSubmitting}
                        className={clsx(
                          "w-full",
                          "px-3",
                          "sm:px-6",
                          "py-2.5",
                          "sm:py-4",
                          "bg-zinc-50",
                          "dark:bg-zinc-800",
                          "rounded-lg sm:rounded-2xl",
                          "text-[10px] sm:text-sm",
                          "font-bold",
                          "text-black",
                          "dark:text-white",
                          "focus:ring-2",
                          "focus:ring-primary/20",
                          "outline-none",
                          "border",
                          "border-transparent",
                          "transition-all",
                          "min-h-[80px]",
                          "sm:min-h-[160px]",
                          "resize-none",
                        )}
                      />
                    </div>

                    <button
                      suppressHydrationWarning
                      onClick={handleSubmit}
                      disabled={isSubmitting || rating === 0}
                      className={clsx(
                        "w-full",
                        "py-3 sm:py-4",
                        "bg-primary",
                        "text-white",
                        "font-black",
                        "text-[10px] sm:text-xs",
                        "rounded-lg sm:rounded-xl",
                        "hover:bg-primary-hover",
                        "transition-all",
                        "active:scale-95",
                        "shadow-lg",
                        "shadow-primary/30",
                        "uppercase",
                        "tracking-widest",
                      )}
                    >
                      {isSubmitting ? "Syncing..." : "Log Experience"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
