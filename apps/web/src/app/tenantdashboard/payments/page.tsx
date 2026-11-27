"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, Loader, Select, Table } from "@cloudflare/kumo";
import { DownloadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { generatePaymentHistoryPDF } from "@/utils/report-generator";
import { getSpacePaymentsAction, type PaymentStatusFilter } from "@/app/actions/workspace";
import { STAGE_LABEL, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { InvoiceButton, StatusText } from "@/components/leasing/shared";
import { BillsToPay } from "@/components/payments/bills-to-pay";
import { MyScheduleButton } from "@/components/payments/my-schedule-dialog";
import { useAuth } from "@/app/providers";

type Result = Awaited<ReturnType<typeof getSpacePaymentsAction>>;
type Data = NonNullable<Extract<Result, { success: true }>["data"]>;

const STATUS_ITEMS: Record<PaymentStatusFilter, string> = {
  ALL: "All statuses",
  PAID: "Paid",
  DUE: "Due",
  OVERDUE: "Overdue",
  VOID: "Void",
};
const SORT_ITEMS = { newest: "Newest first", oldest: "Oldest first" };

export default function PaymentsPage() {
  const { user } = useAuth();
  // Bumped after a deposit slip is sent, to reload the page's data.
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ data: Data | null; error: string | null } | null>(null);
  const [status, setStatus] = useState<PaymentStatusFilter>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /** Every invoice of this space as a PDF, whatever the filters on screen. */
  const downloadReport = async () => {
    setExporting(true);
    try {
      const res = await getSpacePaymentsAction({ all: true });
      if (!res.success || !res.data) {
        toast.error(res.success ? "There's nothing to report yet." : res.error);
        return;
      }
      const { rows, shopName, space } = res.data;
      if (rows.length === 0) {
        toast.error("There are no invoices to report yet.");
        return;
      }
      await generatePaymentHistoryPDF(
        { shopName: shopName || "New shop", units: space?.unitId ?? "All units" },
        rows.map((r) => ({ ...r, dueDate: r.date, status: r.reportStatus })),
      );
    } catch (e) {
      console.error("Payment report error:", e);
      toast.error("Couldn't create the report. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let alive = true;
    getSpacePaymentsAction({ page, sort, status }).then((res) => {
      if (!alive) return;
      setLoading(false);
      setResult(res.success ? { data: res.data, error: null } : { data: null, error: res.error });
    });
    return () => {
      alive = false;
    };
  }, [page, sort, status, version]);

  const change = (fn: () => void) => {
    setLoading(true);
    fn();
  };

  if (!result) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="mx-auto max-w-6xl p-6 sm:p-8">
        <Banner variant="error" description={result.error} />
      </div>
    );
  }
  const d = result.data;
  if (!d) return null;
  const space = d.space;
  const late = space && (space.stage === "DUE" || space.stage === "GRACE" || space.stage === "OVERDUE");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Payments</h1>
          <p className="mt-1 text-sm text-kumo-subtle">
            {space ? `Unit ${space.unitId}. ` : ""}See what you owe, how to pay it, and your receipts.
          </p>
        </div>
        <MyScheduleButton userId={user?.id} />
      </header>

      {space && late && (
        <Banner
          variant="error"
          description={`Rent was due ${formatPHDate(space.paidThrough)}. Pay by ${formatPHDate(space.graceEnds)} to keep this space.`}
        />
      )}

      {d.bills.length > 0 && <BillsToPay bills={d.bills} onSubmitted={() => setVersion((v) => v + 1)} />}

      {space ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
            <p className="text-sm text-kumo-subtle">Next payment due</p>
            <p className="mt-1 text-xl font-semibold text-kumo-default">{formatPHDate(space.paidThrough)}</p>
            <p className="mt-1">
              <StatusText status={space.stage} label={STAGE_LABEL[space.stage]} />
            </p>
          </div>
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
            <p className="text-sm text-kumo-subtle">Next amount due</p>
            <p className="mt-1 text-xl font-semibold text-kumo-default">{peso(space.monthlyRent)}</p>
            <p className="mt-1 text-sm text-kumo-subtle">One month of rent, paid at the management office</p>
          </div>
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
            <p className="text-sm text-kumo-subtle">Lease</p>
            <p className="mt-1 text-xl font-semibold text-kumo-default">Unit {space.unitId}</p>
            <p className="mt-1 text-sm text-kumo-subtle">
              Since {formatPHDate(space.startDate)}. {peso(space.totalPaid)} paid in total.
            </p>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-kumo-line bg-kumo-base p-5 text-sm text-kumo-subtle">
          Rent details show for one space at a time. Choose a space from the workspace menu, or{" "}
          <Link href="/tenantdashboard/rent-a-space" className="text-kumo-link hover:underline">
            rent a space
          </Link>
          .
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-kumo-default">Payment history</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<DownloadSimple />} loading={exporting} onClick={downloadReport}>
              Payment History Report
            </Button>
            <Select
              aria-label="Status"
              value={status}
              items={STATUS_ITEMS}
              onValueChange={(v) => change(() => (setStatus((v as PaymentStatusFilter) || "ALL"), setPage(1)))}
              className="min-w-40"
            >
              {Object.entries(STATUS_ITEMS).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v}
                </Select.Option>
              ))}
            </Select>
            <Select
              aria-label="Sort"
              value={sort}
              items={SORT_ITEMS}
              onValueChange={(v) => change(() => (setSort(v === "oldest" ? "oldest" : "newest"), setPage(1)))}
              className="min-w-40"
            >
              {Object.entries(SORT_ITEMS).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        <div className={`overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base ${loading ? "opacity-60" : ""}`}>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Date</Table.Head>
                <Table.Head>Invoice</Table.Head>
                <Table.Head>Description</Table.Head>
                <Table.Head className="text-right">Amount</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head className="text-right">Receipt</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {d.rows.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6} className="py-8 text-center text-sm text-kumo-subtle">
                    No invoices{status === "ALL" ? " yet" : " with this status"}.
                  </Table.Cell>
                </Table.Row>
              ) : (
                d.rows.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell className="text-sm text-kumo-default">{formatPHDate(r.date)}</Table.Cell>
                    <Table.Cell className="text-sm font-medium text-kumo-default">{r.invoiceNumber}</Table.Cell>
                    <Table.Cell>
                      <p className="text-sm text-kumo-default">{r.description}</p>
                      {r.paidAt && (
                        <p className="text-xs text-kumo-subtle">
                          Paid {formatPHDate(r.paidAt)}
                          {r.method ? ` by ${r.method}` : ""}
                        </p>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right text-sm text-kumo-default">{peso(r.amount)}</Table.Cell>
                    <Table.Cell>
                      {r.checking ? <StatusText status="PENDING" label="Being checked" /> : <StatusText status={r.status} />}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <InvoiceButton invoiceId={r.id} />
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-kumo-subtle">
          <span>
            {d.total} invoice{d.total === 1 ? "" : "s"}
          </span>
          {d.pages > 1 && (
            <div className="flex items-center gap-3">
              <span>
                Page {d.page} of {d.pages}
              </span>
              <Button size="sm" variant="secondary" disabled={d.page <= 1} onClick={() => change(() => setPage(d.page - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={d.page >= d.pages} onClick={() => change(() => setPage(d.page + 1))}>
                Next
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
