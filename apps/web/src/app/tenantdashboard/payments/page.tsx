"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, Loader, Select, Table } from "@cloudflare/kumo";
import { getSpacePaymentsAction, type PaymentStatusFilter } from "@/app/actions/workspace";
import { STAGE_LABEL, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { InvoiceButton, StatusText } from "@/components/leasing/shared";

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
  const [result, setResult] = useState<{ data: Data | null; error: string | null } | null>(null);
  const [status, setStatus] = useState<PaymentStatusFilter>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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
  }, [page, sort, status]);

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
  if (!d) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-kumo-default">Payments</h1>
        <p className="text-sm text-kumo-subtle">
          Payments belong to a space. Choose a space from the workspace menu, or{" "}
          <Link href="/tenantdashboard/rent-a-space" className="text-kumo-link hover:underline">
            rent a space
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  const late = d.stage === "DUE" || d.stage === "GRACE" || d.stage === "OVERDUE";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl font-semibold text-kumo-default">Payments</h1>
        <p className="mt-1 text-sm text-kumo-subtle">Unit {d.unitId}. Rent is paid at the SR Mall management office.</p>
      </header>

      {late && (
        <Banner
          variant="error"
          description={`Rent was due ${formatPHDate(d.paidThrough)}. Pay by ${formatPHDate(d.graceEnds)} to keep this space.`}
        />
      )}
      {d.outstandingCount > 0 && (
        <Banner
          variant="default"
          description={
            <span>
              You have {d.outstandingCount} unpaid bill{d.outstandingCount === 1 ? "" : "s"} ({peso(d.outstanding)}).{" "}
              <Link href="/tenantdashboard/lease-payments" className="text-kumo-link hover:underline">
                Upload a deposit slip
              </Link>{" "}
              if you paid by bank deposit.
            </span>
          }
        />
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Next payment due</p>
          <p className="mt-1 text-xl font-semibold text-kumo-default">{formatPHDate(d.paidThrough)}</p>
          <p className="mt-1">
            <StatusText status={d.stage} label={STAGE_LABEL[d.stage]} />
          </p>
        </div>
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Next amount due</p>
          <p className="mt-1 text-xl font-semibold text-kumo-default">{peso(d.monthlyRent)}</p>
          <p className="mt-1 text-sm text-kumo-subtle">One month of rent</p>
        </div>
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Lease</p>
          <p className="mt-1 text-xl font-semibold text-kumo-default">Unit {d.unitId}</p>
          <p className="mt-1 text-sm text-kumo-subtle">
            Since {formatPHDate(d.startDate)}. {peso(d.totalPaid)} paid in total.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-kumo-default">Invoices and payments</h2>
          <div className="flex gap-2">
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
                      <StatusText status={r.status} />
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
