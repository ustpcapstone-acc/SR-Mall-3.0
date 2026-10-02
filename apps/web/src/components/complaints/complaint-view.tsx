"use client";

import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addComplaintCommentAction,
  updateComplaintPriorityAction,
  updateComplaintStatusAction,
} from "@/app/actions/complaint";
import { announceComplaintsChanged } from "@/lib/complaint-unread";
import {
  COMMENT_MAX,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  PRIORITY_META,
  STATUS_META,
  type ComplaintDetail,
  type ComplaintPriority,
  type ComplaintStatus,
} from "@/lib/complaints";

export const LABEL = "text-[10px] font-black text-slate-400 uppercase tracking-widest";
export const CARD = "bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[2rem] shadow-sm";

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.NEW;
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest", m.badge)}>
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.NORMAL;
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest", m.badge)}>
      {m.label}
    </span>
  );
}

/** Upload one image through the app's upload route. */
export async function uploadComplaintPhoto(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("Please choose an image file.");
    return null;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error("Please use an image under 5 MB.");
    return null;
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "complaints");
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
    return data.url as string;
  } catch (e: any) {
    toast.error("Photo upload failed: " + (e?.message || "unknown error"));
    return null;
  }
}

function Photo({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 hover:opacity-80 transition-opacity">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Attached photo" className="w-full h-full object-cover" />
    </a>
  );
}

/**
 * One complaint: details, photos, comment thread and reply box.
 * Admins also get status / priority controls and internal notes.
 */
