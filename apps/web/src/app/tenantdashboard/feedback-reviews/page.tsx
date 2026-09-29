"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CornerDownRight,
  Flag,
  Loader2,
  MessageSquare,
  MessageSquareReply,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
const LABEL = "text-[10px] font-bold text-slate-400 uppercase tracking-widest";
const CARD = "bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[2rem] shadow-sm";

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
function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 fill-slate-200 text-slate-200 dark:fill-zinc-700 dark:text-zinc-700" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="fill-amber-500 text-amber-500" />
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
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
        <div className={clsx(CARD, "p-10 max-w-md text-center space-y-4")}>
          <AlertTriangle className="mx-auto text-primary" size={28} />
          <p className="font-bold text-charcoal dark:text-white">Couldn&apos;t load your reviews</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => load()}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest"
          >
            Try again
          </button>
        </div>
      </div>
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
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-20 lg:pb-0">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest mb-1">Reputation</p>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-charcoal dark:text-white tracking-tight">
              Feedback & Reviews
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              What customers say about {data?.shopName || "your shop"}. Reply to build trust.
            </p>
          </div>
          <button
            onClick={() => refreshKeepingPosition()}
            disabled={loading}
            aria-label="Refresh reviews"
            className="self-start sm:self-auto p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            label="Average rating"
            value={stats ? (stats.total ? stats.average.toFixed(1) : "—") : "…"}
            icon={<Star size={16} className="fill-current" />}
            tone="bg-amber-500/10 text-amber-600"
            sub={
              trend == null ? (
                "Last 30 days vs before"
              ) : (
                <span className={clsx("inline-flex items-center gap-0.5 font-bold", trend >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(trend).toFixed(1)} vs previous 30 days
                </span>
              )
            }
          />
          <SummaryCard
            label="Total reviews"
            value={stats ? String(stats.total) : "…"}
            icon={<MessageSquare size={16} />}
            tone="bg-primary/10 text-primary"
            sub={stats?.awaitingApproval ? `${stats.awaitingApproval} awaiting admin approval` : "Published on your shop page"}
          />
          <SummaryCard
            label="This month"
            value={stats ? String(stats.thisMonth) : "…"}
            icon={<CalendarDays size={16} />}
            tone="bg-blue-500/10 text-blue-600"
            sub="New reviews since the 1st"
          />
          <SummaryCard
            label="Reply rate"
            value={replyRate == null ? "—" : `${replyRate}%`}
            icon={<MessageSquareReply size={16} />}
            tone={needReplyCount > 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"}
            sub={
              needReplyCount > 0 ? (
                <button onClick={() => setNeedsReply(true)} className="font-bold text-primary hover:underline">
                  {needReplyCount} need a reply →
                </button>
              ) : (
                "Of reviews with a comment"
              )
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {/* Score + distribution */}
          <div className="space-y-4 sm:space-y-6">
            <div className={clsx(CARD, "p-4 sm:p-6 text-center")}>
              <h2 className={clsx(LABEL, "mb-3 sm:mb-4")}>Overall score</h2>
              <p className="text-4xl lg:text-5xl font-black text-charcoal dark:text-white mb-2">
                {stats ? (stats.total ? stats.average.toFixed(1) : "—") : "…"}
              </p>
              <div className="flex justify-center mb-2">
                <StarRating value={stats?.average || 0} size={18} />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {stats ? `Based on ${stats.total} published review${stats.total === 1 ? "" : "s"}` : "Loading…"}
              </p>
            </div>

            <div className={clsx(CARD, "p-4 sm:p-6")}>
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className={LABEL}>Rating breakdown</h2>
                {rating !== null && (
                  <button onClick={() => setRating(null)} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                    Show all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {(stats?.distribution || [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, pct: 0 }))).map((row) => (
                  <button
                    key={row.stars}
                    onClick={() => setRating(rating === row.stars ? null : row.stars)}
                    disabled={!row.count && rating !== row.stars}
                    aria-pressed={rating === row.stars}
                    title={`Show ${row.stars}-star reviews`}
                    className={clsx(
                      "w-full flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-default",
                      rating === row.stars ? "bg-amber-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5",
                    )}
                  >
                    <span className="w-7 text-xs font-bold text-slate-500 flex items-center justify-end gap-1">
                      {row.stars} <Star size={10} className="fill-slate-400 text-slate-400" />
                    </span>
                    <span className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <span className="block h-full bg-amber-500 rounded-full" style={{ width: `${row.pct}%` }} />
                    </span>
                    <span className="w-16 text-[10px] font-bold text-slate-400 text-right tabular-nums">
                      {row.count} · {row.pct}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Review feed */}
          <div className="lg:col-span-3">
            <div className={clsx(CARD, "overflow-hidden flex flex-col")}>
              {/* Toolbar */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2">
                <ToggleChip active={withComment} onClick={() => setWithComment((v) => !v)}>
                  With comment
                </ToggleChip>
                <ToggleChip active={needsReply} onClick={() => setNeedsReply((v) => !v)}>
                  Needs reply
                </ToggleChip>
                {rating !== null && (
                  <ToggleChip active onClick={() => setRating(null)}>
                    {rating} ★ <X size={12} />
                  </ToggleChip>
                )}
                {hasFilters && (
                  <button onClick={clearFilters} className="px-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                    Clear
                  </button>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className={clsx(LABEL, "hidden sm:inline")}>
                    {data ? `${data.matching} review${data.matching === 1 ? "" : "s"}` : ""}
                  </span>
                  <label className="relative flex items-center gap-2 h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 cursor-pointer">
                    <span className={LABEL}>Sort</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as TenantReviewSort)}
                      aria-label="Sort reviews"
                      className="appearance-none bg-transparent text-xs font-bold text-charcoal dark:text-white focus:outline-none cursor-pointer"
                    >
                      {SORTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                  </label>
                </div>
              </div>

              {/* List */}
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {loading && reviews.length === 0 ? (
                  <div className="p-16 flex justify-center">
                    <Loader2 className="animate-spin text-primary" size={28} />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="p-16 sm:p-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-5">
                      <MessageSquare size={28} className="text-slate-300" />
                    </div>
                    <h3 className="text-base font-bold text-charcoal dark:text-white mb-1">
                      {hasFilters ? "No reviews match these filters" : "No reviews yet"}
                    </h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                      {hasFilters
                        ? "Try clearing a filter."
                        : "Reviews appear here as soon as customers rate your shop."}
                    </p>
                  </div>
                ) : (
                  reviews.map((review) => (
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
                  ))
                )}
              </div>

              {hasMore && (
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                    Load more ({data!.matching - reviews.length} left)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className={clsx(CARD, "p-4 sm:p-5 min-w-0")}>
      <div className="flex items-center justify-between gap-2">
        <p className={clsx(LABEL, "truncate")}>{label}</p>
        <span className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tone)}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-black text-charcoal dark:text-white">{value}</p>
      {sub && <div className="mt-1 text-[11px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors",
        active
          ? "bg-primary text-white border-primary"
          : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

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
    <div className="p-4 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center text-slate-500 font-bold shrink-0">
          {review.user.avatarUrl ? (
            <img src={review.user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            review.user.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm text-charcoal dark:text-white truncate">{review.user.name}</p>
              <p className="text-[11px] text-slate-400" title={new Date(review.createdAt).toLocaleString()}>
                {timeAgo(review.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={review.rating} size={14} />
              {review.reportedAt ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold uppercase tracking-widest">
                  <Flag size={10} /> Reported
                </span>
              ) : (
                <button
                  onClick={onReport}
                  title="Report to the mall admin"
                  aria-label="Report review"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <Flag size={14} />
                </button>
              )}
            </div>
          </div>

          {hasComment ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
              {review.comment}
            </p>
          ) : (
            <p className="text-sm italic text-slate-400">Rating only, no comment.</p>
          )}

          {review.reportedAt && (
            <p className="text-[11px] text-amber-600">
              Waiting for the mall admin. Your reason: &ldquo;{review.reportReason}&rdquo;
            </p>
          )}

          {/* Reply */}
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, REPLY_MAX))}
                autoFocus
                rows={3}
                placeholder="Thank the customer or answer their feedback. Your reply is public."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-sm text-charcoal dark:text-white focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {draft.length}/{REPLY_MAX}
                </span>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(review.reply || "");
                  }}
                  disabled={saving}
                  className="ml-auto h-9 px-4 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => save(draft)}
                  disabled={saving || !draft.trim()}
                  className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {review.reply ? "Save reply" : "Post reply"}
                </button>
              </div>
            </div>
          ) : review.reply ? (
            <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <CornerDownRight size={12} /> Your reply
                  {review.repliedAt && <span className="normal-case tracking-normal font-medium text-slate-400">· {timeAgo(review.repliedAt)}</span>}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setDraft(review.reply || "");
                      setEditing(true);
                    }}
                    aria-label="Edit reply"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-charcoal dark:hover:text-white hover:bg-white dark:hover:bg-white/10"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => save("")}
                    disabled={saving}
                    aria-label="Remove reply"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/10"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line [overflow-wrap:anywhere]">
                {review.reply}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <MessageSquareReply size={14} /> Reply
            </button>
          )}
        </div>
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl p-7 space-y-5 animate-fade-in-up"
      >
        <div className="space-y-1.5">
          <h2 id="report-title" className="text-lg font-black text-charcoal dark:text-white">
            Report this review?
          </h2>
          <p className="text-sm text-slate-500">
            The mall admin will check it. It stays visible until they decide.
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-charcoal dark:text-white">{review.user.name}</span>
            <StarRating value={review.rating} size={12} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
            {review.comment || "Rating only, no comment."}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="report-reason" className={LABEL}>
            Why should the admin check it?
          </label>
          <textarea
            id="report-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 500));
              if (error) setError(null);
            }}
            rows={3}
            autoFocus
            placeholder="e.g. Not a real customer, offensive language, meant for another shop…"
            className={clsx(
              "w-full p-3 rounded-xl border bg-slate-50 dark:bg-zinc-900 text-sm text-charcoal dark:text-white focus:outline-none resize-none",
              error ? "border-red-500" : "border-slate-200 dark:border-white/10 focus:border-primary",
            )}
          />
          {error && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
            Send report
          </button>
        </div>
      </form>
    </div>
  );
}
