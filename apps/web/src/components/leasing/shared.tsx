"use client";

/** Pieces shared by the Rent Requests, Renewals and tenant Rent a Space pages. */
import { useState } from "react";
import { Button, Dialog, Input, Select } from "@cloudflare/kumo";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PAYMENT_METHODS, peso } from "@/lib/leasing";
import { toPHDateInput } from "@/lib/ph-date";
import type { PaymentForm } from "@/app/actions/leasing";

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <Dialog.Title className="text-lg font-semibold text-kumo-default">{title}</Dialog.Title>
        {description && <Dialog.Description className="text-sm text-kumo-subtle">{description}</Dialog.Description>}
      </div>
      <Dialog.Close
        aria-label="Close"
        render={(props) => <Button {...props} variant="secondary" shape="square" icon={<X />} aria-label="Close" />}
      />
    </div>
  );
}

const TONE: Record<string, string> = {
  PENDING: "text-kumo-warning",
  APPROVED: "text-kumo-success",
  REJECTED: "text-kumo-danger",
  CANCELLED: "text-kumo-subtle",
  PAID: "text-kumo-success",
  DUE: "text-kumo-warning",
  OVERDUE: "text-kumo-danger",
  VOID: "text-kumo-subtle",
  ACTIVE: "text-kumo-success",
  UPCOMING: "text-kumo-default",
  GRACE: "text-kumo-danger",
  ENDED: "text-kumo-subtle",
};

/** Status as plain coloured text. */
export function StatusText({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`text-sm font-medium ${TONE[status] ?? "text-kumo-default"}`}>{text}</span>;
}

export const todayPH = () => toPHDateInput(new Date());

export type PaymentState = {
  months: string;
  amount: string;
  paidOn: string;
  method: string;
  referenceNo: string;
};

export function initialPayment(months: number, monthlyRent: number): PaymentState {
  return { months: String(months), amount: String(monthlyRent * months), paidOn: todayPH(), method: "Cash", referenceNo: "" };
}

export function toPaymentForm(p: PaymentState): PaymentForm {
  return { months: Number(p.months), amount: Number(p.amount), paidOn: p.paidOn, method: p.method, referenceNo: p.referenceNo };
}

const METHOD_ITEMS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, m]));

/**
 * Months covered, amount received, payment date, method and reference. The
 * amount follows months x rent until staff type their own figure.
 */
export function PaymentFields({
  value,
  onChange,
  monthlyRent,
  monthsLabel = "Months paid",
  billAmount,
  extra = 0,
}: {
  value: PaymentState;
  onChange: (next: PaymentState) => void;
  monthlyRent: number;
  monthsLabel?: string;
  /** Paying one bill in full: no months to choose, and a reference is needed. */
  billAmount?: number;
  /** Charges beyond rent that the amount also has to cover (an open bill). */
  extra?: number;
}) {
  const [amountEdited, setAmountEdited] = useState(false);
  const set = (patch: Partial<PaymentState>) => onChange({ ...value, ...patch });
  const months = Number(value.months) || 0;
  const oneBill = billAmount !== undefined;

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {!oneBill && (
        <Input
          label={monthsLabel}
          type="number"
          min={1}
          max={60}
          value={value.months}
          onChange={(e) => {
            const m = e.target.value;
            set(amountEdited ? { months: m } : { months: m, amount: String(Math.round(((Number(m) || 0) * monthlyRent + extra) * 100) / 100) });
          }}
          required
        />
      )}
      <Input
        label="Amount received (PHP)"
        type="number"
        min={0}
        step="0.01"
        value={value.amount}
        description={
          oneBill
            ? "Must match the bill."
            : months > 0
              ? `${months} x ${peso(monthlyRent)}${extra ? ` + ${peso(extra)} other charges` : ""} = ${peso(months * monthlyRent + extra)}`
              : undefined
        }
        onChange={(e) => {
          setAmountEdited(true);
          set({ amount: e.target.value });
        }}
        required
      />
      <Input label="Payment date" type="date" max={todayPH()} value={value.paidOn} onChange={(e) => set({ paidOn: e.target.value })} required />
      <Select
        label="Payment method"
        value={value.method}
        items={METHOD_ITEMS}
        onValueChange={(v) => set({ method: (v as string) || "Cash" })}
        className="w-full"
      >
        {PAYMENT_METHODS.map((m) => (
          <Select.Option key={m} value={m}>
            {m}
          </Select.Option>
        ))}
      </Select>
      <div className="grid sm:col-span-2">
        <Input
          label="Reference or OR number"
          description={oneBill ? undefined : "Optional"}
          required={oneBill}
          value={value.referenceNo}
          maxLength={100}
          onChange={(e) => set({ referenceNo: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Button that builds and downloads an e-invoice PDF. */
export function InvoiceButton({ invoiceId, label = "PDF", size = "sm" }: { invoiceId: string; label?: string; size?: "sm" | "base" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      variant="secondary"
      icon={<DownloadSimple />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const { downloadInvoicePdf } = await import("@/lib/invoice-pdf");
        const error = await downloadInvoicePdf(invoiceId).catch(() => "Couldn't build the PDF.");
        setBusy(false);
        if (error) toast.error(error);
      }}
    >
      {label}
    </Button>
  );
}
