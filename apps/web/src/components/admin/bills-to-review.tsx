"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Loader } from "@cloudflare/kumo";
import { PaperPlaneTilt, Plus, X } from "@phosphor-icons/react";
import { EmptyNote, Panel } from "@/components/admin/page-kit";
import { confirmAction } from "@/components/confirm-dialog";
import { getBillsToReviewAction, sendRentBillAction, skipRentBillAction, type RentDraftRow } from "@/app/actions/rent-bills";
import { CHARGE_LIMITS, billTotal, checkCharges } from "@/lib/rent-bills";
import { addDays, daysUntil, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { useServerData } from "@/lib/use-server-page";

type Charge = { key: number; description: string; amount: string };

const period = (d: RentDraftRow) => `${formatPHDate(d.periodStart)} to ${formatPHDate(addDays(d.periodEnd, -1))}`;

function dueText(d: RentDraftRow) {
  const days = daysUntil(d.periodStart);
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}, ${formatPHDate(d.periodStart)}`;
  if (days === 0) return "Due today";
  return `${-days} day${days === -1 ? "" : "s"} past due, ${formatPHDate(d.periodStart)}`;
}

const toCharges = (rows: Charge[]) => rows.map((c) => ({ description: c.description, amount: Number(c.amount) }));

/**
 * Rent bills the system prepared. Tenants see nothing until one is sent; other
 * charges (utilities and fees) are added here first.
 */
export function BillsToReview({ version, onSent }: { version: number; onSent: () => void }) {
  const { data, error, loading, reload } = useServerData(null, getBillsToReviewAction);
  // Charges typed but not yet sent, per draft.
  const [charges, setCharges] = useState<Record<string, Charge[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (version) void reload();
  }, [version, reload]);

  const rowsOf = (id: string) => charges[id] ?? [];
  const setRows = (id: string, next: Charge[]) => {
    setCharges((all) => ({ ...all, [id]: next }));
    // An earlier complaint about this bill no longer applies.
    setProblem((p) => (p?.id === id ? null : p));
  };

  const send = async (d: RentDraftRow) => {
    const result = await sendRentBillAction(d.id, toCharges(rowsOf(d.id)));
    if (result.success) setRows(d.id, []);
    return result;
  };

  const sendOne = async (d: RentDraftRow) => {
    const checked = checkCharges(toCharges(rowsOf(d.id)));
    if (typeof checked === "string") return setProblem({ id: d.id, text: checked });
    setBusy(d.id);
    setProblem(null);
    try {
      const result = await send(d);
      if (!result.success) setProblem({ id: d.id, text: result.error });
      else {
        toast.success(`Bill sent for Unit ${d.unitId}`);
        onSent();
      }
    } catch {
      setProblem({ id: d.id, text: "Couldn't send the bill. Check your connection." });
    } finally {
      setBusy(null);
      void reload();
    }
  };

  const sendAll = async (list: RentDraftRow[]) => {
    const bad = list.find((d) => typeof checkCharges(toCharges(rowsOf(d.id))) === "string");
    if (bad) return setProblem({ id: bad.id, text: checkCharges(toCharges(rowsOf(bad.id))) as string });
    const total = list.reduce((sum, d) => sum + billTotal(d.amount, toCharges(rowsOf(d.id))), 0);
    const ok = await confirmAction({
      title: `Send ${list.length} bills?`,
      description: `Tenants are told about them right away. Together they come to ${peso(total)}.`,
      confirmLabel: "Send bills",
    });
    if (!ok) return;
    setBusy("all");
    setProblem(null);
    let sent = 0;
    try {
      for (const d of list) {
        const result = await send(d);
        if (!result.success) {
          setProblem({ id: d.id, text: result.error });
          break;
        }
        sent++;
      }
    } catch {
      toast.error("The connection dropped. Check which bills were sent.");
    } finally {
      setBusy(null);
      if (sent) {
        toast.success(`${sent} bill${sent === 1 ? "" : "s"} sent`);
        onSent();
      }
      void reload();
    }
  };

  const skip = async (d: RentDraftRow, skipping: boolean) => {
    if (
      skipping &&
      !(await confirmAction({
        title: `Skip the bill for Unit ${d.unitId}?`,
        description: `No bill is sent for ${period(d)}. The rent is still due on the lease. You can bring it back.`,
        confirmLabel: "Skip bill",
      }))
    ) {
      return;
    }
    setBusy(d.id);
    try {
      const result = await skipRentBillAction(d.id, skipping);
      if (!result.success) toast.error(result.error);
    } catch {
      toast.error("Couldn't update the draft.");
    } finally {
      setBusy(null);
      void reload();
    }
  };

  const pending = data?.pending ?? [];

  return (
    <Panel
      flush
      title="Bills to review"
      description={
        data ? `Rent bills prepared ${data.daysBefore} days before the due date. Tenants see them only after you send them.` : "Rent bills prepared for review"
      }
      actions={
        pending.length > 1 ? (
          <Button variant="primary" icon={<PaperPlaneTilt />} loading={busy === "all"} disabled={busy !== null} onClick={() => sendAll(pending)}>
            Send all ({pending.length})
          </Button>
        ) : undefined
      }
    >
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <p className="text-sm text-kumo-danger">{error}</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      )}
      {!data ? (
        loading && (
          <div className="flex justify-center py-10">
            <Loader />
          </div>
        )
      ) : pending.length === 0 ? (
        <EmptyNote title="No bills to review">A draft appears here when a lease nears its paid-through date.</EmptyNote>
      ) : (
        <ul className="divide-y divide-kumo-line">
          {pending.map((d) => {
            const rows = rowsOf(d.id);
            return (
              <li key={d.id} className="space-y-3 p-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-kumo-default wrap-anywhere">
                      {d.shopName}, Unit {d.unitId}
                    </p>
                    <p className="text-sm text-kumo-subtle">Rent for {period(d)}</p>
                    <p className={daysUntil(d.periodStart) < 0 ? "text-sm font-medium text-kumo-danger" : "text-sm text-kumo-subtle"}>{dueText(d)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-base font-semibold tabular-nums text-kumo-default">{peso(billTotal(d.amount, toCharges(rows)))}</p>
                    <p className="text-sm text-kumo-subtle">Rent {peso(d.amount)}</p>
                  </div>
                </div>

                {rows.map((c, i) => (
                  <div key={c.key} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <Input
                        aria-label={`Charge ${i + 1} name`}
                        placeholder="e.g. Electricity"
                        value={c.description}
                        maxLength={CHARGE_LIMITS.description}
                        onChange={(e) => setRows(d.id, rows.map((x) => (x.key === c.key ? { ...x, description: e.target.value } : x)))}
                        className="w-full"
                      />
                    </div>
                    <Input
                      aria-label={`Charge ${i + 1} amount in pesos`}
                      placeholder="Amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={c.amount}
                      onChange={(e) => setRows(d.id, rows.map((x) => (x.key === c.key ? { ...x, amount: e.target.value } : x)))}
                      className="w-32"
                    />
                    <Button variant="secondary" shape="square" icon={<X />} aria-label={`Remove charge ${i + 1}`} onClick={() => setRows(d.id, rows.filter((x) => x.key !== c.key))} />
                  </div>
                ))}

                {problem?.id === d.id && (
                  <p role="alert" className="text-sm text-kumo-danger">
                    {problem.text}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus />}
                    disabled={rows.length >= CHARGE_LIMITS.rows}
                    onClick={() => setRows(d.id, [...rows, { key: Date.now(), description: "", amount: "" }])}
                  >
                    Add charge
                  </Button>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => skip(d, true)}>
                      Skip
                    </Button>
                    <Button size="sm" variant="primary" loading={busy === d.id} disabled={busy !== null} onClick={() => sendOne(d)}>
                      Send bill
                    </Button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.skipped.length > 0 && (
        <div className="border-t border-kumo-line p-4 sm:px-5">
          <h3 className="text-sm font-semibold text-kumo-default">Skipped</h3>
          <ul className="mt-2 space-y-2">
            {data.skipped.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-kumo-subtle wrap-anywhere">
                  {d.shopName}, Unit {d.unitId}, {period(d)}. Skipped by {d.skippedBy}.
                </p>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => skip(d, false)}>
                  Bring back
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
