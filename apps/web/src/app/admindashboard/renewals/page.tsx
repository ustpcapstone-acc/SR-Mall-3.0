"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, Dialog, Input, InputArea, Loader, Table, Tabs } from "@cloudflare/kumo";
import { toast } from "sonner";
import {
  endLeaseAction,
  listRenewalsAction,
  recordRenewalAction,
  saveLeaseSettingsAction,
  type RenewalRow,
} from "@/app/actions/leasing";
import { STAGE_LABEL, addMonths, daysUntil, peso, type LeaseSettingsData, type RenewalStage } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import {
  DialogHeader,
  InvoiceButton,
  PaymentFields,
  StatusText,
  initialPayment,
  toPaymentForm,
} from "@/components/leasing/shared";

type Tab = "UPCOMING" | "DUE" | "GRACE" | "OVERDUE" | "ACTIVE" | "ENDED" | "SETTINGS";

function whenText(l: RenewalRow) {
  const d = daysUntil(l.endDate);
  if (l.status !== "ACTIVE") return l.endedAt ? `Ended ${formatPHDate(l.endedAt)}` : "Ended";
  if (d > 0) return `Due in ${d} day${d === 1 ? "" : "s"}`;
  if (d === 0) return "Due today";
  return `${-d} day${d === -1 ? "" : "s"} late`;
}

