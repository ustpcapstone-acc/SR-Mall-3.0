/**
 * The daily collection report: money received on one day, to match against the
 * cash on hand and the bank record. Safe to import from client and server code.
 */
import { PAYMENT_METHODS } from "@/lib/leasing";

export type CollectionRow = {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  method: string | null;
  referenceNo: string | null;
  /** Staff member who accepted it (none for older records). */
  acceptedBy: string | null;
  shopName: string;
  unitId: string | null;
};

/** A payment voided on the day, whenever it was first received. */
export type VoidedRow = {
  id: string;
  invoiceNumber: string;
  shopName: string;
  amount: number;
  method: string | null;
  referenceNo: string | null;
  reason: string | null;
  actorName: string | null;
};

export type CollectionReport = {
  /** "YYYY-MM-DD", a Philippine calendar day. */
  date: string;
  rows: CollectionRow[];
  voided: VoidedRow[];
};

export const NO_METHOD = "Not recorded";

/** Added in centavos, so long lists don't drift by a fraction. */
export const sumAmounts = (rows: { amount: number }[]) => rows.reduce((total, r) => total + Math.round(r.amount * 100), 0) / 100;

/** One line per payment method. Cash is always listed, even when nothing came in. */
export function totalsByMethod(rows: CollectionRow[]) {
  const methodOf = (r: CollectionRow) => r.method?.trim() || NO_METHOD;
  const known: string[] = [...PAYMENT_METHODS];
  const others = [...new Set(rows.map(methodOf))].filter((m) => !known.includes(m));
  return [...known, ...others]
    .map((method) => {
      const list = rows.filter((r) => methodOf(r) === method);
      return { method, count: list.length, amount: sumAmounts(list) };
    })
    .filter((line) => line.count > 0 || line.method === "Cash");
}

/** One spreadsheet cell. Text that a spreadsheet would run as a formula is kept as text. */
function cell(value: unknown) {
  if (typeof value === "number") return value.toFixed(2);
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The report as a CSV file that Excel and Google Sheets open directly. */
export function collectionCsv(report: CollectionReport) {
  const lines: unknown[][] = [
    ["Daily collection report"],
    ["Date", report.date],
    [],
    ["Method", "Payments", "Amount (PHP)"],
    ...totalsByMethod(report.rows).map((t) => [t.method, String(t.count), t.amount]),
    ["Total", String(report.rows.length), sumAmounts(report.rows)],
    [],
    ["Shop", "Unit", "Invoice", "For", "Method", "Reference", "Accepted by", "Amount (PHP)"],
    ...report.rows.map((r) => [
      r.shopName,
      r.unitId ?? "",
      r.invoiceNumber,
      r.month,
      r.method || NO_METHOD,
      r.referenceNo ?? "",
      r.acceptedBy ?? "",
      r.amount,
    ]),
  ];
  if (report.voided.length) {
    lines.push(
      [],
      ["Payments voided on this day (not counted above)"],
      ["Shop", "Invoice", "Method", "Reference", "Voided by", "Reason", "Amount (PHP)"],
      ...report.voided.map((v) => [v.shopName, v.invoiceNumber, v.method ?? "", v.referenceNo ?? "", v.actorName ?? "", v.reason ?? "", v.amount]),
    );
  }
  // The byte order mark makes Excel read names with accents correctly.
  return "﻿" + lines.map((line) => line.map(cell).join(",")).join("\r\n");
}
