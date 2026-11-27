"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Loader, Select, Table, cn } from "@cloudflare/kumo";
import { ArrowClockwise, DownloadSimple } from "@phosphor-icons/react";
import { EmptyNote, Pager, Panel, Person, SearchField } from "@/components/admin/page-kit";
import { StatusText } from "@/components/leasing/shared";
import { getPaymentHistoryAction, type PaymentRecord, type PaymentState } from "@/app/actions/payment-schedule";
import { peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { useDebounced, usePageFor, useServerData } from "@/lib/use-server-page";
import { generateTenantReceiptPDF } from "@/utils/report-generator";

const STATUS_ITEMS: Record<string, string> = {
  PAID: "Paid",
  VERIFYING: "Being checked",
  DUE: "Due",
  OVERDUE: "Overdue",
  REJECTED: "Rejected",
  VOID: "Voided",
  ALL: "All statuses",
};

// StatusText colours by status name; a slip being checked reads as pending.
const TONE_KEY: Partial<Record<PaymentState, string>> = { VERIFYING: "PENDING" };

/** "2026-11" as "November 2026". */
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" });

/** Tenant Monitoring → Payment history: every tenant's invoices and payments. */
export function PaymentHistory() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("PAID");
  const [month, setMonth] = useState("ALL");
  const [receipt, setReceipt] = useState<string | null>(null);

  const search = useDebounced(query.trim());
  const [page, setPage] = usePageFor(search, status, month);
  const { data, error, loading, reload } = useServerData({ search, status, month, page }, getPaymentHistoryAction);
  const rows = data?.rows ?? [];
  const everything = data?.all ?? 0;
  const monthItems: Record<string, string> = {
    ALL: "All months",
    ...Object.fromEntries((data?.months ?? []).map((m) => [m, monthLabel(m)])),
  };

  const downloadReceipt = async (row: PaymentRecord) => {
    setReceipt(row.id);
    try {
      await generateTenantReceiptPDF(row, row);
    } catch (e) {
      console.error("Receipt download error:", e);
      toast.error("Couldn't create the receipt PDF.");
    } finally {
      setReceipt(null);
    }
  };

  return (
    <Panel
      flush
      title="Payment history"
      description={data ? `${everything} invoice${everything === 1 ? "" : "s"} on record` : "Every tenant's invoices and payments"}
      actions={
        <Button variant="secondary" icon={<ArrowClockwise />} loading={loading} onClick={reload}>
          Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-4 sm:px-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search shop, unit, invoice or reference" className="sm:w-80" />
        <Select aria-label="Status" value={status} items={STATUS_ITEMS} onValueChange={(v) => setStatus((v as string) || "ALL")} className="w-44">
          {Object.entries(STATUS_ITEMS).map(([value, label]) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
        <Select aria-label="Month" value={month} items={monthItems} onValueChange={(v) => setMonth((v as string) || "ALL")} className="w-48">
          {Object.entries(monthItems).map(([value, label]) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
        {data && data.total > 0 && (
          <p className="ml-auto text-sm text-kumo-subtle">
            Total of this list: <span className="font-semibold tabular-nums text-kumo-default">{peso(data.amount)}</span>
          </p>
        )}
      </div>

      {data && error && <p className="px-4 pt-3 text-sm text-kumo-danger sm:px-5">{error}</p>}

      {!data && loading ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : !data ? (
        <EmptyNote
          title="Couldn't load the payment history"
          action={
            <Button variant="primary" onClick={reload}>
              Try again
            </Button>
          }
        >
          {error}
        </EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote
          title={everything === 0 ? "No invoices yet" : "Nothing matches your filters"}
          action={
            everything > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("ALL");
                  setMonth("ALL");
                }}
              >
                Show all invoices
              </Button>
            ) : undefined
          }
        >
          {everything === 0 ? "Posted bills and recorded payments appear here." : "Try a different search, status or month."}
        </EmptyNote>
      ) : (
        <div aria-busy={loading} className={cn("overflow-x-auto", loading && "pointer-events-none opacity-60")}>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Date paid</Table.Head>
                <Table.Head>Shop</Table.Head>
                <Table.Head>Invoice</Table.Head>
                <Table.Head className="text-right">Amount</Table.Head>
                <Table.Head>Method</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head className="text-right">Receipt</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell className="whitespace-nowrap text-sm">
                    {r.paidAt ? (
                      <span className="text-kumo-default">{formatPHDate(r.paidAt)}</span>
                    ) : (
                      <span className="text-kumo-subtle">Due {formatPHDate(r.dueDate)}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Person square name={r.shopName || "New shop"} detail={r.unitId ? `Unit ${r.unitId}` : "No unit"} image={r.logoUrl} />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <p className="text-sm font-medium text-kumo-default">{r.invoiceNumber}</p>
                    <p className="text-sm text-kumo-subtle">{r.month}</p>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-kumo-default">
                    {peso(r.amount)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <p className="text-sm text-kumo-default">{r.method || (r.paidAt ? "Not recorded" : "Not paid yet")}</p>
                    {r.referenceNo && <p className="text-sm text-kumo-subtle">Ref {r.referenceNo}</p>}
                    {r.acceptedBy && <p className="text-sm text-kumo-subtle">By {r.acceptedBy}</p>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <StatusText status={TONE_KEY[r.state] ?? r.state} label={STATUS_ITEMS[r.state]} />
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {r.state === "PAID" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<DownloadSimple />}
                        loading={receipt === r.id}
                        onClick={() => downloadReceipt(r)}
                      >
                        Receipt
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      {data && <Pager page={loading ? page : data.page} total={data.total} onChange={setPage} />}
    </Panel>
  );
}
