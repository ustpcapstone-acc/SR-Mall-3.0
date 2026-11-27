/**
 * Rules for accepting, rejecting and voiding bill payments.
 * Safe to import from client and server code.
 */
import { PAYMENT_METHODS, peso } from "@/lib/leasing";
import { phDayStart } from "@/lib/ph-date";

/** What staff enter when they accept a payment. */
export type ReceiptForm = { amount: number; paidOn: string; method: string; referenceNo: string };

export type PaymentAction = "RECORDED" | "SLIP_APPROVED" | "SLIP_REJECTED" | "VOIDED" | "BILL_SENT" | "BILL_CANCELLED";

export const PAYMENT_ACTION_LABEL: Record<PaymentAction, string> = {
  RECORDED: "Payment recorded",
  SLIP_APPROVED: "Deposit slip approved",
  SLIP_REJECTED: "Deposit slip rejected",
  VOIDED: "Payment voided",
  BILL_SENT: "Bill sent",
  BILL_CANCELLED: "Bill cancelled",
};

/** One line of a bill's payment history. */
export type PaymentLogEntry = {
  id: string;
  invoiceId: string;
  action: PaymentAction;
  amount: number;
  method: string | null;
  referenceNo: string | null;
  paidOn: string | null;
  reason: string | null;
  slipUrl: string | null;
  actorName: string | null;
  createdAt: string;
};

export const REASON_LIMITS = { min: 3, max: 500 };

const cents = (value: number) => Math.round(value * 100);

/** The checked details of a full payment, or what is wrong with them. */
export function checkReceipt(form: ReceiptForm, billAmount: number, now = Date.now()) {
  const amount = Number(form?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount received.";
  if (cents(amount) !== cents(billAmount)) {
    return `The amount must match the bill, ${peso(billAmount)}. Part payments aren't supported.`;
  }
  const method = String(form?.method ?? "");
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return "Choose how they paid.";
  const referenceNo = String(form?.referenceNo ?? "").trim().slice(0, 100);
  if (!referenceNo) return "Enter the receipt or reference number.";
  const paidOn = String(form?.paidOn ?? "");
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? phDayStart(paidOn) : null;
  if (!paidAt || Number.isNaN(paidAt.getTime())) return "Enter the payment date.";
  if (paidAt.getTime() > now) return "The payment date can't be in the future.";
  return { amount: billAmount, method, referenceNo, paidAt };
}
