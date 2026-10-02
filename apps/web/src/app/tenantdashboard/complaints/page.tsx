"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Camera, ClipboardList, Loader2, MessageSquare, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { createComplaintAction, getComplaintAction, getMyComplaintsAction } from "@/app/actions/complaint";
import { announceComplaintsChanged } from "@/lib/complaint-unread";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  DETAILS_MAX,
  MAX_PHOTOS,
  PRIORITY_META,
  SUBJECT_MAX,
  type ComplaintDetail,
  type ComplaintPriority,
  type ComplaintSummary,
} from "@/lib/complaints";
import {
  CARD,
  ComplaintView,
  LABEL,
  PriorityBadge,
  StatusBadge,
  formatWhen,
  uploadComplaintPhoto,
} from "@/components/complaints/complaint-view";

const INPUT =
  "w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all";

function NewComplaintModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("NORMAL");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadComplaintPhoto(f);
      if (url) urls.push(url);
    }
    setUploading(false);
    setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    setSaving(true);
    const res = await createComplaintAction(userId, { category, subject, details, priority, photos });
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Complaint sent to the mall admin");
    announceComplaintsChanged();
    onCreated(res.id);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-100 dark:border-white/10 shadow-2xl p-5 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-charcoal dark:text-white">New complaint</h2>
            <p className="text-xs text-slate-400 mt-0.5">Sent straight to the mall admin. You'll be notified when they reply.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className={clsx(LABEL, "block mb-1.5")}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={clsx(INPUT, "font-bold cursor-pointer")}>
            <option value="">Select a category</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={clsx(LABEL, "block mb-1.5")}>Subject</label>
          <input value={subject} maxLength={SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Ceiling leak near the counter" className={INPUT} />
          <p className="text-right text-[10px] text-slate-400 mt-1">{subject.length}/{SUBJECT_MAX}</p>
        </div>

        <div>
          <label className={clsx(LABEL, "block mb-1.5")}>Details</label>
          <textarea
            value={details}
            maxLength={DETAILS_MAX}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder="What happened, where exactly, and since when?"
            className={clsx(INPUT, "resize-none")}
          />
          <p className="text-right text-[10px] text-slate-400 mt-1">{details.length}/{DETAILS_MAX}</p>
        </div>

        <div>
          <label className={clsx(LABEL, "block mb-1.5")}>Priority</label>
          <div className="grid grid-cols-3 gap-2">
            {COMPLAINT_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={clsx(
                  "h-11 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-colors",
                  priority === p
                    ? p === "URGENT"
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-primary text-white border-primary"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-500",
                )}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Use Urgent for safety issues or problems stopping you from operating.</p>
        </div>

        <div>
          <label className={clsx(LABEL, "block mb-1.5")}>Photos (optional, up to {MAX_PHOTOS})</label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setPhotos((all) => all.filter((x) => x !== p))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove photo">
                  <X size={10} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className={clsx("w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary cursor-pointer", uploading && "opacity-60 pointer-events-none")}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                <span className="text-[9px] font-bold uppercase mt-1">{uploading ? "Uploading" : "Add"}</span>
                <input type="file" accept="image/*" multiple hidden onChange={addPhotos} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-widest text-slate-500">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || uploading}
            className="flex-[2] h-12 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Send complaint
          </button>
        </div>
      </div>
    </div>
  );
}

function ComplaintRow({ c, active, onClick }: { c: ComplaintSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left p-4 rounded-2xl border transition-all",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 hover:border-slate-200 dark:hover:border-white/10",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={c.status} />
            {c.priority === "URGENT" && <PriorityBadge priority={c.priority} />}
          </div>
          <p className={clsx("text-sm text-charcoal dark:text-white truncate", c.unread ? "font-black" : "font-bold")}>{c.subject}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {c.category} · {formatWhen(c.lastActivityAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {c.unread && <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-label="New reply" />}
          {c.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <MessageSquare size={11} /> {c.commentCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TenantComplaints() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("id");

  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const loadList = useCallback(async () => {
    if (!user?.id) return;
    const res = await getMyComplaintsAction(user.id);
    if (res.success) setComplaints(res.complaints);
    else toast.error(res.error);
    setLoading(false);
  }, [user?.id]);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !selectedId) return setDetail(null);
    const res = await getComplaintAction(user.id, selectedId);
    if (res.success) {
      setDetail(res.complaint);
      // Opening it marks it read.
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

  // Keep the tab in sync with the complaint that is open.
  useEffect(() => {
    if (!detail) return;
    setTab(detail.status === "NEW" || detail.status === "IN_PROGRESS" ? "open" : "done");
  }, [detail?.id, detail?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = (c: ComplaintSummary) => c.status === "NEW" || c.status === "IN_PROGRESS";
  const openList = complaints.filter(isOpen);
  const doneList = complaints.filter((c) => !isOpen(c));
  const shown = tab === "open" ? openList : doneList;

  const refreshAll = async () => {
    await Promise.all([loadList(), loadDetail()]);
  };

  if (!user?.id) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-20 lg:pb-0">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest mb-1">Support</p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-charcoal dark:text-white tracking-tight">Complaints</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">Report a problem to the mall admin and follow it here — no need to go to the office.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshAll} className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-primary" aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:bg-primary/90"
          >
            <Plus size={15} /> New complaint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* List */}
        <div className={clsx("lg:col-span-5 space-y-4", selectedId && "hidden lg:block")}>
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-800/60">
            {[
              { key: "open" as const, label: "Open", n: openList.length },
              { key: "done" as const, label: "Resolved", n: doneList.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  "flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                  tab === t.key ? "bg-white dark:bg-zinc-900 text-charcoal dark:text-white shadow-sm" : "text-slate-400",
                )}
              >
                {t.label} <span className="opacity-60">({t.n})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : shown.length === 0 ? (
            <div className={clsx(CARD, "py-14 px-6 text-center")}>
              <ClipboardList size={36} className="mx-auto text-slate-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black text-slate-400">{tab === "open" ? "No open complaints" : "No resolved complaints yet"}</p>
              {tab === "open" && <p className="text-xs text-slate-400 mt-1">Something wrong with your unit? Tap “New complaint”.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((c) => (
                <ComplaintRow key={c.id} c={c} active={c.id === selectedId} onClick={() => select(c.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className={clsx("lg:col-span-7", !selectedId && "hidden lg:block")}>
          {detailLoading && !detail ? (
            <div className={clsx(CARD, "py-24 flex justify-center")}><Loader2 className="animate-spin text-slate-300" /></div>
          ) : detail ? (
            <ComplaintView complaint={detail} role="TENANT" userId={user.id} onBack={() => select(null)} onChanged={refreshAll} />
          ) : (
            <div className={clsx(CARD, "py-24 px-6 text-center")}>
              <MessageSquare size={36} className="mx-auto text-slate-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black text-slate-400">Select a complaint to see the conversation</p>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewComplaintModal
          userId={user.id}
          onClose={() => setShowNew(false)}
          onCreated={async (id) => {
            setShowNew(false);
            setTab("open");
            await loadList();
            select(id);
          }}
        />
      )}
    </div>
    </div>
  );
}

export default function TenantComplaintsPage() {
  return (
    <Suspense fallback={null}>
      <TenantComplaints />
    </Suspense>
  );
}