export default function RenewalsPage() {
  const [data, setData] = useState<{ leases: RenewalRow[]; settings: LeaseSettingsData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [renewId, setRenewId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    listRenewalsAction().then((res) => {
      if (!alive) return;
      if (!res.success) return setError(res.error);
      setError(null);
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const byTab = useMemo(() => {
    const groups: Record<Exclude<Tab, "SETTINGS">, RenewalRow[]> = { UPCOMING: [], DUE: [], GRACE: [], OVERDUE: [], ACTIVE: [], ENDED: [] };
    for (const l of data?.leases ?? []) {
      if (l.status !== "ACTIVE") groups.ENDED.push(l);
      else groups[(l.stage ?? "ACTIVE") as RenewalStage].push(l);
    }
    groups.ENDED.sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
    return groups;
  }, [data]);

  const leases = data?.leases ?? [];
  const renewing = leases.find((l) => l.id === renewId) ?? null;
  const ending = leases.find((l) => l.id === endId) ?? null;
  const tabs: { value: Tab; label: string }[] = [
    { value: "UPCOMING", label: `Upcoming (${byTab.UPCOMING.length})` },
    { value: "DUE", label: `Due today (${byTab.DUE.length})` },
    { value: "GRACE", label: `Grace period (${byTab.GRACE.length})` },
    { value: "OVERDUE", label: `Overdue (${byTab.OVERDUE.length})` },
    { value: "ACTIVE", label: `Paid ahead (${byTab.ACTIVE.length})` },
    { value: "ENDED", label: `Ended (${byTab.ENDED.length})` },
    { value: "SETTINGS", label: "Settings" },
  ];
  const list = tab === "SETTINGS" ? [] : byTab[tab];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Renewals</h1>
        <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">
          Each lease is paid through a date. Tenants are reminded before it, get a grace period after it, and are removed
          from the space automatically if they still have not paid when the grace period ends.
        </p>
      </header>

      <div className="overflow-x-auto">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} tabs={tabs} />
      </div>

      {error ? (
        <Banner variant="error" description={error} />
      ) : !data ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : tab === "SETTINGS" ? (
        <SettingsForm key={JSON.stringify(data.settings)} settings={data.settings} onSaved={reload} />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-kumo-line bg-kumo-base p-8 text-center text-sm text-kumo-subtle">
          {tab === "OVERDUE"
            ? "No overdue leases. Leases past their grace period are removed by the daily job."
            : "No leases here right now."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Tenant</Table.Head>
                <Table.Head>Space</Table.Head>
                <Table.Head>Paid through</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {list.map((l) => (
                <Table.Row key={l.id}>
                  <Table.Cell>
                    <p className="font-medium text-kumo-default">{l.shopName}</p>
                    <p className="text-sm text-kumo-subtle">{l.ownerName}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="font-medium text-kumo-default">Unit {l.unitId}</p>
                    <p className="text-sm text-kumo-subtle">{peso(l.monthlyRent)} a month</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-kumo-default">{formatPHDate(l.endDate)}</p>
                    <p className="text-sm text-kumo-subtle">{whenText(l)}</p>
                  </Table.Cell>
                  <Table.Cell>
                    {l.status === "ACTIVE" && l.stage ? (
                      <>
                        <StatusText status={l.stage} label={STAGE_LABEL[l.stage]} />
                        {(l.stage === "GRACE" || l.stage === "OVERDUE") && (
                          <p className="text-xs text-kumo-subtle">Grace ends {formatPHDate(l.graceEnds)}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <StatusText status="ENDED" />
                        {l.endReason && <p className="max-w-56 text-xs text-kumo-subtle">{l.endReason}</p>}
                      </>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      {l.lastInvoiceId && <InvoiceButton invoiceId={l.lastInvoiceId} label="Last invoice" />}
                      {l.status === "ACTIVE" && (
                        <>
                          <Button size="sm" variant="secondary-destructive" onClick={() => setEndId(l.id)}>
                            End lease
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => setRenewId(l.id)}>
                            Record payment
                          </Button>
                        </>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <Dialog.Root open={!!renewing} onOpenChange={(o) => !o && setRenewId(null)}>
        <Dialog size="lg" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-5 sm:p-7">
          {renewing && (
            <RenewForm
              key={renewing.id}
              lease={renewing}
              onDone={() => {
                setRenewId(null);
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={!!ending} onOpenChange={(o) => !o && setEndId(null)}>
        <Dialog size="base" className="w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-7">
          {ending && (
            <EndForm
              key={ending.id}
              lease={ending}
              onDone={() => {
                setEndId(null);
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}

function RenewForm({ lease, onDone }: { lease: RenewalRow; onDone: () => void }) {
  const [payment, setPayment] = useState(() => initialPayment(1, lease.monthlyRent));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const months = Number(payment.months) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await recordRenewalAction(lease.id, toPaymentForm(payment));
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(`Unit ${lease.unitId} renewed. The e-invoice was sent.`);
    setInvoiceId(res.invoiceId);
  };

  if (invoiceId) {
    return (
      <>
        <DialogHeader title="Renewal recorded" />
        <p className="text-sm text-kumo-default">
          {lease.shopName} is paid through {months > 0 ? formatPHDate(addMonths(lease.endDate, months)) : "the new date"}, and the paid
          e-invoice was sent to them.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <InvoiceButton invoiceId={invoiceId} label="Download e-invoice" size="base" />
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader
        title={`Renew Unit ${lease.unitId}`}
        description={`${lease.shopName}, paid through ${formatPHDate(lease.endDate)}`}
      />
      <form onSubmit={submit} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <PaymentFields value={payment} onChange={setPayment} monthlyRent={lease.monthlyRent} monthsLabel="Months to add" />
        {months > 0 && (
          <p className="text-sm text-kumo-subtle">
            New paid-through date: {formatPHDate(addMonths(lease.endDate, months))}.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="primary" loading={saving}>
            Record and send e-invoice
          </Button>
        </div>
      </form>
    </>
  );
}

function EndForm({ lease, onDone }: { lease: RenewalRow; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await endLeaseAction(lease.id, reason);
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(`Lease ended. Unit ${lease.unitId} is available again.`);
    onDone();
  };

  return (
    <>
      <DialogHeader title={`End lease for Unit ${lease.unitId}?`} description={`${lease.shopName} loses the space and it becomes available.`} />
      <form onSubmit={submit} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <InputArea label="Reason" description="The tenant will see this." value={reason} onValueChange={setReason} maxLength={500} required />
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="destructive" loading={saving}>
            End lease
          </Button>
        </div>
      </form>
    </>
  );
}

function SettingsForm({ settings, onSaved }: { settings: LeaseSettingsData; onSaved: () => void }) {
  const [reminders, setReminders] = useState(settings.reminderDays.join(", "));
  const [grace, setGrace] = useState(String(settings.graceDays));
  const [finalWarning, setFinalWarning] = useState(String(settings.finalWarningDays));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveLeaseSettingsAction({
      reminderDays: reminders.split(/[\s,]+/).filter(Boolean).map(Number),
      graceDays: Number(grace),
      finalWarningDays: Number(finalWarning),
    });
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success("Renewal settings saved.");
    onSaved();
  };

  const g = Number(grace) || 0;
  const f = Number(finalWarning) || 0;

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5 rounded-xl border border-kumo-line bg-kumo-base p-5 sm:p-6">
      {error && <Banner variant="error" description={error} />}
      <Input
        label="Reminder days before the due date"
        description="Separate with commas, for example 7, 1. Up to 5 reminders."
        value={reminders}
        onChange={(e) => setReminders(e.target.value)}
        required
      />
      <Input
        label="Grace period (days)"
        description="How long after the due date the tenant can still pay. 0 removes them the day after the due date."
        type="number"
        min={0}
        max={60}
        value={grace}
        onChange={(e) => setGrace(e.target.value)}
        required
      />
      <Input
        label="Final warning (days before removal)"
        description="A last notice during the grace period. 0 turns it off."
        type="number"
        min={0}
        max={60}
        value={finalWarning}
        onChange={(e) => setFinalWarning(e.target.value)}
        required
      />
      <div className="rounded-lg bg-kumo-recessed p-4 text-sm text-kumo-default">
        <p className="font-medium">What tenants get</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-kumo-subtle">
          <li>Reminders {reminders || "-"} days before the due date</li>
          <li>A notice on the due date</li>
          <li>A notice when the grace period starts (day after the due date)</li>
          {g > 0 && f > 0 && f <= g && <li>A final warning {f} day{f === 1 ? "" : "s"} before removal</li>}
          <li>A notice when they are removed, {g + 1} day{g === 0 ? "" : "s"} after the due date</li>
        </ul>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
