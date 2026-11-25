"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Ruler,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { approveReservationAction, getPermitLinkAction, rejectReservationAction } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";
import { ReservationStepper } from "@/components/reservation-stepper";

export interface ReservationRow {
  unit_id: string;
  sqm_size?: number | null;
  base_rent?: number | null;
  floor?: string | null;
  reservedAt?: string | null;
  remainingFormatted?: string | null;
  isUrgent?: boolean;
  reservingUser?: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null;
  /** Business permit the applicant uploaded with the reservation. */
  permit?: { url: string; name: string; type: string; size: number; uploadedAt: string } | null;
}

export type ReservationModalMode = "details" | "approve" | "reject";

const COMMENT_MAX = 1000;
const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isImage = (p: { type?: string; url: string }) => (p.type || "").startsWith("image/") || /\.(png|jpe?g)(\?|$)/i.test(p.url);

/**
 * Space reservation (admin Bookings → Space Reservations): "See details"
 * shows who reserved what and their business permit; Approve / Reject add a
 * comment for the applicant (required for reject) that goes into their email
 * and notification.
 */
export function ReservationDecisionModal({
  reservation: r,
  action,
  onClose,
  onDone,
}: {
  reservation: ReservationRow;
  action: ReservationModalMode;
  onClose: () => void;
  /** Called after the server accepted or refused (so the list can refresh). */
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ReservationModalMode>(action);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = mode === "approve";
  const details = mode === "details";

  useEffect(() => setMode(action), [action]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async () => {
    if (mode === "reject" && !reason.trim()) {
      setError("Please write a comment so the applicant knows why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = approve
        ? await approveReservationAction(r.unit_id, reason.trim() || undefined, user?.id)
        : await rejectReservationAction(r.unit_id, reason.trim(), user?.id);
      if (res.success) {
        onDone();
        onClose();
      } else {
        setError(res.error || "Something went wrong.");
        onDone(); // the list is probably out of date (expired / handled elsewhere)
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = r.reservingUser?.name || "Registered customer";
  const permit = r.permit || null;

  // Permits are private: preview / View / Download use a short-lived signed link.
  const [preview, setPreview] = useState<string | null>(null);
  const [opening, setOpening] = useState<"view" | "download" | null>(null);
  useEffect(() => {
    setPreview(null);
    if (!permit || !isImage(permit)) return;
    let alive = true;
    getPermitLinkAction(user?.id, r.unit_id).then((res) => alive && res.success && setPreview(res.url));
    return () => {
      alive = false;
    };
  }, [permit?.url, r.unit_id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPermit = async (how: "view" | "download") => {
    // Open the tab first (synchronously) so pop-up blockers allow it.
    const tab = how === "view" ? window.open("about:blank", "_blank") : null;
    setOpening(how);
    try {
      const res = await getPermitLinkAction(user?.id, r.unit_id);
      if (!res.success) {
        tab?.close();
        setError(res.error);
        return;
      }
      if (tab) tab.location.href = res.url;
      else {
        const a = document.createElement("a");
        a.href = res.url;
        a.download = permit?.name || "business-permit";
        a.rel = "noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      tab?.close();
      setError("Couldn't open the business permit. Try again.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="fixed inset-0 z-250 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-decision-title"
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl animate-fade-in-up"
      >
        <div
          className={clsx(
            "p-7 text-white relative",
            details ? "bg-charcoal dark:bg-zinc-900" : approve ? "bg-emerald-600" : "bg-[#BE1E2D]",
          )}
        >
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              {details ? <Eye size={24} /> : approve ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </span>
            <div>
              <p className="text-xs font-semibold text-white/70">Space reservation</p>
              <h2 id="reservation-decision-title" className="text-xl font-semibold tracking-tight">
                {details ? `Unit ${r.unit_id} details` : `${approve ? "Approve" : "Reject"} Unit ${r.unit_id}?`}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="absolute top-6 right-6 text-white/60 hover:text-white disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-5">
          <ReservationStepper current={approve ? 3 : 2} />

          {/* Who */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5">
            <span className="w-11 h-11 rounded-full bg-primary/10 text-primary overflow-hidden flex items-center justify-center font-semibold shrink-0">
              {r.reservingUser?.avatarUrl ? <img src={r.reservingUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-charcoal dark:text-white truncate">{name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 truncate">
                <Mail size={12} /> {r.reservingUser?.email || "No email on file"}
              </p>
            </div>
            <span
              className={clsx(
                "ml-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                r.isUrgent ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600",
              )}
            >
              <Clock size={12} /> {r.remainingFormatted || "—"} left
            </span>
          </div>

          {/* What */}
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400"><MapPin size={11} /> Floor</dt>
              <dd className="mt-1 font-bold capitalize text-charcoal dark:text-white">{r.floor || "—"}</dd>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400"><Ruler size={11} /> Size</dt>
              <dd className="mt-1 font-bold text-charcoal dark:text-white">{r.sqm_size ?? "—"} sqm</dd>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400"><Wallet size={11} /> Rent</dt>
              <dd className="mt-1 font-bold text-charcoal dark:text-white">₱{Number(r.base_rent || 0).toLocaleString()}</dd>
            </div>
          </dl>
          {r.reservedAt && (
            <p className="text-xs text-slate-500">
              Reserved {new Date(r.reservedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}

          {/* Business permit */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Business permit</p>
            {permit ? (
              <div className="rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
                {isImage(permit) ? (
                  <button type="button" onClick={() => openPermit("view")} className="block w-full bg-slate-50 dark:bg-zinc-900">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Business permit" className="w-full max-h-64 object-contain" />
                    ) : (
                      <span className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></span>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-6 bg-slate-50 dark:bg-zinc-900 text-slate-500">
                    <FileText size={28} className="text-primary" />
                    <span className="text-xs font-bold">PDF document</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-charcoal dark:text-white truncate">{permit.name}</p>
                    <p className="text-xs text-slate-500">
                      {permit.size ? `${fileSize(permit.size)} · ` : ""}uploaded{" "}
                      {new Date(permit.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPermit("view")}
                    disabled={!!opening}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-charcoal dark:text-white hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {opening === "view" ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />} View
                  </button>
                  <button
                    type="button"
                    onClick={() => openPermit("download")}
                    disabled={!!opening}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {opening === "download" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 p-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                No permit uploaded (this reservation was made before permits were required).
              </p>
            )}
          </div>

          {/* What happens */}
          {!details && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {approve ? (
                <>
                  Unit {r.unit_id} becomes <strong>Occupied</strong> and {name} gets an approval email and notification. The leasing team should then
                  schedule the site visit and contract.
                </>
              ) : (
                <>
                  Unit {r.unit_id} goes back to <strong>Available</strong> for other customers, and {name} is notified by email and in the app.
                </>
              )}
            </p>
          )}

          {!details && (
            <div className="space-y-1.5">
              <label htmlFor="reservation-comment" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Comment to the applicant {approve ? "(optional)" : <span className="text-primary">(required)</span>}
              </label>
              <textarea
                id="reservation-comment"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, COMMENT_MAX))}
                rows={3}
                placeholder={
                  approve
                    ? "e.g. Please visit the admin office on Monday at 9 AM to sign the contract."
                    : "e.g. The business permit has expired. Please reserve again with a valid permit."
                }
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 text-sm text-charcoal dark:text-white focus:outline-hidden focus:border-primary resize-none"
              />
              <p className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Sent to {name} by email and notification.</span>
                <span>{reason.length}/{COMMENT_MAX}</span>
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-red-600 text-xs font-bold">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {details ? (
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { setError(null); setMode("reject"); }}
                className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-red-500 hover:border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <XCircle size={15} /> Reject
              </button>
              <button
                type="button"
                onClick={() => { setError(null); setMode("approve"); }}
                className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 size={15} /> Approve
              </button>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || (!approve && !reason.trim())}
                className={clsx(
                  "flex-2 py-3.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60",
                  approve ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-[#BE1E2D] hover:bg-[#a01825] shadow-red-500/20",
                )}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : approve ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {approve ? "Approve reservation" : "Reject & release unit"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
