"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  Flag,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  UserX,
  VolumeX,
  X,
} from "lucide-react";
import {
  approveReviewAction,
  deleteReviewAction,
  dismissReviewReportAction,
  getAllReviewsAction,
  markReviewSpamAction,
  setCommentStatusAction,
  unpublishReviewAction,
} from "@/app/actions/review";

// ─── Types & helpers ─────────────────────────────────────────────────────────

type Bucket = "pending" | "published" | "flagged";
type UserStatus = "ACTIVE" | "MUTED" | "BANNED";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  isSpam: boolean;
  createdAt: string;
  reply?: string | null;
  reportedAt?: string | null;
  reportReason?: string | null;
  tenant: { id: string; shopName: string } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    commentRestrictedUntil?: string | null;
    effectiveCommentStatus: UserStatus;
  } | null;
}

const PAGE_SIZE = 10;
const LABEL = "text-[10px] font-black uppercase tracking-widest text-slate-400";
const MUTE_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
];

function bucketOf(r: ReviewRow): Bucket {
  // Spam, or reported by the shop and waiting for an admin decision.
  if (r.isSpam || r.reportedAt) return "flagged";
  return r.isApproved ? "published" : "pending";
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ─── Component ───────────────────────────────────────────────────────────────

export function ReviewsModeration({
  adminId,
  onAttentionCount,
}: {
  adminId?: string;
  /** Reviews waiting on the admin (needs review + flagged) — for the tab badge. */
  onAttentionCount?: (count: number) => void;
}) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [search, setSearch] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReviewRow | null>(null);

  const load = useCallback(
    async (manual = false) => {
      if (!adminId) return;
      if (manual) setRefreshing(true);
      try {
        const res = await getAllReviewsAction(adminId);
        if (res.success) {
          setReviews((res.data || []) as ReviewRow[]);
          setError(null);
        } else {
          setError(res.error || "Failed to load reviews");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load reviews");
      } finally {
        setRefreshing(false);
      }
    },
    [adminId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, published: 0, flagged: 0 };
    reviews?.forEach((r) => c[bucketOf(r)]++);
    return c;
  }, [reviews]);

  useEffect(() => {
    if (reviews) onAttentionCount?.(counts.pending + counts.flagged);
  }, [reviews, counts, onAttentionCount]);

  // Open on the queue that needs work first.
  const activeBucket: Bucket =
    bucket ?? (counts.pending > 0 ? "pending" : counts.flagged > 0 ? "flagged" : "published");

  const stats = useMemo(() => {
    const published = reviews?.filter((r) => bucketOf(r) === "published") ?? [];
    const avg = published.length
      ? published.reduce((sum, r) => sum + (r.rating || 0), 0) / published.length
      : 0;
    const restricted = new Set(
      (reviews ?? [])
        .filter((r) => r.user && r.user.effectiveCommentStatus !== "ACTIVE")
        .map((r) => r.user!.id),
    ).size;
    return { total: reviews?.length ?? 0, avg, restricted };
  }, [reviews]);

  const shops = useMemo(() => {
    const map = new Map<string, string>();
    reviews?.forEach((r) => r.tenant && map.set(r.tenant.id, r.tenant.shopName));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reviews ?? []).filter((r) => {
      if (bucketOf(r) !== activeBucket) return false;
      if (shopFilter === "mall" && r.tenant) return false;
      if (shopFilter !== "all" && shopFilter !== "mall" && r.tenant?.id !== shopFilter) return false;
      if (ratingFilter !== "all" && r.rating !== Number(ratingFilter)) return false;
      if (!q) return true;
      return [r.user?.name, r.user?.email, r.comment, r.tenant?.shopName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [reviews, activeBucket, shopFilter, ratingFilter, search]);

  useEffect(() => setVisible(PAGE_SIZE), [activeBucket, shopFilter, ratingFilter, search]);

  // ── actions ────────────────────────────────────────────────────────────────
  const run = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusyId(id);
    try {
      const res = await fn();
      if (res.success) {
        toast.success(ok);
        await load();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const approve = (r: ReviewRow) => run(r.id, () => approveReviewAction(r.id), "Review published");
  const unpublish = (r: ReviewRow) => run(r.id, () => unpublishReviewAction(r.id), "Review moved to Needs review");
  const dismissReport = (r: ReviewRow) =>
    run(r.id, () => dismissReviewReportAction(adminId || "", r.id), "Report dismissed, review stays published");
  const flag = (r: ReviewRow, isSpam: boolean) =>
    run(r.id, () => markReviewSpamAction(r.id, isSpam), isSpam ? "Review flagged as spam" : "Review published");
  const setUserStatus = (r: ReviewRow, status: UserStatus, days?: number) =>
    r.user &&
    run(
      r.id,
      () => setCommentStatusAction(r.user!.id, status, days),
      status === "ACTIVE"
        ? "User can post reviews again"
        : status === "BANNED"
          ? "User banned from posting reviews"
          : `User muted for ${days} day${days === 1 ? "" : "s"}`,
    );
  const doDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete;
    await run(r.id, () => deleteReviewAction(r.id), "Review deleted");
    setConfirmDelete(null);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  if (!reviews) {
    if (error) {
      return (
        <div className="p-16 text-center space-y-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem]">
          <AlertTriangle className="mx-auto text-primary" size={28} />
          <p className="font-black text-charcoal dark:text-white uppercase tracking-tight italic">
            Couldn&apos;t load reviews
          </p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => load(true)}
            className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/25"
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="p-24 flex justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const tabs: { id: Bucket; label: string; icon: React.ReactNode; tone: string }[] = [
    { id: "pending", label: "Needs review", icon: <Inbox size={16} />, tone: "bg-amber-500 text-white" },
    { id: "published", label: "Published", icon: <CheckCircle2 size={16} />, tone: "bg-emerald-500 text-white" },
    { id: "flagged", label: "Flagged & reported", icon: <Flag size={16} />, tone: "bg-red-500 text-white" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total reviews" value={stats.total.toString()} icon={<MessageSquare size={18} />} tone="bg-primary/10 text-primary" />
        <SummaryCard
          label="Average rating"
          value={stats.avg ? stats.avg.toFixed(1) : "—"}
          sub={`${counts.published} published`}
          icon={<Star size={18} />}
          tone="bg-amber-500/10 text-amber-600"
        />
        <SummaryCard
          label="Needs attention"
          value={(counts.pending + counts.flagged).toString()}
          sub={`${counts.pending} to review · ${counts.flagged} flagged`}
          icon={<AlertTriangle size={18} />}
          tone={counts.pending + counts.flagged > 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"}
        />
        <SummaryCard
          label="Restricted reviewers"
          value={stats.restricted.toString()}
          sub="Muted or banned"
          icon={<UserX size={18} />}
          tone="bg-slate-500/10 text-slate-600 dark:text-slate-300"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-sm overflow-hidden">
        {/* Tabs + refresh */}
        <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex gap-1 p-1.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 w-fit max-w-full overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setBucket(t.id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all active:scale-95",
                  activeBucket === t.id
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-slate-400 hover:text-charcoal dark:hover:text-white",
                )}
              >
                {t.icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                <span
                  className={clsx(
                    "min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-[10px] font-black text-center",
                    activeBucket === t.id
                      ? "bg-white text-primary"
                      : counts[t.id] > 0 && t.id !== "published"
                        ? t.tone
                        : "bg-slate-200 dark:bg-white/10 text-slate-500",
                  )}
                >
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh reviews"
            className="self-end lg:self-auto p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 md:px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02]">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviewer, comment or shop…"
              aria-label="Search reviews"
              className="w-full h-10 pl-10 pr-9 bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-medium text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-charcoal dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Select
            label="Shop"
            value={shopFilter}
            onChange={setShopFilter}
            options={[
              { value: "all", label: "All" },
              { value: "mall", label: "Mall reviews" },
              ...shops.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            label="Rating"
            value={ratingFilter}
            onChange={setRatingFilter}
            options={[
              { value: "all", label: "All" },
              ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` })),
            ]}
          />
          <p className={clsx(LABEL, "ml-auto")}>
            <span className="text-charcoal dark:text-white">{filtered.length}</span> review{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center text-slate-300 dark:text-slate-600">
            {activeBucket === "published" ? <MessageSquare size={28} /> : <ShieldCheck size={28} />}
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              {search || shopFilter !== "all" || ratingFilter !== "all"
                ? "No reviews match these filters"
                : activeBucket === "pending"
                  ? "Nothing waiting for review"
                  : activeBucket === "flagged"
                    ? "No reviews flagged as spam"
                    : "No published reviews yet"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.slice(0, visible).map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                bucket={activeBucket}
                busy={busyId === r.id}
                onApprove={() => approve(r)}
                onUnpublish={() => unpublish(r)}
                onFlag={(v) => flag(r, v)}
                onDismissReport={() => dismissReport(r)}
                onDelete={() => setConfirmDelete(r)}
                onUserStatus={(status, days) => setUserStatus(r, status, days)}
              />
            ))}
          </ul>
        )}

        {filtered.length > visible && (
          <div className="p-4 border-t border-slate-100 dark:border-white/5 text-center">
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Show more ({filtered.length - visible} left)
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <DeleteReviewModal
          review={confirmDelete}
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
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
  sub?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 shadow-sm min-w-0">
      <span className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", tone)}>{icon}</span>
      <p className={clsx(LABEL, "mt-4 truncate")}>{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tighter text-charcoal dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const active = value !== "all";
  return (
    <label
      className={clsx(
        "relative flex items-center gap-2 h-10 pl-3.5 pr-9 rounded-xl border cursor-pointer max-w-[260px]",
        active ? "bg-primary/5 border-primary/30" : "bg-white dark:bg-zinc-950/50 border-slate-200 dark:border-white/5",
      )}
    >
      <span className={LABEL}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={clsx(
          "appearance-none bg-transparent text-sm font-bold focus:outline-none cursor-pointer truncate",
          active ? "text-primary" : "text-charcoal dark:text-white",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
    </label>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= rating ? "fill-amber-500 text-amber-500" : "text-slate-200 dark:text-zinc-700"}
        />
      ))}
    </span>
  );
}

function UserStatusBadge({ user }: { user: NonNullable<ReviewRow["user"]> }) {
  if (user.effectiveCommentStatus === "ACTIVE") return null;
  const banned = user.effectiveCommentStatus === "BANNED";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap",
        banned
          ? "bg-red-500/10 text-red-600 border-red-500/20"
          : "bg-amber-500/10 text-amber-600 border-amber-500/20",
      )}
    >
      {banned ? <Ban size={10} /> : <VolumeX size={10} />}
      {banned
        ? "Banned"
        : user.commentRestrictedUntil
          ? `Muted until ${formatDate(user.commentRestrictedUntil)}`
          : "Muted"}
    </span>
  );
}

function ReviewItem({
  review: r,
  bucket,
  busy,
  onApprove,
  onUnpublish,
  onFlag,
  onDismissReport,
  onDelete,
  onUserStatus,
}: {
  review: ReviewRow;
  bucket: Bucket;
  busy: boolean;
  onApprove: () => void;
  onUnpublish: () => void;
  onFlag: (isSpam: boolean) => void;
  onDismissReport: () => void;
  onDelete: () => void;
  onUserStatus: (status: UserStatus, days?: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const comment = r.comment?.trim() || "";
  const long = comment.length > 180;
  const name = r.user?.name || r.user?.email?.split("@")[0] || "Deleted user";

  return (
    <li className={clsx("p-5 md:p-6 transition-colors", busy && "opacity-60 pointer-events-none")}>
      <div className="flex gap-4">
        <div className="w-11 h-11 shrink-0 rounded-[0.9rem] bg-primary/10 overflow-hidden flex items-center justify-center font-black italic text-primary">
          {r.user?.avatarUrl ? (
            <img src={r.user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Who · where · when */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-black text-sm text-charcoal dark:text-white uppercase tracking-tight italic truncate max-w-[240px]">
              {name}
            </p>
            <Stars rating={r.rating} />
            {r.user && <UserStatusBadge user={r.user} />}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300">
              <Store size={11} /> {r.tenant ? r.tenant.shopName : "Mall review"}
            </span>
            <span>·</span>
            <span>{formatDate(r.createdAt)}</span>
            {r.user?.email && (
              <>
                <span>·</span>
                <span className="normal-case tracking-normal font-medium truncate max-w-[220px]">{r.user.email}</span>
              </>
            )}
          </p>

          {/* Comment */}
          {comment ? (
            <p
              className={clsx(
                "text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]",
                !expanded && "line-clamp-2",
              )}
            >
              {comment}
            </p>
          ) : (
            <p className="text-sm italic text-slate-400">Rating only, no comment.</p>
          )}
          {long && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}

          {r.reportedAt && !r.isSpam && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
              <Flag size={14} className="shrink-0 mt-0.5" />
              <p className="text-xs">
                <span className="font-black uppercase tracking-widest text-[10px]">Reported by the shop · </span>
                {r.reportReason || "No reason given"}
              </p>
            </div>
          )}
          {r.reply && (
            <div className="pl-3 border-l-2 border-primary/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Shop reply</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line [overflow-wrap:anywhere]">
                {r.reply}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {bucket === "pending" && (
              <ActionButton tone="success" icon={<CheckCircle2 size={14} />} onClick={onApprove}>
                Approve
              </ActionButton>
            )}
            {bucket === "published" && (
              <ActionButton tone="neutral" icon={<EyeOff size={14} />} onClick={onUnpublish}>
                Unpublish
              </ActionButton>
            )}
            {bucket === "flagged" && r.reportedAt && !r.isSpam ? (
              <>
                <ActionButton tone="success" icon={<ShieldCheck size={14} />} onClick={onDismissReport}>
                  Keep published
                </ActionButton>
                <ActionButton tone="warning" icon={<Flag size={14} />} onClick={() => onFlag(true)}>
                  Flag as spam
                </ActionButton>
              </>
            ) : bucket === "flagged" ? (
              <ActionButton tone="success" icon={<ShieldCheck size={14} />} onClick={() => onFlag(false)}>
                Not spam · publish
              </ActionButton>
            ) : (
              <ActionButton tone="warning" icon={<Flag size={14} />} onClick={() => onFlag(true)}>
                Flag as spam
              </ActionButton>
            )}
            <ActionButton tone="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
              Delete
            </ActionButton>
            {r.user && <ModerateUserMenu user={r.user} onChange={onUserStatus} />}
            {busy && <Loader2 size={14} className="animate-spin text-primary" />}
          </div>
        </div>
      </div>
    </li>
  );
}

function ActionButton({
  tone,
  icon,
  onClick,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
        tone === "success" && "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20",
        tone === "warning" && "bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white",
        tone === "danger" && "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white",
        tone === "neutral" && "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ModerateUserMenu({
  user,
  onChange,
}: {
  user: NonNullable<ReviewRow["user"]>;
  onChange: (status: UserStatus, days?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (status: UserStatus, days?: number) => {
    setOpen(false);
    onChange(status, days);
  };

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-charcoal dark:hover:text-white hover:border-slate-300 transition-colors"
      >
        <UserX size={14} /> Moderate user
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full mb-2 w-60 bg-white dark:bg-[#161b26] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-40 animate-fade-in-up"
        >
          <p className={clsx(LABEL, "px-3 pt-2 pb-1")}>Mute from posting</p>
          <div className="grid grid-cols-2 gap-1 px-1 pb-2">
            {MUTE_OPTIONS.map((o) => (
              <button
                key={o.days}
                role="menuitem"
                onClick={() => pick("MUTED", o.days)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-600"
              >
                <VolumeX size={12} /> {o.label}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 dark:border-white/5 pt-1">
            {user.effectiveCommentStatus !== "BANNED" && (
              <button
                role="menuitem"
                onClick={() => pick("BANNED")}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-500/10"
              >
                <Ban size={14} /> Ban permanently
              </button>
            )}
            {user.effectiveCommentStatus !== "ACTIVE" && (
              <button
                role="menuitem"
                onClick={() => pick("ACTIVE")}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-500/10"
              >
                <ShieldCheck size={14} /> Restore posting
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteReviewModal({
  review,
  busy,
  onCancel,
  onConfirm,
}: {
  review: ReviewRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-review-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className="p-8 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
            <Trash2 size={22} />
          </div>
          <div className="space-y-1">
            <h2 id="delete-review-title" className="text-xl font-black uppercase tracking-tight italic text-charcoal dark:text-white">
              Delete this review?
            </h2>
            <p className="text-sm text-slate-500">
              It will be removed permanently from{" "}
              <span className="font-bold">{review.tenant ? review.tenant.shopName : "the mall page"}</span>. This can&apos;t be undone.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-charcoal dark:text-white">
                {review.user?.name || review.user?.email || "Deleted user"}
              </span>
              <Stars rating={review.rating} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
              {review.comment || "Rating only, no comment."}
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-3.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
