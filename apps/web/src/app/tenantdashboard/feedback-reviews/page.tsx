"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, InputArea, Loader, Select, cn } from "@cloudflare/kumo";
import { ArrowClockwise, Flag, Star } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Stat, StatRow } from "@/components/admin/page-kit";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import {
  getTenantReviewsAction,
  replyToReviewAction,
  reportReviewAction,
  type TenantReviewSort,
  type TenantReviewsData,
} from "@/app/actions/review";

type ReviewItem = TenantReviewsData["reviews"][number];

const PAGE_SIZE = 10;
const REPLY_MAX = 1000;
const SORTS: { value: TenantReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Stars with partial fill, so 4.5 shows four and a half. */
function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} weight="fill" className="absolute inset-0 text-kumo-recessed" aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} weight="fill" className="text-amber-500" aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export default function FeedbackReviews() {
  const { user } = useAuth();
  const [data, setData] = useState<TenantReviewsData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [rating, setRating] = useState<number | null>(null);
  const [withComment, setWithComment] = useState(false);
  const [needsReply, setNeedsReply] = useState(false);
  const [sort, setSort] = useState<TenantReviewSort>("newest");

  const [reportTarget, setReportTarget] = useState<ReviewItem | null>(null);
  const requestId = useRef(0);

  const filters = { rating, withComment, needsReply, sort };
  const filterKey = JSON.stringify(filters);

  // Load the first page for the current filters (or refresh what's shown).
  const load = useCallback(
    async (keepCount = 0) => {
      if (!user?.id) return;
      const id = ++requestId.current;
      setLoading(true);
      try {
        const res = await getTenantReviewsAction(user.id, {
          ...JSON.parse(filterKey),
          offset: 0,
          limit: Math.max(PAGE_SIZE, keepCount),
        });
        if (id !== requestId.current) return; // a newer request won
        if (res.success) {
          setData(res.data);
          setReviews(res.data.reviews);
          setError(null);
        } else {
          setError(res.error);
        }
      } catch (err: any) {
        if (id === requestId.current) setError(err?.message || "Failed to load reviews");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [user?.id, filterKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!user?.id || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getTenantReviewsAction(user.id, {
        ...filters,
        offset: reviews.length,
        limit: PAGE_SIZE,
      });
      if (res.success) {
        setReviews((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...res.data.reviews.filter((r) => !seen.has(r.id))];
        });
        setData((prev) => (prev ? { ...prev, matching: res.data.matching } : res.data));
      } else {
        toast.error(res.error);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshKeepingPosition = () => load(reviews.length);

  const updateReview = (id: string, patch: Partial<ReviewItem>) =>
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const clearFilters = () => {
    setRating(null);
    setWithComment(false);
    setNeedsReply(false);
  };
  const hasFilters = rating !== null || withComment || needsReply;

  // ── states ─────────────────────────────────────────────────────────────────
  if (!data && error) {
    return (
      <AdminPage title="Feedback & Reviews">
        <Panel>
          <EmptyNote
            title="Couldn't load your reviews"
            action={
              <Button variant="primary" onClick={() => load()}>
                Try again
              </Button>
            }
          >
            {error}
          </EmptyNote>
        </Panel>
      </AdminPage>
    );
  }

  const stats = data?.stats;
  const trend =
    stats && stats.avg30 != null && stats.avgPrev30 != null
      ? Number((stats.avg30 - stats.avgPrev30).toFixed(1))
      : null;
  const replyRate =
    stats && stats.withComment > 0 ? Math.round((stats.replied / stats.withComment) * 100) : null;
  const needReplyCount = stats ? stats.withComment - stats.replied : 0;
  const hasMore = data ? reviews.length < data.matching : false;

  return (
    <AdminPage
      title="Feedback & Reviews"
      description={`What customers say about ${data?.shopName || "your shop"}. Your replies are public.`}
      actions={
        <Button variant="secondary" icon={<ArrowClockwise />} loading={loading} onClick={() => refreshKeepingPosition()}>
          Refresh
        </Button>
      }
    >
      <StatRow>
        <Stat
          label="Average rating"
          value={stats ? (stats.total ? stats.average.toFixed(1) : "No rating") : "..."}
          hint={
            trend == null
              ? "From published reviews"
              : `${trend >= 0 ? "Up" : "Down"} ${Math.abs(trend).toFixed(1)} from the 30 days before`
          }
        />
        <Stat
          label="Total reviews"
          value={stats ? stats.total : "..."}
          hint={stats?.awaitingApproval ? `${stats.awaitingApproval} waiting for the mall office` : "Published on your shop page"}
        />
        <Stat label="This month" value={stats ? stats.thisMonth : "..."} hint="New since the 1st" />
        <Stat
          label="Need a reply"
          value={stats ? needReplyCount : "..."}
          tone={needReplyCount > 0 ? "warning" : "default"}
          hint={replyRate == null ? "Reviews with a comment" : `You've replied to ${replyRate}%`}
          active={needsReply}
          onClick={() => setNeedsReply((v) => !v)}
        />
      </StatRow>

      <div className="grid items-start gap-6 lg:grid-cols-4">
        {/* Score + distribution */}
        <Panel title="Ratings" description={stats ? `${stats.total} published` : "Loading..."}>
          <div className="flex items-center gap-3">
            <p className="text-4xl font-semibold tabular-nums text-kumo-default">
              {stats ? (stats.total ? stats.average.toFixed(1) : "0.0") : "..."}
            </p>
            <StarRating value={stats?.average || 0} size={18} />
          </div>
          <div className="mt-4 space-y-1">
            {(stats?.distribution || [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, pct: 0 }))).map((row) => (
              <button
                key={row.stars}
                type="button"
                onClick={() => setRating(rating === row.stars ? null : row.stars)}
                disabled={!row.count && rating !== row.stars}
                aria-pressed={rating === row.stars}
                title={`Show ${row.stars}-star reviews`}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 disabled:cursor-default disabled:opacity-50",
                  rating === row.stars ? "bg-kumo-tint ring-1 ring-kumo-brand" : "enabled:hover:bg-kumo-tint",
                )}
              >
                <span className="w-12 text-left text-sm text-kumo-subtle">{row.stars} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-kumo-recessed">
                  <span className="block h-full rounded-full bg-amber-500" style={{ width: `${row.pct}%` }} />
                </span>
                <span className="w-8 text-right text-sm tabular-nums text-kumo-subtle">{row.count}</span>
              </button>
            ))}
          </div>
          {rating !== null && (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => setRating(null)}>
                Show all ratings
              </Button>
            </div>
          )}
        </Panel>

        {/* Review list */}
        <Panel className="lg:col-span-3" flush>
          <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-3 sm:px-5">
            <Button variant={withComment ? "primary" : "secondary"} aria-pressed={withComment} onClick={() => setWithComment((v) => !v)}>
              With comment
            </Button>
            <Button variant={needsReply ? "primary" : "secondary"} aria-pressed={needsReply} onClick={() => setNeedsReply((v) => !v)}>
              Needs reply
            </Button>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-kumo-subtle sm:inline">
                {data ? `${data.matching} review${data.matching === 1 ? "" : "s"}` : ""}
              </span>
              <Select
                aria-label="Sort reviews"
                value={sort}
                items={Object.fromEntries(SORTS.map((o) => [o.value, o.label]))}
                onValueChange={(v) => v != null && setSort(v as TenantReviewSort)}
                className="w-40"
              >
                {SORTS.map((o) => (
                  <Select.Option key={o.value} value={o.value}>
                    {o.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {loading && reviews.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : reviews.length === 0 ? (
            <EmptyNote title={hasFilters ? "No reviews match these filters" : "No reviews yet"}>
              {hasFilters ? "Try clearing a filter." : "Reviews appear here as soon as customers rate your shop."}
            </EmptyNote>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {reviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  userId={user?.id || ""}
                  onUpdated={(patch) => {
                    updateReview(review.id, patch);
                    void refreshKeepingPosition();
                  }}
                  onReport={() => setReportTarget(review)}
                />
              ))}
            </ul>
          )}

          {hasMore && (
            <div className="flex justify-center border-t border-kumo-line p-3">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                Load more ({data!.matching - reviews.length} left)
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {reportTarget && (
        <ReportModal
          review={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={async (reason) => {
            const res = await reportReviewAction(user?.id || "", reportTarget.id, reason);
            if (!res.success) return res.error || "Couldn't report the review.";
            updateReview(reportTarget.id, { reportedAt: new Date().toISOString(), reportReason: reason });
            toast.success("Sent to the mall admin for review");
            setReportTarget(null);
            return null;
          }}
        />
      )}
    </AdminPage>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function ReviewRow({
  review,
  userId,
  onUpdated,
  onReport,
}: {
  review: ReviewItem;
  userId: string;
  onUpdated: (patch: Partial<ReviewItem>) => void;
  onReport: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.reply || "");
  const [saving, setSaving] = useState(false);
  const hasComment = Boolean(review.comment?.trim());

  const save = async (text: string) => {
    setSaving(true);
    try {
      const res = await replyToReviewAction(userId, review.id, text);
      if (res.success) {
        onUpdated({ reply: res.reply ?? null, repliedAt: res.reply ? new Date().toISOString() : null });
        setEditing(false);
        toast.success(res.reply ? "Reply published on your shop page" : "Reply removed");
      } else {
        toast.error(res.error || "Couldn't save the reply");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex items-start gap-3 p-4 sm:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-recessed text-sm font-semibold text-kumo-default">
        {review.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.user.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          review.user.name.charAt(0).toUpperCase()
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-kumo-default">{review.user.name}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-kumo-subtle">
              <StarRating value={review.rating} size={14} />
              <span title={new Date(review.createdAt).toLocaleString()}>{timeAgo(review.createdAt)}</span>
            </p>
          </div>
          {!review.reportedAt && (
            <Button size="sm" variant="ghost" icon={<Flag />} aria-label="Report review" title="Report to the mall admin" onClick={onReport}>
              Report
            </Button>
          )}
        </div>

        {hasComment ? (
          <p className="wrap-anywhere whitespace-pre-line text-sm leading-relaxed text-kumo-default">{review.comment}</p>
        ) : (
          <p className="text-sm text-kumo-subtle">Rating only, no comment.</p>
        )}

        {review.reportedAt && (
          <p className="text-sm text-kumo-warning">
            Reported. Waiting for the mall admin. Your reason: &ldquo;{review.reportReason}&rdquo;
          </p>
        )}

        {/* Reply */}
        {editing ? (
          <div className="space-y-2">
            <InputArea
              aria-label="Your reply"
              value={draft}
              onValueChange={(v) => setDraft(v.slice(0, REPLY_MAX))}
              autoFocus
              rows={3}
              placeholder="Thank the customer or answer their feedback. Your reply is public."
              className="w-full"
            />
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-xs tabular-nums text-kumo-subtle">
                {draft.length}/{REPLY_MAX}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(review.reply || "");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={saving} disabled={saving || !draft.trim()} onClick={() => save(draft)}>
                {review.reply ? "Save reply" : "Post reply"}
              </Button>
            </div>
          </div>
        ) : review.reply ? (
          <div className="rounded-lg bg-kumo-recessed p-3">
            <p className="text-sm font-semibold text-kumo-default">
              Your reply
              {review.repliedAt && <span className="font-normal text-kumo-subtle">, {timeAgo(review.repliedAt)}</span>}
            </p>
            <p className="wrap-anywhere mt-1 whitespace-pre-line text-sm text-kumo-default">{review.reply}</p>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(review.reply || "");
                  setEditing(true);
                }}
              >
                Edit reply
              </Button>
              <Button size="sm" variant="secondary-destructive" loading={saving} onClick={() => save("")}>
                Remove reply
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Reply
          </Button>
        )}
      </div>
    </li>
  );
}

function ReportModal({
  review,
  onClose,
  onSubmit,
}: {
  review: ReviewItem;
  onClose: () => void;
  /** Returns an error message, or null on success. */
  onSubmit: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setError(await onSubmit(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminDialog
      open
      onClose={() => !busy && onClose()}
      title="Report this review?"
      description="The mall admin will check it. It stays visible until they decide."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1 rounded-lg bg-kumo-recessed p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-kumo-default">
            {review.user.name}
            <StarRating value={review.rating} size={14} />
          </p>
          <p className="line-clamp-3 text-sm text-kumo-default">{review.comment || "Rating only, no comment."}</p>
        </div>
        <InputArea
          label="Why should the admin check it?"
          value={reason}
          onValueChange={(v) => {
            setReason(v.slice(0, 500));
            if (error) setError(null);
          }}
          rows={3}
          autoFocus
          placeholder="e.g. Not a real customer, offensive language, meant for another shop"
          className="w-full"
        />
        {error && <p className="text-sm font-medium text-kumo-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={busy} disabled={busy}>
            Send report
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
