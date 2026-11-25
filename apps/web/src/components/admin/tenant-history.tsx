"use client";

import { useMemo, useState } from "react";
import { Button, Loader, Select, Table, cn } from "@cloudflare/kumo";
import { DownloadSimple } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, Panel, Person, SearchField } from "@/components/admin/page-kit";

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

const REASONS: Record<string, string> = {
  REMOVED: "Removed by admin",
  ROLE_CHANGED: "Changed to customer",
  MARKED_PAST: "Marked as past tenant",
  RESERVATION_REJECTED: "Reservation rejected",
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
  return `Unit ${r.unitId}${r.floor ? `, ${FLOORS[r.floor] || r.floor}` : ""}`;
}

function exportCsv(rows: TenantHistoryRow[]) {
  const head = ["Shop", "Owner", "Email", "Unit", "Floor", "Category", "Lease start", "Moved out", "Stayed", "Reason", "Note", "Total paid", "Unpaid balance", "Invoices", "Rating", "Reviews", "Recorded by"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.shopName, r.ownerName, r.ownerEmail, r.unitId, r.floor ? FLOORS[r.floor] || r.floor : "", r.category,
      day(r.leaseStart), day(r.endedAt), stayLength(r.leaseStart, r.endedAt), REASONS[r.reason] || r.reason, r.note,
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
  const reasonLabel = (key: string) => REASONS[key] ?? REASONS.MARKED_PAST;
  const reasonItems: Record<string, string> = { ALL: "All reasons", ...REASONS };
  const yearItems: Record<string, string> = { ALL: "All years", ...Object.fromEntries(years.map((y) => [String(y), String(y)])) };

  return (
    <Panel
      flush
      title="Tenant History"
      description={`${rows.length} former tenant${rows.length === 1 ? "" : "s"}, saved automatically whenever a tenant leaves`}
      actions={
        <Button variant="secondary" icon={<DownloadSimple />} disabled={filtered.length === 0} onClick={() => exportCsv(filtered)}>
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-4 sm:px-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search shop, owner, email or unit" className="sm:w-80" />
        <Select aria-label="Reason" value={reason} items={reasonItems} onValueChange={(v) => setReason((v as string) || "ALL")} className="w-52">
          {Object.entries(reasonItems).map(([value, label]) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
        <Select aria-label="Year" value={year} items={yearItems} onValueChange={(v) => setYear((v as string) || "ALL")} className="w-36">
          {Object.entries(yearItems).map(([value, label]) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
        {unpaidTotal > 0 && (
          <p className="text-sm font-medium text-kumo-warning">{peso(unpaidTotal)} left unpaid by former tenants in this list.</p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyNote title={rows.length === 0 ? "No former tenants yet" : "Nothing matches your filters"}>
          {rows.length === 0 ? "When a tenant leaves, a summary is saved here automatically." : "Try a different search, reason or year."}
        </EmptyNote>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Shop</Table.Head>
                <Table.Head>Unit and floor</Table.Head>
                <Table.Head>Stayed</Table.Head>
                <Table.Head>Reason</Table.Head>
                <Table.Head>Balance</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <Person square name={r.shopName} detail={r.ownerName || r.ownerEmail || "Unknown owner"} image={r.logoUrl} />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-sm text-kumo-default">{location(r)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <p className="text-sm text-kumo-default">
                      {day(r.leaseStart)} to {day(r.endedAt)}
                    </p>
                    <p className="text-sm text-kumo-subtle">{stayLength(r.leaseStart, r.endedAt)}</p>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-kumo-default">{reasonLabel(r.reason)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <p className={cn("text-sm font-medium", r.outstanding > 0 ? "text-kumo-warning" : "text-kumo-success")}>
                      {r.outstanding > 0 ? `${peso(r.outstanding)} unpaid` : "Paid up"}
                    </p>
                    <p className="text-sm text-kumo-subtle">{peso(r.totalPaid)} paid</p>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                      Details
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <AdminDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.shopName ?? ""}
        description={selected ? `${location(selected)}${selected.category ? `, ${selected.category}` : ""}` : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <p className="text-sm text-kumo-default">
              <strong>{reasonLabel(selected.reason)}</strong>
              {selected.endedByName && <span className="text-kumo-subtle"> by {selected.endedByName}</span>}
            </p>
            {selected.note && <p className="rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">{selected.note}</p>}
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Lease start", day(selected.leaseStart)],
                ["Moved out", day(selected.endedAt)],
                ["Stayed", stayLength(selected.leaseStart, selected.endedAt)],
                ["Invoices", String(selected.invoiceCount)],
                ["Total paid", peso(selected.totalPaid)],
                ["Unpaid balance", selected.outstanding > 0 ? peso(selected.outstanding) : "None"],
                [
                  "Rating when they left",
                  selected.reviewCount ? `${selected.avgRating.toFixed(1)} out of 5 (${selected.reviewCount})` : "No reviews",
                ],
                ["Owner", selected.ownerName || "Unknown"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-kumo-subtle">{label}</dt>
                  <dd
                    className={cn(
                      "text-sm",
                      label === "Unpaid balance" && selected.outstanding > 0 ? "font-semibold text-kumo-warning" : "text-kumo-default",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {selected.ownerEmail && (
              <a href={`mailto:${selected.ownerEmail}`} className="break-all text-sm text-kumo-link hover:underline">
                {selected.ownerEmail}
              </a>
            )}
          </div>
        )}
      </AdminDialog>
    </Panel>
  );
}
