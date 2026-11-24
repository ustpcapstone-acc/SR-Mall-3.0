"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, Input, Loader } from "@cloudflare/kumo";
import { ArrowLeft, CaretLeft, CaretRight, MagnifyingGlass, Storefront, X } from "@phosphor-icons/react";
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

function ShopAvatar({ t }: { t: LedgerTenant }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-recessed text-kumo-subtle">
      {t.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <Storefront size={18} />
      )}
    </span>
  );
}

const STATUS_BADGE: Record<ScheduleEntry["status"], { label: string; variant: "success" | "neutral" | "error" | "warning" }> = {
  PAID: { label: "Paid", variant: "success" },
  DUE: { label: "Due", variant: "neutral" },
  OVERDUE: { label: "Overdue", variant: "error" },
  VERIFYING: { label: "Verifying", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "error" },
};

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
  const sum = (rows: { e: ScheduleEntry }[]) => rows.reduce((s, r) => s + r.e.amount, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="xl" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-5 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-xl font-semibold text-kumo-default">Payments</Dialog.Title>
            <Dialog.Description className="text-sm text-kumo-subtle">
              Who has paid each month. Search a tenant to see their full schedule.
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="Close"
            render={(props) => <Button {...props} variant="secondary" shape="square" icon={<X />} aria-label="Close" />}
          />
        </div>

        <div className="relative mb-5">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle" />
          <Input
            aria-label="Search tenants"
            placeholder="Search shop, owner or unit"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            className="w-full pl-9"
          />
        </div>

        {error ? (
          <p className="py-10 text-center text-sm text-kumo-danger">{error}</p>
        ) : !tenants ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : selected ? (
          /* ── One tenant's schedule ─────────────────────────────────── */
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
            <div className="flex items-center gap-3">
              <ShopAvatar t={selected} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-kumo-default">{selected.shopName}</p>
                <p className="truncate text-sm text-kumo-subtle">
                  Unit {selected.unitId}
                  {selected.ownerName ? ` · ${selected.ownerName}` : ""}
                </p>
              </div>
            </div>
            <PaymentSchedule entries={selected.entries} emptyText="No bills issued to this tenant yet." />
          </div>
        ) : q ? (
          /* ── Search results ─────────────────────────────────────────── */
          matches.length === 0 ? (
            <p className="py-10 text-center text-sm text-kumo-subtle">No tenant matches “{query.trim()}”.</p>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {matches.map((t) => {
                const thisMonth = t.entries.find((e) => monthKeyOf(new Date(e.dueDate)) === monthKeyOf(new Date()));
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-kumo-focus"
                    >
                      <ShopAvatar t={t} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-kumo-default">{t.shopName}</span>
                        <span className="block truncate text-sm text-kumo-subtle">
                          Unit {t.unitId} · {t.entries.length} bill{t.entries.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      {thisMonth ? (
                        <Badge variant={STATUS_BADGE[thisMonth.status].variant}>
                          This month: {STATUS_BADGE[thisMonth.status].label}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">No bill this month</Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          /* ── Month view ─────────────────────────────────────────────── */
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <Button variant="secondary" shape="square" icon={<CaretLeft />} aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} />
              <p className="text-base font-semibold text-kumo-default">{monthLabel(month)}</p>
              <Button variant="secondary" shape="square" icon={<CaretRight />} aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-kumo-success-tint p-3">
                <p className="text-xs text-kumo-success">Paid · {paidRows.length}</p>
                <p className="text-lg font-semibold tabular-nums text-kumo-default">{peso(sum(paidRows))}</p>
              </div>
              <div className="rounded-lg bg-kumo-recessed p-3">
                <p className="text-xs text-kumo-subtle">Not paid · {dueRows.length}</p>
                <p className="text-lg font-semibold tabular-nums text-kumo-default">{peso(sum(dueRows))}</p>
              </div>
            </div>

            {monthRows.billed.length === 0 ? (
              <p className="py-8 text-center text-sm text-kumo-subtle">No bills are due in {monthLabel(month)}.</p>
            ) : (
              <ul className="divide-y divide-kumo-line">
                {monthRows.billed.map(({ t, e }) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-kumo-focus"
                    >
                      <ShopAvatar t={t} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-kumo-default">{t.shopName}</span>
                        <span className="block truncate text-sm text-kumo-subtle">
                          Unit {t.unitId} · {e.status === "PAID" && e.paidAt ? `Paid ${day(e.paidAt)}` : `Due ${day(e.dueDate)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-semibold tabular-nums text-kumo-default">{peso(e.amount)}</span>
                        <Badge variant={STATUS_BADGE[e.status].variant}>{STATUS_BADGE[e.status].label}</Badge>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {monthRows.unbilled.length > 0 && (
              <details className="rounded-lg bg-kumo-recessed p-3 text-sm">
                <summary className="cursor-pointer text-kumo-subtle">
                  {monthRows.unbilled.length} tenant{monthRows.unbilled.length === 1 ? "" : "s"} with no bill in {monthLabel(month)}
                </summary>
                <ul className="mt-2 space-y-1">
                  {monthRows.unbilled.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSelectedId(t.id)} className="text-kumo-link hover:underline">
                        {t.shopName}
                      </button>
                      <span className="text-kumo-subtle"> · Unit {t.unitId}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
