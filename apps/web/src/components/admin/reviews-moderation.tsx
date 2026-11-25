"use client";

import { spaCache } from "@/utils/cache";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, DropdownMenu, Loader, Select, cn } from "@cloudflare/kumo";
import { ArrowClockwise, CaretDown, Star } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, Panel, Person, SearchField, Stat, StatRow, PageTabs } from "@/components/admin/page-kit";
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
    commentStatus?: string | null;
    commentRestrictedUntil?: string | null;
    effectiveCommentStatus: UserStatus;
  } | null;
}

const PAGE_SIZE = 10;
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
  // Last loaded list (kept across tab switches) shows instantly; a fresh copy
  // loads quietly in the background.
  const cacheKey = `admin-reviews:${adminId ?? ""}`;
  const [reviews, setReviews] = useState<ReviewRow[] | null>(() => (adminId ? spaCache.get(cacheKey, 30 * 60 * 1000) : null));
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
          const rows = (res.data || []) as ReviewRow[];
          setReviews(rows);
          spaCache.set(cacheKey, rows);
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
    [adminId, cacheKey],
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
        <Panel flush>
          <EmptyNote
            title="Couldn't load reviews"
            action={
              <Button variant="primary" onClick={() => load(true)}>
                Try again
              </Button>
            }
          >
            {error}
          </EmptyNote>
        </Panel>
      );
    }
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  const shopItems: Record<string, string> = {
    all: "All shops",
    mall: "Mall reviews",
    ...Object.fromEntries(shops.map((s) => [s.id, s.name])),
  };
  const ratingItems: Record<string, string> = {
    all: "All ratings",
    ...Object.fromEntries([5, 4, 3, 2, 1].map((n) => [String(n), `${n} star${n === 1 ? "" : "s"}`])),
  };
  const filtering = !!search || shopFilter !== "all" || ratingFilter !== "all";

  return (
    <div className="space-y-6">
      <StatRow>
        <Stat label="Total reviews" value={stats.total} />
        <Stat label="Average rating" value={stats.avg ? stats.avg.toFixed(1) : "-"} hint={`${counts.published} published`} />
        <Stat
          label="Needs attention"
          value={counts.pending + counts.flagged}
          hint={`${counts.pending} to review, ${counts.flagged} flagged`}
          tone={counts.pending + counts.flagged > 0 ? "danger" : "default"}
        />
        <Stat label="Restricted reviewers" value={stats.restricted} hint="Muted or banned" />
      </StatRow>

      <PageTabs
        value={activeBucket}
        onValueChange={(v) => setBucket(v as Bucket)}
        tabs={[
          { value: "pending", label: `Needs review (${counts.pending})` },
          { value: "published", label: `Published (${counts.published})` },
          { value: "flagged", label: `Flagged & reported (${counts.flagged})` },
        ]}
      />

      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-4 sm:px-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search reviewer, comment or shop" className="sm:w-80" />
          <Select aria-label="Shop" value={shopFilter} items={shopItems} onValueChange={(v) => setShopFilter((v as string) || "all")} className="w-48">
            {Object.entries(shopItems).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
          <Select aria-label="Rating" value={ratingFilter} items={ratingItems} onValueChange={(v) => setRatingFilter((v as string) || "all")} className="w-36">
            {Object.entries(ratingItems).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
          <p className="ml-auto text-sm text-kumo-subtle">
            {filtered.length} review{filtered.length === 1 ? "" : "s"}
          </p>
          <Button variant="secondary" icon={<ArrowClockwise />} loading={refreshing} onClick={() => load(true)}>
            Refresh
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyNote
            title={
              filtering
                ? "No reviews match these filters"
                : activeBucket === "pending"
                  ? "Nothing waiting for review"
                  : activeBucket === "flagged"
                    ? "No reviews flagged as spam"
                    : "No published reviews yet"
            }
          />
        ) : (
          <ul className="divide-y divide-kumo-line">
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
          <div className="border-t border-kumo-line p-4 text-center">
            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Show more ({filtered.length - visible} left)
            </Button>
          </div>
        )}
      </Panel>

      <AdminDialog
        open={!!confirmDelete}
        onClose={() => busyId !== confirmDelete?.id && setConfirmDelete(null)}
        size="sm"
        title="Delete this review?"
        description={
          confirmDelete
            ? `It will be removed permanently from ${confirmDelete.tenant ? confirmDelete.tenant.shopName : "the mall page"}. This can't be undone.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" disabled={busyId === confirmDelete?.id} onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={!!confirmDelete && busyId === confirmDelete.id} onClick={doDelete}>
              Delete review
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <div className="space-y-2 rounded-lg bg-kumo-recessed p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-kumo-default">
                {confirmDelete.user?.name || confirmDelete.user?.email || "Deleted user"}
              </span>
              <Stars rating={confirmDelete.rating} />
            </div>
            <p className="line-clamp-3 text-sm text-kumo-default">{confirmDelete.comment || "Rating only, no comment."}</p>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} weight={i <= rating ? "fill" : "regular"} className={i <= rating ? "text-kumo-warning" : "text-kumo-subtle"} />
      ))}
    </span>
  );
}

/** Warnings, mute or ban on the reviewer, as plain coloured text. */
function UserStatusText({ user }: { user: NonNullable<ReviewRow["user"]> }) {
  const warnings = user.commentStatus === "WARNED_1" ? 1 : user.commentStatus === "WARNED_2" ? 2 : 0;
  if (warnings > 0) return <span className="text-sm font-medium text-kumo-warning">Warning {warnings}/2</span>;
  if (user.effectiveCommentStatus === "ACTIVE") return null;
  const banned = user.effectiveCommentStatus === "BANNED";
  return (
    <span className={cn("text-sm font-medium", banned ? "text-kumo-danger" : "text-kumo-warning")}>
      {banned ? "Banned" : user.commentRestrictedUntil ? `Muted until ${formatDate(user.commentRestrictedUntil)}` : "Muted"}
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
    <li className={cn("space-y-3 p-4 sm:p-5", busy && "pointer-events-none opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Person
          name={name}
          detail={`${r.tenant ? r.tenant.shopName : "Mall review"}, ${formatDate(r.createdAt)}${r.user?.email ? `, ${r.user.email}` : ""}`}
          image={r.user?.avatarUrl}
        />
        <div className="flex items-center gap-3">
          <Stars rating={r.rating} />
          {r.user && <UserStatusText user={r.user} />}
        </div>
      </div>

      {comment ? (
        <p className={cn("whitespace-pre-line text-sm leading-relaxed text-kumo-default wrap-anywhere", !expanded && "line-clamp-2")}>
          {comment}
        </p>
      ) : (
        <p className="text-sm text-kumo-subtle">Rating only, no comment.</p>
      )}
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="cursor-pointer text-sm text-kumo-link hover:underline">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {r.reportedAt && !r.isSpam && (
        <p className="rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
          <span className="font-semibold text-kumo-warning">Reported by the shop: </span>
          {r.reportReason || "No reason given"}
        </p>
      )}
      {r.reply && (
        <div className="border-l-2 border-kumo-line pl-3">
          <p className="text-xs font-semibold text-kumo-subtle">Shop reply</p>
          <p className="whitespace-pre-line text-sm text-kumo-default wrap-anywhere">{r.reply}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {bucket === "pending" && (
          <Button size="sm" variant="primary" onClick={onApprove}>
            Approve
          </Button>
        )}
        {bucket === "published" && (
          <Button size="sm" variant="secondary" onClick={onUnpublish}>
            Unpublish
          </Button>
        )}
        {bucket === "flagged" && r.reportedAt && !r.isSpam ? (
          <>
            <Button size="sm" variant="primary" onClick={onDismissReport}>
              Keep published
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onFlag(true)}>
              Flag as spam
            </Button>
          </>
        ) : bucket === "flagged" ? (
          <Button size="sm" variant="primary" onClick={() => onFlag(false)}>
            Not spam, publish
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onFlag(true)}>
            Flag as spam
          </Button>
        )}
        <Button size="sm" variant="secondary-destructive" onClick={onDelete}>
          Delete
        </Button>
        {r.user && <ModerateUserMenu user={r.user} onChange={onUserStatus} />}
        {busy && <Loader />}
      </div>
    </li>
  );
}

function ModerateUserMenu({
  user,
  onChange,
}: {
  user: NonNullable<ReviewRow["user"]>;
  onChange: (status: UserStatus, days?: number) => void;
}) {
  const warned = user.commentStatus === "WARNED_1" || user.commentStatus === "WARNED_2";
  return (
    <div className="ml-auto">
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button size="sm" variant="secondary" icon={<CaretDown />}>
              Moderate user
            </Button>
          }
        />
        <DropdownMenu.Content>
          {MUTE_OPTIONS.map((o) => (
            <DropdownMenu.Item key={o.days} onClick={() => onChange("MUTED", o.days)}>
              Mute for {o.label}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator />
          {warned && <DropdownMenu.Item onClick={() => onChange("ACTIVE")}>Clear language warnings</DropdownMenu.Item>}
          {user.effectiveCommentStatus !== "BANNED" && (
            <DropdownMenu.Item variant="danger" onClick={() => onChange("BANNED")}>
              Ban permanently
            </DropdownMenu.Item>
          )}
          {user.effectiveCommentStatus !== "ACTIVE" && (
            <DropdownMenu.Item onClick={() => onChange("ACTIVE")}>Restore posting</DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
