"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Loader, Table, cn } from "@cloudflare/kumo";
import { DownloadSimple, FilePdf } from "@phosphor-icons/react";
import { EmptyNote, Panel } from "@/components/admin/page-kit";
import { todayPH } from "@/components/leasing/shared";
import { getCollectionReportAction } from "@/app/actions/payment-schedule";
import { NO_METHOD, collectionCsv, sumAmounts, totalsByMethod, type CollectionReport } from "@/lib/collections";
import { peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { useServerData } from "@/lib/use-server-page";
import { generateCollectionReportPDF } from "@/utils/report-generator";

function downloadSpreadsheet(report: CollectionReport) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([collectionCsv(report)], { type: "text/csv;charset=utf-8" }));
  link.download = `SR-Collections-${report.date}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Money received on one day, by method, to match against the cash on hand. */
export function CollectionReportPanel({
  version,
}: {
  /** Changes when a payment was just accepted, so the report reloads. */
  version: number;
}) {
  const [date, setDate] = useState(todayPH);
  const [making, setMaking] = useState(false);
  const { data, error, loading, reload } = useServerData({ date }, getCollectionReportAction);
  useEffect(() => {
    if (version) void reload();
  }, [version, reload]);

  // Only offer the report that matches the chosen day.
  const report = data && data.date === date ? data : null;

  const downloadPdf = async () => {
    if (!report) return;
    setMaking(true);
    try {
      await generateCollectionReportPDF(report);
    } catch (e) {
      console.error("Collection report error:", e);
      toast.error("Couldn't create the PDF.");
    } finally {
      setMaking(false);
    }
  };

  return (
    <Panel
      flush
      title="Daily collection report"
      description="Money received on one day, by payment date"
      actions={
        <>
          <Button variant="secondary" icon={<FilePdf />} loading={making} disabled={!report || loading} onClick={downloadPdf}>
            Download PDF
          </Button>
          <Button
            variant="secondary"
            icon={<DownloadSimple />}
            disabled={!report || loading}
            onClick={() => report && downloadSpreadsheet(report)}
          >
            Download spreadsheet
          </Button>
        </>
      }
    >
      <div className="border-b border-kumo-line p-4 sm:px-5">
        <Input
          label="Date"
          type="date"
          value={date}
          max={todayPH()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-48"
        />
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <p className="text-sm text-kumo-danger">{error}</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {!report ? (
        !error && (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        )
      ) : (
        <div aria-busy={loading} className={cn(loading && "opacity-60")}>
          <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:px-5 xl:grid-cols-4">
            {totalsByMethod(report.rows).map((t) => (
              <div key={t.method} className="rounded-lg border border-kumo-line p-3">
                <dt className="text-sm text-kumo-subtle">{t.method === "Cash" ? "Cash to count" : t.method}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-kumo-default">{peso(t.amount)}</dd>
                <dd className="text-xs text-kumo-subtle">
                  {t.count} payment{t.count === 1 ? "" : "s"}
                </dd>
              </div>
            ))}
            <div className="rounded-lg border border-kumo-brand p-3">
              <dt className="text-sm text-kumo-subtle">Total received</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-kumo-default">{peso(sumAmounts(report.rows))}</dd>
              <dd className="text-xs text-kumo-subtle">
                {report.rows.length} payment{report.rows.length === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>

          {report.rows.length === 0 ? (
            <EmptyNote title="No payments on this day">Nothing was received on {formatPHDate(`${report.date}T12:00:00+08:00`)}.</EmptyNote>
          ) : (
            <div className="overflow-x-auto border-t border-kumo-line">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Shop</Table.Head>
                    <Table.Head>Invoice</Table.Head>
                    <Table.Head>Method</Table.Head>
                    <Table.Head>Accepted by</Table.Head>
                    <Table.Head className="text-right">Amount</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {report.rows.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <p className="text-sm font-medium text-kumo-default">{r.shopName}</p>
                        <p className="text-sm text-kumo-subtle">{r.unitId ? `Unit ${r.unitId}` : "No unit"}</p>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <p className="text-sm text-kumo-default">{r.invoiceNumber}</p>
                        <p className="text-sm text-kumo-subtle">{r.month}</p>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <p className="text-sm text-kumo-default">{r.method || NO_METHOD}</p>
                        {r.referenceNo && <p className="text-sm text-kumo-subtle">Ref {r.referenceNo}</p>}
                      </Table.Cell>
                      <Table.Cell className="text-sm text-kumo-default">{r.acceptedBy || "-"}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-kumo-default">
                        {peso(r.amount)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}

          {report.voided.length > 0 && (
            <div className="border-t border-kumo-line p-4 sm:px-5">
              <h3 className="text-sm font-semibold text-kumo-default">Payments voided on this day (not counted)</h3>
              <ul className="mt-2 space-y-1.5">
                {report.voided.map((v) => (
                  <li key={v.id} className="text-sm text-kumo-subtle wrap-anywhere">
                    <span className="text-kumo-default">
                      {v.shopName}, {v.invoiceNumber}, {peso(v.amount)}
                    </span>
                    {v.method ? `, ${v.method}` : ""}. Voided by {v.actorName || "staff"}: {v.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