export function ComplaintView({
  complaint,
  role,
  userId,
  onBack,
  onChanged,
}: {
  complaint: ComplaintDetail;
  role: "ADMIN" | "TENANT";
  userId: string;
  onBack?: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [internal, setInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === "ADMIN";
  const open = complaint.status === "NEW" || complaint.status === "IN_PROGRESS";
  const canComment = isAdmin || open;

  useEffect(() => {
    setMessage("");
    setPhotoUrl(null);
    setInternal(false);
  }, [complaint.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [complaint.comments.length]);

  const refresh = async () => {
    await onChanged();
    announceComplaintsChanged();
  };

  const send = async () => {
    if (!message.trim() && !photoUrl) return;
    setSending(true);
    const res = await addComplaintCommentAction(userId, complaint.id, { message, photoUrl, isInternal: internal });
    setSending(false);
    if (!res.success) return void toast.error(res.error);
    setMessage("");
    setPhotoUrl(null);
    await refresh();
  };

  const setStatus = async (status: ComplaintStatus) => {
    setBusyStatus(true);
    const res = await updateComplaintStatusAction(userId, complaint.id, status);
    setBusyStatus(false);
    if (!res.success) return void toast.error(res.error);
    toast.success(`Marked ${STATUS_META[status].label}`);
    await refresh();
  };

  const reopen = async () => {
    setBusyStatus(true);
    const res = await updateComplaintStatusAction(userId, complaint.id, "IN_PROGRESS");
    setBusyStatus(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Complaint reopened");
    await refresh();
  };

  const setPriority = async (priority: ComplaintPriority) => {
    const res = await updateComplaintPriorityAction(userId, complaint.id, priority);
    if (!res.success) return void toast.error(res.error);
    await refresh();
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadComplaintPhoto(file);
    setUploading(false);
    if (url) setPhotoUrl(url);
  };

  return (
    <div className={clsx(CARD, "p-5 sm:p-6 lg:p-8 space-y-6")}>
      {/* Header */}
      <div className="space-y-3">
        {onBack && (
          <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-primary">
            <ArrowLeft size={14} /> All complaints
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{complaint.category}</span>
        </div>
        <h2 className="text-lg sm:text-xl font-black text-charcoal dark:text-white leading-tight break-words">{complaint.subject}</h2>
        <p className="text-[11px] text-slate-400 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
          {isAdmin && (
            <span className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-300">
              <Store size={11} /> {complaint.shopName} · Unit {complaint.unitId}
              {complaint.ownerName ? ` · ${complaint.ownerName}` : ""}
            </span>
          )}
          <span>Filed {formatWhen(complaint.createdAt)}</span>
          {complaint.resolvedAt && complaint.status === "RESOLVED" && <span>· Resolved {formatWhen(complaint.resolvedAt)}</span>}
        </p>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
          <div>
            <p className={clsx(LABEL, "mb-1.5")}>Status</p>
            <div className="flex flex-wrap gap-1.5">
              {COMPLAINT_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busyStatus || complaint.status === s}
                  onClick={() => setStatus(s)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors",
                    complaint.status === s
                      ? "bg-primary text-white border-primary"
                      : "bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-white/10 hover:border-primary hover:text-primary",
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={clsx(LABEL, "mb-1.5")}>Priority</p>
            <select
              value={complaint.priority}
              onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary cursor-pointer"
            >
              {COMPLAINT_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_META[p].label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-3">
        <p className={LABEL}>Details</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line break-words leading-relaxed">{complaint.details}</p>
        {complaint.photos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {complaint.photos.map((p) => <Photo key={p} url={p} />)}
          </div>
        )}
      </div>

      {/* Thread */}
      <div className="space-y-3 pt-5 border-t border-slate-100 dark:border-white/5">
        <p className={LABEL}>Conversation</p>
        {complaint.comments.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">
            {isAdmin ? "No replies yet. Reply below to let the tenant know it's being handled." : "No replies yet. The admin will reply here."}
          </p>
        )}
        <div className="space-y-3">
          {complaint.comments.map((c) =>
            c.authorRole === "SYSTEM" ? (
              <div key={c.id} className="flex items-center gap-2 justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-1">
                <span className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                <span className="text-center">{c.message} · {formatWhen(c.createdAt)}</span>
                <span className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
              </div>
            ) : (
              <div key={c.id} className={clsx("flex", c.mine ? "justify-end" : "justify-start")}>
                <div
                  className={clsx(
                    "max-w-[88%] sm:max-w-[75%] rounded-2xl px-4 py-3 space-y-2",
                    c.isInternal
                      ? "bg-amber-50 dark:bg-amber-500/10 border border-dashed border-amber-300 dark:border-amber-500/30"
                      : c.mine
                        ? "bg-primary text-white"
                        : "bg-slate-100 dark:bg-zinc-800 text-charcoal dark:text-white",
                  )}
                >
                  <p className={clsx("text-[10px] font-black uppercase tracking-widest flex items-center gap-1", c.isInternal ? "text-amber-600 dark:text-amber-400" : c.mine ? "text-white/70" : "text-slate-400")}>
                    {c.isInternal ? <Lock size={10} /> : c.authorRole === "ADMIN" ? <ShieldCheck size={10} /> : <Store size={10} />}
                    {c.isInternal ? "Internal note · admins only" : c.authorName}
                  </p>
                  {c.message && <p className={clsx("text-sm whitespace-pre-line break-words", c.isInternal && "text-charcoal dark:text-white")}>{c.message}</p>}
                  {c.photoUrl && <Photo url={c.photoUrl} />}
                  <p className={clsx("text-[10px]", c.isInternal ? "text-amber-600/70" : c.mine ? "text-white/60" : "text-slate-400")}>{formatWhen(c.createdAt)}</p>
                </div>
              </div>
            ),
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {canComment ? (
        <div className="space-y-3 pt-2">
          {photoUrl && (
            <div className="relative inline-block">
              <Photo url={photoUrl} />
              <button onClick={() => setPhotoUrl(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow" aria-label="Remove photo">
                <X size={12} />
              </button>
            </div>
          )}
          <textarea
            value={message}
            maxLength={COMMENT_MAX}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={internal ? "Internal note — only admins can see this…" : isAdmin ? "Reply to the tenant…" : "Add a comment for the admin…"}
            className={clsx(
              "w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors resize-none",
              internal
                ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 focus:border-amber-400 text-charcoal dark:text-white"
                : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 focus:border-primary text-charcoal dark:text-white",
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className={clsx("inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:border-primary cursor-pointer", uploading && "opacity-60 pointer-events-none")}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {uploading ? "Uploading…" : "Photo"}
              <input type="file" accept="image/*" hidden onChange={onPickPhoto} />
            </label>
            {isAdmin && (
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-amber-500" />
                <Lock size={12} /> Internal note
              </label>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">{message.length}/{COMMENT_MAX}</span>
            <button
              onClick={send}
              disabled={sending || uploading || (!message.trim() && !photoUrl)}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {internal ? "Save note" : "Send"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
          <span className="flex-1 min-w-[12rem]">
            {complaint.status === "RESOLVED"
              ? "This complaint is resolved. If the problem came back, reopen it."
              : "The admin closed this complaint. File a new one if you still need help."}
          </span>
          {complaint.status === "RESOLVED" && (
            <button
              onClick={reopen}
              disabled={busyStatus}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-charcoal dark:text-white hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <RotateCcw size={13} /> Reopen
            </button>
          )}
        </div>
      )}

      {/* Tenant: mark resolved */}
      {!isAdmin && open && (
        <div className="flex justify-end">
          <button
            onClick={() => setStatus("RESOLVED")}
            disabled={busyStatus}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/10 disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Mark as resolved
          </button>
        </div>
      )}
    </div>
  );
}
