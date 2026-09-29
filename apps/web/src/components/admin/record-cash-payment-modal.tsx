"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  PhilippinePeso,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { recordManualPaymentAction } from "@/app/actions/finance";

export interface CashPaymentInvoice {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  dueDate: string | Date;
  status: string;
}

/**
 * "Record Cash Payment" dialog — marks an invoice PAID with the physical
 * receipt / reference number. Shared by Tenant Monitoring and the dashboard.
 */
export function RecordCashPaymentModal({
  invoice,
  tenantName,
  onClose,
  onRecorded,
}: {
  invoice: CashPaymentInvoice;
  tenantName?: string | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [refNo, setRefNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (!saving) onClose(); // never close mid-save
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const value = refNo.trim();
    if (!value) {
      setError("Enter the receipt or reference number.");
      return;
    }

    setSaving(true);
    try {
      const res = await recordManualPaymentAction(invoice.id, value);
      if (res.success) {
        onRecorded();
      } else {
        setError(res.error || "Failed to record payment.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  const due = new Date(invoice.dueDate);
  const hasDue = !Number.isNaN(due.getTime());
  const isPastDue = invoice.status === "OVERDUE" || (hasDue && due < new Date());

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-payment-title"
        className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className="bg-[#BE1E2D] p-8 text-white relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <PhilippinePeso size={24} />
            </div>
            <div>
              <h2 id="cash-payment-title" className="text-xl font-black uppercase tracking-tight">
                Record Cash Payment
              </h2>
              <p className="text-xs text-white/70 font-bold uppercase tracking-widest">
                Over-the-counter settlement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Invoice being cleared */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-charcoal dark:text-white truncate">
                  #{invoice.invoiceNumber}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {invoice.month}
                  {tenantName ? ` • ${tenantName}` : ""}
                </p>
              </div>
              <p className="text-2xl font-black text-charcoal dark:text-white whitespace-nowrap">
                ₱{Number(invoice.amount || 0).toLocaleString()}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <Calendar size={12} className="text-slate-400" />
              <span className="text-slate-500">Due {hasDue ? due.toLocaleDateString() : "—"}</span>
              {isPastDue && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  Overdue
                </span>
              )}
            </div>
          </div>

          {/* Reference number */}
          <div>
            <label
              htmlFor="cash-ref-no"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2"
            >
              Receipt / Reference Number
            </label>
            <input
              id="cash-ref-no"
              type="text"
              autoFocus
              autoComplete="off"
              value={refNo}
              disabled={saving}
              onChange={(e) => {
                setRefNo(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. OR-000123"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "cash-ref-error" : undefined}
              className={clsx(
                "w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border rounded-xl text-sm font-bold text-charcoal dark:text-white focus:outline-none transition-all",
                error
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-200 dark:border-white/5 focus:border-[#BE1E2D]",
              )}
            />
            {error && (
              <p
                id="cash-ref-error"
                className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-red-600"
              >
                <AlertTriangle size={12} /> {error}
              </p>
            )}
          </div>

          <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-500" />
            This marks the invoice as PAID and notifies the tenant.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="flex-1 py-3.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-3.5 bg-[#BE1E2D] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
            >
              {saving ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle size={16} /> Confirm Payment
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
