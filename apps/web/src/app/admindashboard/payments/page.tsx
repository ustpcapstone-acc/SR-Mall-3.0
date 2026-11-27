"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Loader } from "@cloudflare/kumo";
import { ArrowClockwise } from "@phosphor-icons/react";
import { AdminPage, EmptyNote, Panel, Person, Stat, StatRow } from "@/components/admin/page-kit";
import { BillReasonDialog } from "@/components/admin/bill-controls";
import { BillsToReview } from "@/components/admin/bills-to-review";
import { CollectionReportPanel } from "@/components/admin/collection-report";
import { RecordCashPaymentModal } from "@/components/admin/record-cash-payment-modal";
import { RecordPaymentGuide } from "@/components/admin/record-payment-guide";
import { getPaymentOverviewAction, type PaymentRecord } from "@/app/actions/payment-schedule";
import { peso } from "@/lib/leasing";
import { formatPHDate, toPHDateInput } from "@/lib/ph-date";
import { useServerData } from "@/lib/use-server-page";

type Task = { mode: "record" | "approve" | "reject" | "cancel"; bill: PaymentRecord };

const DONE = {
  record: "Payment recorded",
  approve: "Deposit slip approved",
  reject: "Deposit slip rejected",
  cancel: "Bill cancelled",
} as const;

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whole Philippine days since the due day. */
const daysLate = (dueDate: string) =>
  Math.round((Date.parse(toPHDateInput(new Date())) - Date.parse(toPHDateInput(dueDate))) / 86400000);

/** What the dialogs need to know about a bill. */
const billOf = (r: PaymentRecord) => ({
  id: r.id,
  invoiceNumber: r.invoiceNumber,
  month: r.month,
  amount: r.amount,
  dueDate: r.dueDate,
  status: r.state,
  depositSlipUrl: r.slipUrl,
});

/** The accountant's home: what is waiting, what came in, and the daily report. */
export default function PaymentsPage() {
  const { data, error, loading, reload } = useServerData(null, getPaymentOverviewAction);
  const [task, setTask] = useState<Task | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = () => {
    void reload();
    setVersion((v) => v + 1);
  };
  const finish = (note?: string) => {
    if (!task) return;
    toast.success(DONE[task.mode], { description: note });
    setTask(null);
    refresh();
  };

  return (
    <AdminPage
      title="Payments"
      description="Deposit slips to check, overdue bills and the money collected."
      actions={
        <>
          <RecordPaymentGuide />
          <Link
            href="/admindashboard/tenant-monitoring?tab=history"
            className="inline-flex h-9 items-center rounded-lg border border-kumo-line px-3 text-sm font-medium text-kumo-default hover:bg-kumo-tint"
          >
            Payment history
          </Link>
          <Button variant="secondary" icon={<ArrowClockwise />} loading={loading} onClick={refresh}>
            Refresh
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-kumo-danger">
          {error}
        </p>
      )}

      {!data ? (
        loading && (
          <div className="flex justify-center py-20">
            <Loader />
          </div>
        )
      ) : (
        <>
          <StatRow>
            <Stat label="Slips to check" value={data.slips.count} hint={peso(data.slips.amount)} tone={data.slips.count ? "warning" : "default"} />
            <Stat label="Overdue bills" value={data.overdue.count} hint={peso(data.overdue.amount)} tone={data.overdue.count ? "danger" : "default"} />
            <Stat label="Collected today" value={peso(data.today.amount)} hint={count(data.today.count, "payment")} />
            <Stat label="Collected this month" value={peso(data.month.amount)} hint={count(data.month.count, "payment")} />
          </StatRow>

          <BillsToReview version={version} onSent={refresh} />

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Panel
              flush
              title="Deposit slips to check"
              description={
                data.slips.count > data.slips.rows.length ? `Showing the oldest ${data.slips.rows.length} of ${data.slips.count}` : "Oldest first"
              }
            >
              {data.slips.rows.length === 0 ? (
                <EmptyNote title="No slips waiting">New deposit slips from tenants appear here.</EmptyNote>
              ) : (
                <ul className="divide-y divide-kumo-line">
                  {data.slips.rows.map((r) => (
                    <li key={r.id} className="space-y-3 p-4 sm:px-5">
                      <BillSummary bill={r} detail={`Due ${formatPHDate(r.dueDate)}`} />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {r.slipUrl && (
                          <a href={r.slipUrl} target="_blank" rel="noopener noreferrer" className="mr-auto text-sm font-medium text-kumo-link hover:underline">
                            View deposit slip
                          </a>
                        )}
                        <Button size="sm" variant="secondary-destructive" onClick={() => setTask({ mode: "reject", bill: r })}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => setTask({ mode: "approve", bill: r })}>
                          Approve
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              flush
              title="Overdue bills"
              description={
                data.overdue.count > data.overdue.rows.length
                  ? `Showing the oldest ${data.overdue.rows.length} of ${data.overdue.count}`
                  : "Longest overdue first"
              }
            >
              {data.overdue.rows.length === 0 ? (
                <EmptyNote title="No overdue bills">Every bill past its due date is paid or being checked.</EmptyNote>
              ) : (
                <ul className="divide-y divide-kumo-line">
                  {data.overdue.rows.map((r) => (
                    <li key={r.id} className="space-y-3 p-4 sm:px-5">
                      <BillSummary bill={r} detail={`${count(daysLate(r.dueDate), "day")} late, due ${formatPHDate(r.dueDate)}`} late />
                      <div className="flex justify-end gap-2">
                        {r.rentBill && (
                          <Button size="sm" variant="secondary" onClick={() => setTask({ mode: "cancel", bill: r })}>
                            Cancel bill
                          </Button>
                        )}
                        <Button size="sm" variant="primary" onClick={() => setTask({ mode: "record", bill: r })}>
                          Record payment
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <CollectionReportPanel version={version} />

      {task && (task.mode === "record" || task.mode === "approve") && (
        <RecordCashPaymentModal
          invoice={billOf(task.bill)}
          mode={task.mode}
          tenantName={task.bill.shopName}
          onClose={() => setTask(null)}
          onRecorded={finish}
        />
      )}
      {task && (task.mode === "reject" || task.mode === "cancel") && (
        <BillReasonDialog
          invoice={billOf(task.bill)}
          mode={task.mode}
          tenantName={task.bill.shopName}
          onClose={() => setTask(null)}
          onDone={() => finish()}
        />
      )}
    </AdminPage>
  );
}

function BillSummary({ bill, detail, late }: { bill: PaymentRecord; detail: string; late?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Person
        square
        name={bill.shopName || "New shop"}
        detail={`${bill.unitId ? `Unit ${bill.unitId}, ` : ""}${bill.invoiceNumber}, ${bill.month}`}
        image={bill.logoUrl}
      />
      <div className="ml-auto text-right">
        <p className="text-sm font-semibold tabular-nums text-kumo-default">{peso(bill.amount)}</p>
        <p className={late ? "text-sm font-medium text-kumo-danger" : "text-sm text-kumo-subtle"}>{detail}</p>
      </div>
    </div>
  );
}
