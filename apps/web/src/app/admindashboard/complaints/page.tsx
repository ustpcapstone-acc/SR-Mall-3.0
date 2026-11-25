"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Loader, Select, cn } from "@cloudflare/kumo";
import { ArrowClockwise } from "@phosphor-icons/react";
import { AdminPage, EmptyNote, Panel, SearchField, Stat, StatRow } from "@/components/admin/page-kit";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { getAdminComplaintsAction, getComplaintAction } from "@/app/actions/complaint";
import { announceComplaintsChanged } from "@/lib/complaint-unread";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  PRIORITY_META,
  STATUS_META,
  type ComplaintDetail,
  type ComplaintSummary,
} from "@/lib/complaints";
import { CARD, ComplaintView, PriorityBadge, StatusBadge, formatWhen } from "@/components/complaints/complaint-view";

type Stats = { new: number; inProgress: number; urgentOpen: number; resolvedThisMonth: number };

function AdminComplaints() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("id");

  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [stats, setStats] = useState<Stats>({ new: 0, inProgress: 0, urgentOpen: 0, resolvedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [status, setStatus] = useState<string>("OPEN");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [query, setQuery] = useState("");

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const loadList = useCallback(async () => {
    if (!user?.id) return;
    const res = await getAdminComplaintsAction(user.id);
    if (res.success) {
      setComplaints(res.complaints);
      setStats(res.stats);
    } else toast.error(res.error);
    setLoading(false);
  }, [user?.id]);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !selectedId) return setDetail(null);
    const res = await getComplaintAction(user.id, selectedId);
    if (res.success) {
      setDetail(res.complaint);
      setComplaints((all) => all.map((c) => (c.id === selectedId ? { ...c, unread: false } : c)));
      announceComplaintsChanged();
    } else {
      toast.error(res.error);
      setDetail(null);
    }
  }, [user?.id, selectedId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setDetailLoading(true);
    loadDetail().finally(() => setDetailLoading(false));
  }, [loadDetail]);

  const refreshAll = async () => {
    await Promise.all([loadList(), loadDetail()]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints.filter((c) => {
      if (status === "OPEN" && !(c.status === "NEW" || c.status === "IN_PROGRESS")) return false;
      if (status !== "OPEN" && status !== "ALL" && c.status !== status) return false;
      if (category && c.category !== category) return false;
      if (priority && c.priority !== priority) return false;
      if (q && ![c.subject, c.shopName, c.unitId, c.ownerName || ""].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [complaints, status, category, priority, query]);

  const statusItems: Record<string, string> = {
    OPEN: "Open (new and in progress)",
    ALL: "All statuses",
    ...Object.fromEntries(COMPLAINT_STATUSES.map((s) => [s, STATUS_META[s].label])),
  };
  const categoryItems: Record<string, string> = {
    any: "All categories",
    ...Object.fromEntries(COMPLAINT_CATEGORIES.map((c) => [c, c])),
  };
  const priorityItems: Record<string, string> = {
    any: "All priorities",
    ...Object.fromEntries(COMPLAINT_PRIORITIES.map((p) => [p, PRIORITY_META[p].label])),
  };
  const filtering = !!query || status !== "OPEN" || !!category || !!priority;

  if (!user?.id) return null;

  return (
    <AdminPage
      title="Tenant Complaints"
      description="Reply to tenants, track each issue and close it out in one thread."
      actions={
        <Button variant="secondary" icon={<ArrowClockwise />} onClick={refreshAll}>
          Refresh
        </Button>
      }
    >
      <StatRow>
        <Stat label="New" value={stats.new} onClick={() => setStatus("NEW")} active={status === "NEW"} />
        <Stat label="In progress" value={stats.inProgress} onClick={() => setStatus("IN_PROGRESS")} active={status === "IN_PROGRESS"} />
        <Stat
          label="Urgent (open)"
          value={stats.urgentOpen}
          tone={stats.urgentOpen ? "danger" : "default"}
          active={priority === "URGENT"}
          onClick={() => {
            setStatus("OPEN");
            setPriority("URGENT");
          }}
        />
        <Stat
          label="Resolved this month"
          value={stats.resolvedThisMonth}
          tone="success"
          onClick={() => setStatus("RESOLVED")}
          active={status === "RESOLVED"}
        />
      </StatRow>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={query} onChange={setQuery} placeholder="Search subject, shop, unit or owner" className="sm:w-80" />
        <Choice label="Status" value={status} items={statusItems} onChange={setStatus} className="w-60" />
        <Choice label="Category" value={category || "any"} items={categoryItems} onChange={(v) => setCategory(v === "any" ? "" : v)} className="w-48" />
        <Choice label="Priority" value={priority || "any"} items={priorityItems} onChange={(v) => setPriority(v === "any" ? "" : v)} className="w-40" />
        {filtering && (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setStatus("OPEN");
              setCategory("");
              setPriority("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* List */}
        <Panel
          flush
          className={cn("lg:col-span-5", selectedId && "hidden lg:block")}
          title="Complaints"
          description={loading ? "Loading..." : `${filtered.length} shown`}
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyNote title="No complaints match these filters" />
          ) : (
            <ul className="divide-y divide-kumo-line">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c.id)}
                    aria-current={c.id === selectedId}
                    className={cn(
                      "block w-full cursor-pointer space-y-1 border-l-4 p-4 text-left hover:bg-kumo-tint",
                      c.id === selectedId ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className={cn("truncate text-sm text-kumo-default", c.unread ? "font-semibold" : "font-medium")}>
                        {c.subject}
                      </span>
                      {c.unread && <span className="shrink-0 text-xs font-semibold text-kumo-danger">New activity</span>}
                    </span>
                    <span className="block truncate text-sm text-kumo-subtle">
                      {c.shopName}, Unit {c.unitId}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 text-sm">
                      <StatusBadge status={c.status} />
                      {c.priority !== "NORMAL" && <PriorityBadge priority={c.priority} />}
                      <span className="text-kumo-subtle">{c.category}</span>
                    </span>
                    <span className="block text-xs text-kumo-subtle">
                      {formatWhen(c.lastActivityAt)}
                      {c.commentCount > 0 && `, ${c.commentCount} repl${c.commentCount === 1 ? "y" : "ies"}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Detail */}
        <div className={cn("lg:col-span-7", !selectedId && "hidden lg:block")}>
          {detailLoading && !detail ? (
            <div className={cn(CARD, "flex justify-center py-24")}>
              <Loader />
            </div>
          ) : detail ? (
            <ComplaintView complaint={detail} role="ADMIN" userId={user.id} onBack={() => select(null)} onChanged={refreshAll} />
          ) : (
            <div className={CARD}>
              <EmptyNote title="Select a complaint">Its details and conversation open here.</EmptyNote>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function Choice({
  label,
  value,
  items,
  onChange,
  className,
}: {
  label: string;
  value: string;
  items: Record<string, string>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select aria-label={label} value={value} items={items} onValueChange={(v) => v != null && onChange(v as string)} className={className}>
      {Object.entries(items).map(([key, text]) => (
        <Select.Option key={key} value={key}>
          {text}
        </Select.Option>
      ))}
    </Select>
  );
}

export default function AdminComplaintsPage() {
  return (
    <Suspense fallback={null}>
      <AdminComplaints />
    </Suspense>
  );
}
