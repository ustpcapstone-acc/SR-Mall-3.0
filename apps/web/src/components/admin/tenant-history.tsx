"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Download, Loader2, MapPin, Search, Star, Store, X } from "lucide-react";

export interface TenantHistoryRow {
  id: string;
  tenantId: string;
  shopName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  unitId: string | null;
  floor: string | null;
  category: string | null;
  logoUrl: string | null;
  leaseStart: string;
  endedAt: string;
  reason: "REMOVED" | "ROLE_CHANGED" | "MARKED_PAST" | string;
  note: string | null;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
  avgRating: number;
  reviewCount: number;
  endedByName: string | null;
}

const REASONS: Record<string, { label: string; cls: string }> = {
  REMOVED: { label: "Removed by admin", cls: "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800/30" },
  ROLE_CHANGED: { label: "Changed to customer", cls: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30" },
  MARKED_PAST: { label: "Marked as past tenant", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300" },
  RESERVATION_REJECTED: { label: "Reservation rejected", cls: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30 dark:text-amber-400" },
};
const FLOORS: Record<string, string> = { ground: "Ground Floor", first: "First Floor", second: "Second Floor" };

const peso = (n: number) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** "9 months", "1 year 2 months", "12 days" */
function stayLength(from: string, to: string) {
  const days = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} year${y === 1 ? "" : "s"}`, m && `${m} month${m === 1 ? "" : "s"}`].filter(Boolean).join(" ") || "1 month";
}

function location(r: TenantHistoryRow) {
  if (!r.unitId) return "No unit assigned";
  return `Unit ${r.unitId}${r.floor ? ` · ${FLOORS[r.floor] || r.floor}` : ""}`;
}

function exportCsv(rows: TenantHistoryRow[]) {
  const head = ["Shop", "Owner", "Email", "Unit", "Floor", "Category", "Lease start", "Moved out", "Stayed", "Reason", "Note", "Total paid", "Unpaid balance", "Invoices", "Rating", "Reviews", "Recorded by"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.shopName, r.ownerName, r.ownerEmail, r.unitId, r.floor ? FLOORS[r.floor] || r.floor : "", r.category,
      day(r.leaseStart), day(r.endedAt), stayLength(r.leaseStart, r.endedAt), REASONS[r.reason]?.label || r.reason, r.note,
      r.totalPaid, r.outstanding, r.invoiceCount, r.reviewCount ? r.avgRating.toFixed(1) : "", r.reviewCount, r.endedByName,
    ].map(esc).join(","),
  );
  const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tenant-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** User Management → Tenant History: every tenant who has left, with search, filters and CSV export. */
export function TenantHistory({ rows, loading }: { rows: TenantHistoryRow[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [selected, setSelected] = useState<TenantHistoryRow | null>(null);

  const years = useMemo(
    () => [...new Set(rows.map((r) => new Date(r.endedAt).getFullYear()))].sort((a, b) => b - a),
    [rows],
  );
  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      [r.shopName, r.ownerName, r.ownerEmail, r.unitId].some((v) => (v || "").toLowerCase().includes(q));
    return matchesQ && (reason === "ALL" || r.reason === reason) && (year === "ALL" || String(new Date(r.endedAt).getFullYear()) === year);
  });
  const unpaidTotal = filtered.reduce((n, r) => n + (r.outstanding || 0), 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
      {/* Header + controls */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Store size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-charcoal dark:text-white">Tenant History</h3>
              <p className="text-xs text-slate-400">
                {rows.length} former tenant{rows.length === 1 ? "" : "s"} · saved automatically whenever a tenant leaves
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shop, owner, email or unit…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:border-primary"
            />
          </div>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:border-primary"
          >
            <option value="ALL">All reasons</option>
            {Object.entries(REASONS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:border-primary"
          >
            <option value="ALL">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {unpaidTotal > 0 && (
          <p className="text-xs font-bold text-amber-600">
            ⚠ {peso(unpaidTotal)} left unpaid by former tenants in this list.
          </p>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center px-6">
          <Store className="w-10 h-10 mx-auto text-slate-200 mb-3" />
          <p className="font-bold text-charcoal dark:text-white">{rows.length === 0 ? "No former tenants yet" : "Nothing matches your filters"}</p>
          <p className="text-sm text-slate-400 mt-1">
            {rows.length === 0 ? "When a tenant leaves, a summary is saved here automatically." : "Try a different search, reason or year."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Shop</th>
                <th className="px-6 py-4">Unit / Floor</th>
                <th className="px-6 py-4">Stayed</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center font-black text-slate-500 shrink-0">
                        {r.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          r.shopName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-charcoal dark:text-white truncate">{r.shopName}</p>
                        <p className="text-xs text-slate-400 truncate">{r.ownerName || r.ownerEmail || "Unknown owner"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{location(r)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-charcoal dark:text-white">{day(r.leaseStart)} → {day(r.endedAt)}</p>
                    <p className="text-xs text-slate-400">{stayLength(r.leaseStart, r.endedAt)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx("inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap", REASONS[r.reason]?.cls || REASONS.MARKED_PAST.cls)}>
                      {REASONS[r.reason]?.label || r.reason}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {r.outstanding > 0 ? (
                      <span className="font-bold text-amber-600">⚠ {peso(r.outstanding)} unpaid</span>
                    ) : (
                      <span className="font-bold text-emerald-600">Paid up ✓</span>
                    )}
                    <p className="text-xs text-slate-400">{peso(r.totalPaid)} paid</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-charcoal dark:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center font-black text-slate-500 shrink-0">
                  {selected.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    selected.shopName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black text-charcoal dark:text-white truncate">{selected.shopName}</h4>
                  <p className="text-xs text-slate-400 inline-flex items-center gap-1">
                    <MapPin size={11} className="text-primary" /> {location(selected)}
                    {selected.category ? ` · ${selected.category}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx("inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold", REASONS[selected.reason]?.cls || REASONS.MARKED_PAST.cls)}>
                  {REASONS[selected.reason]?.label || selected.reason}
                </span>
                {selected.endedByName && <span className="text-xs text-slate-400">by {selected.endedByName}</span>}
              </div>
              {selected.note && <p className="text-sm text-slate-600 dark:text-slate-300">{selected.note}</p>}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Lease start", day(selected.leaseStart)],
                  ["Moved out", day(selected.endedAt)],
                  ["Stayed", stayLength(selected.leaseStart, selected.endedAt)],
                  ["Invoices", String(selected.invoiceCount)],
                  ["Total paid", peso(selected.totalPaid)],
                  ["Unpaid balance", selected.outstanding > 0 ? peso(selected.outstanding) : "None"],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k}</dt>
                    <dd className={clsx("mt-0.5 font-bold", k === "Unpaid balance" && selected.outstanding > 0 ? "text-amber-600" : "text-charcoal dark:text-white")}>{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rating when they left</p>
                  <p className="mt-0.5 font-bold text-charcoal dark:text-white inline-flex items-center gap-1">
                    {selected.reviewCount ? (
                      <>
                        <Star size={13} className="text-amber-400" fill="currentColor" /> {selected.avgRating.toFixed(1)}
                        <span className="text-xs font-normal text-slate-400">({selected.reviewCount})</span>
                      </>
                    ) : (
                      "No reviews"
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner</p>
                  <p className="mt-0.5 font-bold text-charcoal dark:text-white truncate">{selected.ownerName || "—"}</p>
                  {selected.ownerEmail && (
                    <a href={`mailto:${selected.ownerEmail}`} className="text-xs text-primary hover:underline break-all">
                      {selected.ownerEmail}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
