"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, Input, Loader } from "@cloudflare/kumo";
import { ArrowLeft, CaretLeft, CaretRight, MagnifyingGlass, Storefront, Wallet, X } from "@phosphor-icons/react";
import { getPaymentLedgerAction, type LedgerTenant, type ScheduleEntry } from "@/app/actions/payment-schedule";
import { PaymentSchedule } from "./payment-schedule";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** "YYYY-MM" of a date in Philippine time. */
const monthKeyOf = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

function ShopAvatar({ t, large }: { t: LedgerTenant; large?: boolean }) {
  return (
    <span
      className={`flex ${large ? "size-12" : "size-10"} shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-recessed text-kumo-subtle ring-1 ring-kumo-line`}
    >
      {t.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <Storefront size={18} />
      )}
    </span>
  );
}

type BadgeInfo = { label: string; variant: "success" | "neutral" | "error" | "warning" };

const STATUS_BADGE: Record<ScheduleEntry["status"], BadgeInfo> = {
  PAID: { label: "Paid", variant: "success" },
  DUE: { label: "Due", variant: "neutral" },
  OVERDUE: { label: "Overdue", variant: "error" },
  VERIFYING: { label: "Verifying", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "error" },
};

type RowFilter = "all" | "unpaid" | "paid";

/** One tenant row: logo, name and details, amount with status, and a chevron (opens the schedule). */
function TenantRow({
  t,
  meta,
  metaTone,
  amount,
  badge,
  onOpen,
}: {
  t: LedgerTenant;
  meta: string;
  metaTone?: "danger";
  amount?: number;
  badge: BadgeInfo;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-kumo-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kumo-focus sm:px-4"
      >
        <ShopAvatar t={t} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-kumo-default">{t.shopName}</span>
          <span className={`block truncate text-sm ${metaTone === "danger" ? "text-kumo-danger" : "text-kumo-subtle"}`}>
            {meta}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {amount !== undefined && <span className="font-semibold tabular-nums text-kumo-default">{peso(amount)}</span>}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </span>
        <CaretRight
          size={16}
          className="shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>
    </li>
  );
}

/**
 * Admin payments: who paid each month, and any tenant's full schedule.
 * Opened from the Est. Revenue card in Tenant Monitoring.
 */
