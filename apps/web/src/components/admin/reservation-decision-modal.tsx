"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Mail, MapPin, Ruler, Wallet, X, XCircle } from "lucide-react";
import { approveReservationAction, rejectReservationAction } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";

export interface ReservationRow {
  unit_id: string;
  sqm_size?: number | null;
  base_rent?: number | null;
  floor?: string | null;
  reservedAt?: string | null;
  remainingFormatted?: string | null;
  isUrgent?: boolean;
  reservingUser?: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null;
}

/**
 * Approve / reject a space reservation (admin Bookings → Space Reservations).
 * Replaces the browser confirm() popups with a summary of who reserved what.
 */
export function ReservationDecisionModal({
  reservation: r,
  action,
  onClose,
  onDone,
}: {
  reservation: ReservationRow;
  action: "approve" | "reject";
  onClose: () => void;
  /** Called after the server accepted or refused (so the list can refresh). */
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = action === "approve";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = approve
        ? await approveReservationAction(r.unit_id)
        : await rejectReservationAction(r.unit_id, reason.trim() || undefined, user?.id);
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

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-decision-title"
        className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className={clsx("p-7 text-white relative", approve ? "bg-emerald-600" : "bg-[#BE1E2D]")}>
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              {approve ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Space reservation</p>
              <h2 id="reservation-decision-title" className="text-xl font-black uppercase tracking-tight">
                {approve ? "Approve" : "Reject"} Unit {r.unit_id}?
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
          {/* Who */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5">
            <span className="w-11 h-11 rounded-full bg-primary/10 text-primary overflow-hidden flex items-center justify-center font-black shrink-0">
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
                "ml-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                r.isUrgent ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600",
              )}
            >
              <Clock size={12} /> {r.remainingFormatted || "—"} left
            </span>
          </div>

          {/* What */}
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><MapPin size={11} /> Floor</dt>
              <dd className="mt-1 font-bold capitalize text-charcoal dark:text-white">{r.floor || "—"}</dd>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><Ruler size={11} /> Size</dt>
              <dd className="mt-1 font-bold text-charcoal dark:text-white">{r.sqm_size ?? "—"} sqm</dd>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><Wallet size={11} /> Rent</dt>
              <dd className="mt-1 font-bold text-charcoal dark:text-white">₱{Number(r.base_rent || 0).toLocaleString()}</dd>
            </div>
          </dl>
          {r.reservedAt && (
            <p className="text-xs text-slate-500">
              Reserved {new Date(r.reservedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}

          {/* What happens */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {approve ? (
              <>
                Unit {r.unit_id} becomes <strong>Occupied</strong> and {name} gets an approval email. The leasing team should then
                schedule the site visit and contract.
              </>
            ) : (
              <>
                Unit {r.unit_id} goes back to <strong>Available</strong> for other customers, and {name} is notified by email.
              </>
            )}
          </p>

          {!approve && (
            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Reason for the customer (optional)
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="e.g. The unit is being reserved for an existing tenant's expansion."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 text-sm text-charcoal dark:text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-red-600 text-xs font-bold">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={clsx(
                "flex-[2] py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-60",
                approve ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-[#BE1E2D] hover:bg-[#a01825] shadow-red-500/20",
              )}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : approve ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {approve ? "Approve reservation" : "Reject & release unit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
