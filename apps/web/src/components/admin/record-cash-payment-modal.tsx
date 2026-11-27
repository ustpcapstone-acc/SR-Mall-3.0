"use client";

import { useState } from "react";
import { Banner, Button } from "@cloudflare/kumo";
import { AdminDialog } from "@/components/admin/page-kit";
import { PaymentFields, todayPH, type PaymentState } from "@/components/leasing/shared";
import { approveSlipAction, recordPaymentAction } from "@/app/actions/finance";
import { peso } from "@/lib/leasing";

export interface CashPaymentInvoice {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  dueDate: string | Date;
  status: string;
  depositSlipUrl?: string | null;
}

/**
 * Accept a payment on one bill: money received at the office, or a deposit slip
 * being approved. Both save the amount, method, reference, date and who did it.
 * Shared by Tenant Monitoring and the dashboard.
 */
export function RecordCashPaymentModal({
  invoice,
  tenantName,
  mode = "record",
  onClose,
  onRecorded,
}: {
  invoice: CashPaymentInvoice;
  tenantName?: string | null;
  mode?: "record" | "approve";
  onClose: () => void;
  /** `note` says something staff should know, such as a lease that already ended. */
  onRecorded: (note?: string) => void;
}) {
  const approving = mode === "approve";
  const [payment, setPayment] = useState<PaymentState>(() => ({
    months: "1",
    amount: String(invoice.amount),
    paidOn: todayPH(),
    method: approving ? "Bank transfer" : "Cash",
    referenceNo: "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (!saving) onClose(); // never close mid-save
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const send = approving ? approveSlipAction : recordPaymentAction;
      const res = await send(invoice.id, {
        amount: Number(payment.amount),
        paidOn: payment.paidOn,
        method: payment.method,
        referenceNo: payment.referenceNo,
      });
      if (res.success) onRecorded(res.note);
      else setError(res.error);
    } catch {
      setError("Couldn't save the payment. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open
      onClose={close}
      title={approving ? "Approve deposit slip" : "Record payment"}
      description={[invoice.invoiceNumber, invoice.month, tenantName].filter(Boolean).join(", ")}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" variant="primary" loading={saving}>
            {approving ? "Approve payment" : "Record payment"}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <p className="text-sm text-kumo-default">
          Bill amount: <span className="font-semibold tabular-nums">{peso(invoice.amount)}</span>
        </p>
        {approving && invoice.depositSlipUrl && (
          <p className="text-sm">
            <a href={invoice.depositSlipUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-kumo-link hover:underline">
              View deposit slip
            </a>
            <span className="text-kumo-subtle">. Check it against the bank record before approving.</span>
          </p>
        )}
        <PaymentFields value={payment} onChange={setPayment} monthlyRent={invoice.amount} billAmount={invoice.amount} />
      </form>
    </AdminDialog>
  );
}
