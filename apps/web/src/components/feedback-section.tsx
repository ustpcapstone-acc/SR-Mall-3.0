"use client";

import { confirmAction } from "@/components/confirm-dialog";
import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button, InputArea, cn } from "@cloudflare/kumo";
import { Star, MessageSquare, LogIn, AlertTriangle, X } from "lucide-react";
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
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";

interface FeedbackSectionProps {
  isAuthenticated: boolean;
  tenantId?: string;
  title?: string | null;
  description?: string | null;
}

interface Review {
  id: string;
  userId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  /** The shop's public reply, if any. */
  reply?: string | null;
  repliedAt?: string | null;
  user: {
    name: string;
    email?: string;
    role?: string;
  };
}

/** How many reviews show before "Show more". */
const PAGE = 4;

const RATING_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

type Summary = { total: number; average: number; counts: number[] };

/** Five stars, filled up to `value` (an average fills part of a star), read out as one phrase. */
function Stars({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`${Math.round(value * 10) / 10} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = Math.min(Math.max(value - (n - 1), 0), 1);
        return (
          <span key={n} aria-hidden className="relative size-4">
            <Star className="absolute inset-0 size-4 text-kumo-subtle" />
            {filled > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${filled * 100}%` }}>
                <Star className="size-4 max-w-none fill-primary text-primary" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export const FeedbackSection = ({
  isAuthenticated,
  tenantId,
  title,
  description,
}: FeedbackSectionProps) => {
  const titleText = title?.trim() || "Customer Experiences";
  const descriptionText =
    description?.trim() || "Real feedback from our valued visitors and tenants";
  const { user } = useAuth();

  const effectiveTenantId = tenantId || undefined;
  const pathname = usePathname();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shown, setShown] = useState(PAGE);

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
  const [languageWarning, setLanguageWarning] = useState<{
    offense: number;
    muted: boolean;
    mutedUntil?: string;
    message: string;
  } | null>(null);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const isCommentingPaused = Boolean(
    mutedUntil && new Date(mutedUntil).getTime() > Date.now(),
  );

  // ── Data Loaders ───────────────────────────────────────
  const loadMyPendingReview = async (userId: string) => {
    try {
      const result = await getMyReviewAction(userId, effectiveTenantId);
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
    setIsLoading(true);
    try {
      const result = await getApprovedReviewsAction(effectiveTenantId);
      if (result.success && result.data) {
        setReviews(result.data as Review[]);
        setSummary(result.summary ?? null);
      }
      setLoadFailed(!result.success);
      if (user?.id) {
        await loadMyPendingReview(user.id);
      } else {
        setMyPendingReview(null);
      }
    } catch (error) {
      console.error("Failed to load reviews:", error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────
  const myReview = user
    ? reviews.find((r) => r.userId === user.id)
    : undefined;

  // ── Effects ────────────────────────────────────────────
  useEffect(() => {
    loadReviews();
  }, [user?.id, effectiveTenantId]);

  useEffect(() => {
    if (myReview && rating === 0) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
    }
  }, [myReview]);

  const draft = useDraft({
    form: "customer.review",
    scope: [effectiveTenantId ?? "mall"],
    enabled: !isLoading,
    editing: Boolean(myReview),
    value: { rating, comment },
    initial: { rating: myReview?.rating ?? 0, comment: myReview?.comment || "" },
    onRestore: (saved) => {
      setRating(saved.rating);
      setComment(saved.comment);
    },
  });

  const handleDelete = async () => {
    if (!user || !user.id) return;
    if (!(await confirmAction({ title: "Delete your review?", description: "This can't be undone.", confirmLabel: "Delete review" }))) return;
    setIsSubmitting(true);
    try {
      const result = await deleteMyReviewAction(user.id, effectiveTenantId);
      if (result.success) {
        draft.clear();
        setSubmitMessage({
          type: "success",
          message: "Your review has been removed.",
        });
        setRating(0);
        setComment("");
        setMyPendingReview(null);
        setTimeout(loadReviews, 800);
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
        message: "Please sign in again to continue.",
      });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const result = await draft.send(async () =>
        myReview
          ? await editMyReviewAction(user.id, rating, comment, effectiveTenantId)
          : await submitReviewAction(user.id, rating, comment, effectiveTenantId),
      );
      if (!result) return;

      const payload = result as any;
      if (payload.inappropriate) {
        setLanguageWarning({
          offense: Number(payload.offense) || 1,
          muted: Boolean(payload.muted),
          mutedUntil: payload.mutedUntil,
          message:
            payload.warning ||
            payload.error ||
            "Your comment contains inappropriate language.",
        });
        if (payload.muted && payload.mutedUntil) {
          setMutedUntil(payload.mutedUntil);
        }
        setSubmitMessage(null);
        return;
      }

      if (result.success) {
        draft.clear();
        setSubmitMessage({
          type: "success",
          message: result.message || "Thanks for sharing your experience!",
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const dismissLanguageWarning = () => {
    if (!languageWarning) return;
    const canEdit = !languageWarning.muted;
    setLanguageWarning(null);
    if (canEdit) {
      setTimeout(() => commentRef.current?.focus(), 50);
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

  // Your own review comes first, so Edit and Delete are always in reach.
  const ordered = myReview ? [myReview, ...reviews.filter((r) => r.id !== myReview.id)] : reviews;
  const formTitle = myReview ? "Edit your review" : "Share your experience";

  return (
    <>
      <div
        id="feedback"
        className="screen-section bg-linear-to-b from-kumo-recessed to-kumo-base py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mb-10 text-center sm:mb-14">
            <h2 className="mb-3 font-display text-3xl font-semibold tracking-tight text-kumo-default sm:text-4xl lg:text-5xl">
              {titleText}
            </h2>
            <p className="mx-auto max-w-xl text-base text-kumo-subtle">{descriptionText}</p>
          </div>

          {/* One column on phones, so the form is never hidden off to the side. */}
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
            <div className="min-w-0 space-y-4">
              {summary && summary.total > 0 && (
                <div className="flex items-center gap-4 rounded-2xl border border-kumo-line bg-kumo-base p-4 sm:gap-8 sm:p-6">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <p className="font-display text-4xl font-semibold text-kumo-default sm:text-5xl">{summary.average.toFixed(1)}</p>
                    <Stars value={summary.average} />
                    <p className="text-sm text-kumo-subtle">
                      {summary.total} {summary.total === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5" aria-label="Reviews by star rating">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <li key={n} className="flex items-center gap-2 text-sm text-kumo-subtle">
                        <span className="w-12 shrink-0">
                          {n} {n === 1 ? "star" : "stars"}
                        </span>
                        <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-kumo-recessed">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(summary.counts[n - 1] / summary.total) * 100}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right text-kumo-default">{summary.counts[n - 1]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The form sits below the list on phones. */}
              <a
                href="#feedback-form"
                className="flex h-11 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base text-sm font-semibold text-primary hover:border-primary lg:hidden"
              >
                {myReview ? "Edit your review" : "Write a review"}
              </a>

              {myPendingReview && (
                <div className="rounded-2xl border border-kumo-line bg-kumo-warning-tint p-4">
                  <p className="text-sm font-semibold text-kumo-default">Your review is not shown yet. The mall office is checking it.</p>
                  {myPendingReview.comment && (
                    <p className="mt-1 whitespace-pre-line text-sm text-kumo-default wrap-anywhere">{myPendingReview.comment}</p>
                  )}
                </div>
              )}

              {isLoading && reviews.length === 0 ? (
                <div className="py-12 text-center" role="status" aria-label="Loading reviews">
                  <div className="inline-block size-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : loadFailed && reviews.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-4 py-8 text-center">
                  <p className="text-sm text-kumo-subtle">We couldn't load the reviews.</p>
                  <Button variant="secondary" onClick={() => loadReviews()}>
                    Try again
                  </Button>
                </div>
              ) : ordered.length > 0 ? (
                <>
                  <ul className="space-y-3">
                    {ordered.slice(0, shown).map((review) => {
                      const mine = Boolean(user && user.id === review.userId);
                      const text = review.comment?.trim();
                      return (
                        <li key={review.id} className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base p-4 sm:p-6">
                          <div className="flex items-start gap-3">
                            <div aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                              {review.user?.name ? review.user.name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-base font-semibold text-kumo-default">
                                {review.user?.name || "Anonymous"}
                                {mine && <span className="font-normal text-kumo-subtle"> (you)</span>}
                                {review.user?.role === "ADMIN" && <span className="font-normal text-kumo-subtle"> (mall staff)</span>}
                              </h3>
                              <div className="flex flex-wrap items-center gap-x-2">
                                <Stars value={review.rating} />
                                <span className="text-sm text-kumo-subtle">{formatDate(review.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          {text && (
                            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-kumo-default wrap-anywhere">{text}</p>
                          )}
                          {review.reply && (
                            <div className="mt-3 border-l-2 border-primary/40 pl-3">
                              <p className="text-sm font-semibold text-primary">Reply from the shop</p>
                              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-kumo-subtle wrap-anywhere">{review.reply}</p>
                            </div>
                          )}
                          {mine && (
                            <div className="mt-3 flex gap-4 border-t border-kumo-line pt-3">
                              <a
                                href="#feedback-form"
                                onClick={() => {
                                  setRating(review.rating);
                                  setComment(review.comment || "");
                                }}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                Edit
                              </a>
                              <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="cursor-pointer text-sm font-semibold text-kumo-danger hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {ordered.length > shown && (
                    <Button variant="secondary" size="lg" className="w-full justify-center" onClick={() => setShown((n) => n + PAGE * 2)}>
                      Show more reviews
                    </Button>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-4 py-8 text-center">
                  <MessageSquare size={24} aria-hidden className="mx-auto mb-2 text-kumo-subtle" />
                  <p className="text-sm text-kumo-subtle">No reviews yet. Be the first to share your experience.</p>
                </div>
              )}
            </div>

            {/* Right Column: Submit Form */}
            <div id="feedback-form" className="min-w-0 scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-kumo-line bg-kumo-base p-5 shadow-xl sm:p-6 lg:p-8">
                <h3 className="mb-5 font-display text-2xl font-semibold tracking-tight text-kumo-default">
                  {isAuthenticated ? formTitle : "Share your experience"}
                </h3>

                {!isAuthenticated ? (
                  <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-kumo-line bg-kumo-recessed p-6 text-center sm:p-10">
                    <LogIn size={28} aria-hidden className="mb-3 text-primary" />
                    <h4 className="text-lg font-semibold text-kumo-default">Sign in to leave a review</h4>
                    <p className="mb-5 mt-1 text-sm text-kumo-subtle">Tell us what you loved about your visit.</p>
                    <Button variant="primary" size="lg" className="w-full justify-center" onClick={() => setIsLoginModalOpen(true)}>
                      Sign in
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {isCommentingPaused && mutedUntil && (
                      <div className="flex items-start gap-2 rounded-xl bg-kumo-danger-tint p-3 text-kumo-danger">
                        <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
                        <p className="text-sm font-medium">
                          Commenting is paused until{" "}
                          {new Date(mutedUntil).toLocaleString("en-PH", {
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          .
                        </p>
                      </div>
                    )}

                    {submitMessage && (
                      <p
                        role={submitMessage.type === "error" ? "alert" : "status"}
                        className={cn(
                          "rounded-xl p-3 text-sm font-medium",
                          submitMessage.type === "success" ? "bg-kumo-success-tint text-kumo-success" : "bg-kumo-danger-tint text-kumo-danger",
                        )}
                      >
                        {submitMessage.message}
                      </p>
                    )}

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-kumo-default" id="rating-label">
                        Your rating
                      </p>
                      <div role="group" aria-labelledby="rating-label" className="flex flex-wrap items-center gap-x-1">
                        {RATING_WORDS.map((word, i) => (
                          <button
                            suppressHydrationWarning
                            type="button"
                            key={word}
                            onClick={() => setRating(i + 1)}
                            disabled={isSubmitting}
                            aria-label={`${i + 1} ${i === 0 ? "star" : "stars"}, ${word}`}
                            aria-pressed={rating === i + 1}
                            className="cursor-pointer rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary active:scale-95 disabled:opacity-50"
                          >
                            <Star aria-hidden className={cn("size-8 transition-colors", i < rating ? "fill-primary text-primary" : "text-kumo-subtle")} />
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-kumo-subtle" aria-live="polite">
                          {rating ? RATING_WORDS[rating - 1] : "Tap a star"}
                        </span>
                      </div>
                    </div>

                    <InputArea
                      ref={commentRef}
                      label="Your review (optional)"
                      value={comment}
                      onValueChange={setComment}
                      placeholder="What did you enjoy? What could be better?"
                      disabled={isSubmitting || isCommentingPaused}
                      rows={5}
                      className="w-full"
                    />

                    <DraftNote draft={draft} />

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full justify-center"
                      onClick={handleSubmit}
                      loading={isSubmitting}
                      disabled={isSubmitting || rating === 0 || isCommentingPaused}
                    >
                      {isCommentingPaused ? "Commenting paused" : myReview ? "Save changes" : "Share review"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {languageWarning && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-charcoal/80 p-4 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-warning-title"
          onClick={dismissLanguageWarning}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-kumo-base shadow-2xl animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div
                  className={clsx(
                    "flex h-14 w-14 items-center justify-center rounded-2xl",
                    languageWarning.muted
                      ? "bg-red-500/10 text-red-500"
                      : "bg-amber-500/10 text-amber-500",
                  )}
                >
                  <AlertTriangle size={26} />
                </div>
                <button
                  type="button"
                  onClick={dismissLanguageWarning}
                  aria-label="Close warning"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-kumo-recessed text-kumo-subtle transition-colors hover:bg-kumo-tint"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>

              <div className="space-y-2">
                <h3
                  id="language-warning-title"
                  className="text-xl font-semibold tracking-tight text-kumo-default"
                >
                  {languageWarning.muted
                    ? "Commenting paused"
                    : `Warning ${languageWarning.offense} of 2`}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-kumo-subtle">
                  {languageWarning.muted
                    ? `Your comment was not posted. Commenting is paused for 24 hours${
                        languageWarning.mutedUntil
                          ? `, until ${new Date(
                              languageWarning.mutedUntil,
                            ).toLocaleString("en-PH", {
                              month: "long",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : ""
                      }. Please keep future comments respectful.`
                    : languageWarning.message}
                </p>
              </div>

              {!languageWarning.muted && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs font-bold leading-relaxed text-amber-700 dark:text-amber-400">
                  Your comment was not posted. Revise it to continue. A third
                  inappropriate comment will pause commenting for 24 hours.
                </div>
              )}
            </div>

            <div className="border-t border-kumo-line bg-kumo-recessed p-5">
              <button
                type="button"
                onClick={dismissLanguageWarning}
                className="w-full rounded-2xl bg-primary px-4 py-3.5 text-xs font-semibold text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95"
              >
                {languageWarning.muted ? "I understand" : "Edit my comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal
        // Signing in brings the visitor back to these reviews.
        nextPath={`${pathname}#feedback`}
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
