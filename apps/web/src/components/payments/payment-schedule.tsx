"use client";

import { useState } from "react";
import { Badge, Button } from "@cloudflare/kumo";
import { CaretDown, Check, Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import type { ScheduleEntry, ScheduleStatus } from "@/app/actions/payment-schedule";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

const BADGE: Record<ScheduleStatus, { label: string; variant: "success" | "neutral" | "error" | "warning" }> = {
  PAID: { label: "Paid", variant: "success" },
  DUE: { label: "Due", variant: "neutral" },
  OVERDUE: { label: "Overdue", variant: "error" },
  VERIFYING: { label: "Verifying", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "error" },
};

/** Circle marker on the timeline. */
function Marker({ status }: { status: ScheduleStatus }) {
  if (status === "PAID") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kumo-success-tint text-kumo-success">
        <Check size={14} weight="bold" />
      </span>
    );
  }
  if (status === "OVERDUE" || status === "REJECTED") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kumo-danger-tint text-kumo-danger">
        <Warning size={14} weight="bold" />
      </span>
    );
  }
  return <span className="size-7 shrink-0 rounded-full border-2 border-kumo-line bg-kumo-base" />;
}

function Row({ entry, last }: { entry: ScheduleEntry; last: boolean }) {
  const [open, setOpen] = useState(false);
  const badge = BADGE[entry.status];
  const panelId = `sched-${entry.id}`;
  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* Timeline line + marker */}
      <div className="flex flex-col items-center">
        <Marker status={entry.status} />
        {!last && <span className="mt-1 w-px flex-1 bg-kumo-line" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-kumo-focus"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-kumo-default">{day(entry.dueDate)}</span>
            <span className="block text-sm text-kumo-subtle">
              {entry.index} of {entry.total} · {entry.month}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-base font-semibold tabular-nums text-kumo-default">{peso(entry.amount)}</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
          <CaretDown
            size={18}
            className={`mt-1 shrink-0 text-kumo-subtle transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open && (
          <dl
            id={panelId}
            className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-kumo-recessed p-3 text-sm"
          >
            <dt className="text-kumo-subtle">Invoice</dt>
            <dd className="text-kumo-default">{entry.invoiceNumber}</dd>
            <dt className="text-kumo-subtle">Billing month</dt>
            <dd className="text-kumo-default">{entry.month}</dd>
            <dt className="text-kumo-subtle">Due date</dt>
            <dd className="text-kumo-default">{day(entry.dueDate)}</dd>
            <dt className="text-kumo-subtle">Paid on</dt>
            <dd className="text-kumo-default">{entry.paidAt ? day(entry.paidAt) : "Not paid yet"}</dd>
            {entry.referenceNo && (
              <>
                <dt className="text-kumo-subtle">Reference</dt>
                <dd className="break-all text-kumo-default">{entry.referenceNo}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </li>
  );
}

/**
 * A tenant's payment schedule as a timeline: instalments to pay first, then
 * paid ones (which can be hidden). Works on phone and desktop widths.
 */
export function PaymentSchedule({ entries, emptyText = "No bills yet." }: { entries: ScheduleEntry[]; emptyText?: string }) {
  const [hidePaid, setHidePaid] = useState(false);
  const unpaid = entries.filter((e) => e.status !== "PAID");
  const paid = entries.filter((e) => e.status === "PAID").reverse(); // newest paid first
  const paidTotal = paid.reduce((s, e) => s + e.amount, 0);
  const dueTotal = unpaid.reduce((s, e) => s + e.amount, 0);

  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-kumo-subtle">{emptyText}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-kumo-recessed p-3">
          <p className="text-xs text-kumo-subtle">Paid</p>
          <p className="text-lg font-semibold tabular-nums text-kumo-default">{peso(paidTotal)}</p>
        </div>
        <div className="rounded-lg bg-kumo-recessed p-3">
          <p className="text-xs text-kumo-subtle">To pay</p>
          <p className="text-lg font-semibold tabular-nums text-kumo-default">{peso(dueTotal)}</p>
        </div>
      </div>

      {paid.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          icon={hidePaid ? <Eye size={16} /> : <EyeSlash size={16} />}
          onClick={() => setHidePaid((h) => !h)}
          aria-pressed={hidePaid}
        >
          {hidePaid ? "Show paid" : "Hide paid"}
        </Button>
      )}

      {unpaid.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-kumo-default">To pay</h3>
          <ol>
            {unpaid.map((e, i) => (
              <Row key={e.id} entry={e} last={i === unpaid.length - 1} />
            ))}
          </ol>
        </section>
      )}

      {!hidePaid && paid.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-kumo-default">Paid</h3>
          <ol>
            {paid.map((e, i) => (
              <Row key={e.id} entry={e} last={i === paid.length - 1} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
