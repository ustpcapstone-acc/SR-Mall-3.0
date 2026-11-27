"use client";

import { useState } from "react";
import { Banner, Button, InputArea } from "@cloudflare/kumo";
import { AdminDialog } from "@/components/admin/page-kit";
import { rejectSlipAction, voidPaymentAction } from "@/app/actions/finance";
import { cancelRentBillAction } from "@/app/actions/rent-bills";
import { peso } from "@/lib/leasing";
import { PAYMENT_ACTION_LABEL, REASON_LIMITS, type PaymentLogEntry } from "@/lib/payments";
import { formatPHDate, formatPHDateTime } from "@/lib/ph-date";

const REASON_TEXT = {
  reject: { title: "Reject this deposit slip?", button: "Reject slip", action: rejectSlipAction },
  void: { title: "Void this payment?", button: "Void payment", action: voidPaymentAction },
  cancel: { title: "Cancel this rent bill?", button: "Cancel bill", action: cancelRentBillAction },
} as const;

/** Reject a deposit slip, void a payment, or cancel a rent bill. Each needs a reason. */
export function BillReasonDialog({
  invoice,
  mode,
  tenantName,
  onClose,
  onDone,
}: {
  invoice: { id: string; invoiceNumber: string; month: string; amount: number; periodStart?: unknown };
  mode: "reject" | "void" | "cancel";
  tenantName?: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = REASON_TEXT[mode];

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await text.action(invoice.id, reason);
      if (res.success) onDone();
      else setError(res.error);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open
      onClose={close}
      title={text.title}
      description={[invoice.invoiceNumber, invoice.month, tenantName].filter(Boolean).join(", ")}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={close}>
            {mode === "cancel" ? "Keep the bill" : "Cancel"}
          </Button>
          <Button type="submit" form="bill-reason-form" variant="destructive" loading={saving} disabled={reason.trim().length < REASON_LIMITS.min}>
            {text.button}
          </Button>
        </>
      }
    >
      <form id="bill-reason-form" onSubmit={submit} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <p className="text-sm text-kumo-default">
          {mode === "void"
            ? `The bill for ${peso(invoice.amount)} goes back to unpaid. The payment stays in its history.`
            : mode === "cancel"
              ? `The tenant no longer owes ${peso(invoice.amount)} on this bill. It returns to Bills to review, so you can correct and send it again.`
              : "The bill goes back to unpaid and the tenant can upload a new slip."}
          {mode === "void" && invoice.periodStart ? " For a rent bill, the lease goes back to the start of its period." : ""}
        </p>
        <InputArea
          label="Reason"
          description="The tenant will see this."
          value={reason}
          onValueChange={setReason}
          maxLength={REASON_LIMITS.max}
          rows={3}
          required
          className="w-full"
        />
      </form>
    </AdminDialog>
  );
}

/** Who did what to one bill, newest first. */
export function BillHistory({ entries }: { entries: PaymentLogEntry[] }) {
  if (!entries.length) return null;
  return (
    <ul aria-label="Payment history of this bill" className="space-y-1.5 border-l-2 border-kumo-line pl-3">
      {entries.map((e) => (
        <li key={e.id} className="text-xs text-kumo-subtle wrap-anywhere">
          <span className="font-medium text-kumo-default">{PAYMENT_ACTION_LABEL[e.action] ?? e.action}</span> by{" "}
          {e.actorName || "staff"}, {formatPHDateTime(e.createdAt)}
          {(e.method || e.referenceNo || e.paidOn) && (
            <span className="block">
              {[
                peso(e.amount),
                e.method,
                e.referenceNo && `Ref ${e.referenceNo}`,
                e.paidOn && `paid ${formatPHDate(e.paidOn)}`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {e.reason && <span className="block">Reason: {e.reason}</span>}
          {e.slipUrl && (
            <a href={e.slipUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-kumo-link hover:underline">
              View that slip
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
