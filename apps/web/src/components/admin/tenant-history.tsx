"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Loader, Select, Table, cn } from "@cloudflare/kumo";
import { DownloadSimple } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, Pager, Panel, Person, SearchField } from "@/components/admin/page-kit";
import { getPastTenantsAction } from "@/app/actions/tenant";
import { useDebounced, usePageFor, useServerData } from "@/lib/use-server-page";
import { useFloors } from "@/lib/use-floors";

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

function location(r: TenantHistoryRow, floorLabel: (id?: string | null) => string) {
  if (!r.unitId) return "No unit assigned";
  return `Unit ${r.unitId}${r.floor ? `, ${floorLabel(r.floor)}` : ""}`;
}

function exportCsv(rows: TenantHistoryRow[], floorLabel: (id?: string | null) => string) {
  const head = ["Shop", "Owner", "Email", "Unit", "Floor", "Category", "Lease start", "Moved out", "Stayed", "Reason", "Note", "Total paid", "Unpaid balance", "Invoices", "Rating", "Reviews", "Recorded by"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.shopName, r.ownerName, r.ownerEmail, r.unitId, floorLabel(r.floor), r.category,
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
export function TenantHistory() {
  const { label: floorLabel } = useFloors();
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [selected, setSelected] = useState<TenantHistoryRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const search = useDebounced(query.trim());
  const [page, setPage] = usePageFor(search, reason, year);
  const { data, error, loading, reload } = useServerData({ search, reason, year, page }, getPastTenantsAction);
  const rows: TenantHistoryRow[] = data?.rows ?? [];
  const everyone = data?.all ?? 0;
  const years = data?.years ?? [];
  const unpaidTotal = data?.unpaid ?? 0;

  /** The CSV holds every match, not only the page on screen. */
  const downloadCsv = async () => {
    setExporting(true);
    try {
      const res = await getPastTenantsAction({ search: query.trim(), reason, year, all: true });
      if (res.success) exportCsv(res.data.rows, floorLabel);
      else toast.error(res.error);
    } catch {
      toast.error("Couldn't export the list. Check your connection.");
    } finally {
      setExporting(false);
    }
  };
  const reasonLabel = (key: string) => REASONS[key] ?? REASONS.MARKED_PAST;
  const reasonItems: Record<string, string> = { ALL: "All reasons", ...REASONS };
  const yearItems: Record<string, string> = { ALL: "All years", ...Object.fromEntries(years.map((y) => [String(y), String(y)])) };

  return (
    <Panel
      flush
      title="Tenant History"
      description={
        data
          ? `${everyone} former tenant${everyone === 1 ? "" : "s"}, saved automatically whenever a tenant leaves`
          : "Saved automatically whenever a tenant leaves"
      }
      actions={
        <Button variant="secondary" icon={<DownloadSimple />} loading={exporting} disabled={!data?.total} onClick={downloadCsv}>
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

      {data && error && <p className="px-4 pt-3 text-sm text-kumo-danger sm:px-5">{error}</p>}

      {!data && loading ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : !data ? (
        <EmptyNote
          title="Couldn't load tenant history"
          action={
            <Button variant="primary" onClick={reload}>
              Try again
            </Button>
          }
        >
          {error}
        </EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote title={everyone === 0 ? "No former tenants yet" : "Nothing matches your filters"}>
          {everyone === 0 ? "When a tenant leaves, a summary is saved here automatically." : "Try a different search, reason or year."}
        </EmptyNote>
      ) : (
        <div aria-busy={loading} className={cn("overflow-x-auto", loading && "pointer-events-none opacity-60")}>
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
              {rows.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <Person square name={r.shopName} detail={r.ownerName || r.ownerEmail || "Unknown owner"} image={r.logoUrl} />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-sm text-kumo-default">{location(r, floorLabel)}</Table.Cell>
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

      {data && <Pager page={loading ? page : data.page} total={data.total} onChange={setPage} />}

      <AdminDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.shopName ?? ""}
        description={selected ? `${location(selected, floorLabel)}${selected.category ? `, ${selected.category}` : ""}` : undefined}
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
