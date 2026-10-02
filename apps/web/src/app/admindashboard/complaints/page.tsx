"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Inbox, Loader2, MessageSquare, RefreshCw, Search, Store } from "lucide-react";
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

const SELECT =
  "h-11 px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary cursor-pointer";

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

  const cards = [
    { label: "New", value: stats.new, icon: Inbox, tone: "text-blue-500 bg-blue-500/10", onClick: () => setStatus("NEW") },
    { label: "In Progress", value: stats.inProgress, icon: Clock, tone: "text-amber-500 bg-amber-500/10", onClick: () => setStatus("IN_PROGRESS") },
    { label: "Urgent (open)", value: stats.urgentOpen, icon: AlertTriangle, tone: "text-red-500 bg-red-500/10", onClick: () => { setStatus("OPEN"); setPriority("URGENT"); } },
    { label: "Resolved this month", value: stats.resolvedThisMonth, icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10", onClick: () => setStatus("RESOLVED") },
  ];

  if (!user?.id) return null;

  return (
    <div className="min-h-screen pt-6 sm:pt-10 px-4 sm:px-8 pb-24 lg:pb-10 animate-fade-in-up space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <ClipboardList size={10} className="text-primary" />
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Tenant Support</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-charcoal dark:text-white tracking-tighter uppercase leading-none">
            Tenant <span className="text-primary">Complaints.</span>
          </h1>
          <p className="text-sm font-medium text-slate-500 max-w-xl">Reply to tenants, track each issue and close it out — all in one thread.</p>
        </div>
        <button onClick={refreshAll} className="self-start lg:self-auto inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-slate-200 dark:border-white/10 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:border-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <button key={c.label} onClick={c.onClick} className={clsx(CARD, "p-4 sm:p-5 text-left hover:border-primary/30 transition-colors")}>
            <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center mb-3", c.tone)}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white">{c.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, shop, unit or owner"
            className="w-full h-11 pl-10 pr-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:border-primary"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
          <option value="OPEN">Open (New + In Progress)</option>
          <option value="ALL">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
          <option value="">All categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SELECT}>
          <option value="">All priorities</option>
          {COMPLAINT_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* List */}
        <div className={clsx("lg:col-span-5 space-y-2", selectedId && "hidden lg:block")}>
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : filtered.length === 0 ? (
            <div className={clsx(CARD, "py-14 px-6 text-center")}>
              <ClipboardList size={36} className="mx-auto text-slate-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black text-slate-400">No complaints match these filters</p>
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={clsx(
                  "w-full text-left p-4 rounded-2xl border transition-all",
                  c.id === selectedId
                    ? "border-primary/40 bg-primary/5"
                    : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 hover:border-slate-200 dark:hover:border-white/10",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={c.status} />
                      {c.priority !== "NORMAL" && <PriorityBadge priority={c.priority} />}
                    </div>
                    <p className={clsx("text-sm text-charcoal dark:text-white truncate", c.unread ? "font-black" : "font-bold")}>{c.subject}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate inline-flex items-center gap-1 max-w-full">
                      <Store size={11} className="shrink-0" /> <span className="truncate">{c.shopName} · Unit {c.unitId}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{c.category} · {formatWhen(c.lastActivityAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {c.unread && <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-label="Needs attention" />}
                    {c.commentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <MessageSquare size={11} /> {c.commentCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className={clsx("lg:col-span-7", !selectedId && "hidden lg:block")}>
          {detailLoading && !detail ? (
            <div className={clsx(CARD, "py-24 flex justify-center")}><Loader2 className="animate-spin text-slate-300" /></div>
          ) : detail ? (
            <ComplaintView complaint={detail} role="ADMIN" userId={user.id} onBack={() => select(null)} onChanged={refreshAll} />
          ) : (
            <div className={clsx(CARD, "py-24 px-6 text-center")}>
              <MessageSquare size={36} className="mx-auto text-slate-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black text-slate-400">Select a complaint to view and reply</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminComplaintsPage() {
  return (
    <Suspense fallback={null}>
      <AdminComplaints />
    </Suspense>
  );
}