export function PaymentLedgerDialog({
  open,
  onOpenChange,
  adminId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminId?: string;
}) {
  const [tenants, setTenants] = useState<LedgerTenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RowFilter>("all");

  useEffect(() => {
    if (!open || !adminId) return;
    let alive = true;
    setError(null);
    getPaymentLedgerAction(adminId).then((res) => {
      if (!alive) return;
      if (res.success) setTenants(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [open, adminId]);

  // Reset to the month view each time it opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedId(null);
      setFilter("all");
      setMonth(monthKeyOf(new Date()));
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      !tenants || !q
        ? []
        : tenants.filter((t) =>
            [t.shopName, t.unitId, t.ownerName || "", t.ownerEmail || ""].some((v) => v.toLowerCase().includes(q)),
          ),
    [tenants, q],
  );
  // One match while searching opens that tenant's schedule directly.
  const selected =
    tenants?.find((t) => t.id === selectedId) || (q && matches.length === 1 ? matches[0] : null);

  const monthRows = useMemo(() => {
    if (!tenants) return { billed: [], unbilled: [] as LedgerTenant[] };
    const billed: { t: LedgerTenant; e: ScheduleEntry }[] = [];
    const unbilled: LedgerTenant[] = [];
    for (const t of tenants) {
      const inMonth = t.entries.filter((e) => monthKeyOf(new Date(e.dueDate)) === month);
      if (inMonth.length === 0) unbilled.push(t);
      for (const e of inMonth) billed.push({ t, e });
    }
    // Unpaid first, then by shop name.
    billed.sort((a, b) => Number(a.e.status === "PAID") - Number(b.e.status === "PAID") || a.t.shopName.localeCompare(b.t.shopName));
    return { billed, unbilled };
  }, [tenants, month]);

  const paidRows = monthRows.billed.filter((r) => r.e.status === "PAID");
  const dueRows = monthRows.billed.filter((r) => r.e.status !== "PAID");
  const overdueRows = dueRows.filter((r) => r.e.status === "OVERDUE");
  const sum = (rows: { e: ScheduleEntry }[]) => rows.reduce((s, r) => s + r.e.amount, 0);
  const billedTotal = sum(monthRows.billed);
  const paidPct = billedTotal > 0 ? Math.round((sum(paidRows) / billedTotal) * 100) : 0;
  const shownRows = filter === "paid" ? paidRows : filter === "unpaid" ? dueRows : monthRows.billed;
  const thisMonth = monthKeyOf(new Date());

  const filters: { id: RowFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: monthRows.billed.length },
    { id: "unpaid", label: "Not paid", count: dueRows.length },
    { id: "paid", label: "Paid", count: paidRows.length },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="xl" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-kumo-success-tint text-kumo-success">
              <Wallet size={20} weight="duotone" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl font-semibold tracking-tight text-kumo-default">
                Payments
              </Dialog.Title>
              <Dialog.Description className="text-sm text-kumo-subtle">
                Who has paid each month. Search a tenant to see their full schedule.
              </Dialog.Description>
            </div>
          </div>
          <Dialog.Close
            aria-label="Close"
            render={(props) => <Button {...props} variant="secondary" shape="square" icon={<X />} aria-label="Close" />}
          />
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-6">
          {/* Search, and the month stepper on the month view */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle"
              />
              <Input
                aria-label="Search tenants"
                placeholder="Search shop, owner or unit"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId(null);
                }}
                className="w-full pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setSelectedId(null);
                  }}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {!q && !selected && (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center rounded-lg border border-kumo-line sm:flex-none">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                    className="flex size-9 items-center justify-center rounded-l-lg text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
                  >
                    <CaretLeft size={16} />
                  </button>
                  <p className="min-w-36 flex-1 text-center text-sm font-semibold text-kumo-default" aria-live="polite">
                    {monthLabel(month)}
                  </p>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                    className="flex size-9 items-center justify-center rounded-r-lg text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
                  >
                    <CaretRight size={16} />
                  </button>
                </div>
                {month !== thisMonth && (
                  <Button variant="ghost" size="sm" onClick={() => setMonth(thisMonth)}>
                    This month
                  </Button>
                )}
              </div>
            )}
          </div>

          {error ? (
            <p className="py-10 text-center text-sm text-kumo-danger">{error}</p>
          ) : !tenants ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : selected ? (
            /* One tenant's schedule */
            <div className="space-y-5">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={() => {
                  setSelectedId(null);
                  if (q && matches.length === 1) setQuery("");
                }}
              >
                {q ? "All results" : "Back to month"}
              </Button>
              <div className="flex items-center gap-4 rounded-xl border border-kumo-line bg-kumo-recessed p-4">
                <ShopAvatar t={selected} large />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-kumo-default">{selected.shopName}</p>
                  <p className="truncate text-sm text-kumo-subtle">
                    Unit {selected.unitId}
                    {selected.ownerName ? ` · ${selected.ownerName}` : ""}
                  </p>
                </div>
              </div>
              <PaymentSchedule entries={selected.entries} emptyText="No bills issued to this tenant yet." />
            </div>
          ) : q ? (
            /* Search results */
            matches.length === 0 ? (
              <p className="py-10 text-center text-sm text-kumo-subtle">No tenant matches &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
              <ul className="divide-y divide-kumo-line overflow-hidden rounded-xl border border-kumo-line">
                {matches.map((t) => {
                  const now = t.entries.find((e) => monthKeyOf(new Date(e.dueDate)) === thisMonth);
                  return (
                    <TenantRow
                      key={t.id}
                      t={t}
                      meta={`Unit ${t.unitId} · ${t.entries.length} bill${t.entries.length === 1 ? "" : "s"}`}
                      badge={
                        now
                          ? { label: `This month: ${STATUS_BADGE[now.status].label}`, variant: STATUS_BADGE[now.status].variant }
                          : { label: "No bill this month", variant: "neutral" }
                      }
                      onOpen={() => setSelectedId(t.id)}
                    />
                  );
                })}
              </ul>
            )
          ) : (
            /* Month view */
            <div className="space-y-5">
              {/* Collection summary */}
              <div className="rounded-xl border border-kumo-line p-4 sm:p-5">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-kumo-subtle">Collected in {monthLabel(month)}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-kumo-default sm:text-3xl">
                      {peso(sum(paidRows))}
                      <span className="ml-2 text-sm font-normal text-kumo-subtle">of {peso(billedTotal)}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums text-kumo-success">{paidPct}%</p>
                </div>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-kumo-recessed"
                  role="progressbar"
                  aria-label="Share of this month's bills paid"
                  aria-valuenow={paidPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-kumo-success transition-[width] duration-500"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-kumo-line pt-4 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-kumo-subtle">
                      <span className="size-2 rounded-full bg-kumo-success" aria-hidden />
                      Paid
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-kumo-default">{paidRows.length}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-kumo-subtle">
                      <span className="size-2 rounded-full bg-kumo-line" aria-hidden />
                      Not paid
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-kumo-default">
                      {dueRows.length}
                      <span className="ml-1.5 font-normal text-kumo-subtle">{peso(sum(dueRows))}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-kumo-subtle">
                      <span className="size-2 rounded-full bg-kumo-danger" aria-hidden />
                      Overdue
                    </dt>
                    <dd
                      className={`mt-0.5 font-semibold tabular-nums ${overdueRows.length ? "text-kumo-danger" : "text-kumo-default"}`}
                    >
                      {overdueRows.length}
                    </dd>
                  </div>
                </dl>
              </div>

              {monthRows.billed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-kumo-line py-10 text-center text-sm text-kumo-subtle">
                  No bills are due in {monthLabel(month)}.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Filter */}
                  <div className="inline-flex rounded-lg bg-kumo-recessed p-1" role="tablist" aria-label="Show bills">
                    {filters.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        onClick={() => setFilter(f.id)}
                        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                          filter === f.id
                            ? "bg-kumo-base font-medium text-kumo-default shadow-sm"
                            : "text-kumo-subtle hover:text-kumo-default"
                        }`}
                      >
                        {f.label} <span className="tabular-nums text-kumo-subtle">{f.count}</span>
                      </button>
                    ))}
                  </div>

                  {shownRows.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-kumo-line py-8 text-center text-sm text-kumo-subtle">
                      {filter === "paid" ? "Nobody has paid for this month yet." : "Everyone has paid for this month."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-kumo-line overflow-hidden rounded-xl border border-kumo-line">
                      {shownRows.map(({ t, e }) => (
                        <TenantRow
                          key={e.id}
                          t={t}
                          meta={`Unit ${t.unitId} · ${
                            e.status === "PAID" && e.paidAt ? `Paid ${day(e.paidAt)}` : `Due ${day(e.dueDate)}`
                          }`}
                          metaTone={e.status === "OVERDUE" ? "danger" : undefined}
                          amount={e.amount}
                          badge={STATUS_BADGE[e.status]}
                          onOpen={() => setSelectedId(t.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {monthRows.unbilled.length > 0 && (
                <details className="group rounded-xl border border-dashed border-kumo-line text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-kumo-subtle hover:text-kumo-default [&::-webkit-details-marker]:hidden">
                    <span>
                      {monthRows.unbilled.length} tenant{monthRows.unbilled.length === 1 ? "" : "s"} with no bill in{" "}
                      {monthLabel(month)}
                    </span>
                    <CaretRight size={14} className="shrink-0 transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <ul className="divide-y divide-kumo-line border-t border-dashed border-kumo-line">
                    {monthRows.unbilled.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-kumo-tint"
                        >
                          <ShopAvatar t={t} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-kumo-default">{t.shopName}</span>
                            <span className="block truncate text-kumo-subtle">Unit {t.unitId}</span>
                          </span>
                          <CaretRight size={14} className="shrink-0 text-kumo-subtle" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
