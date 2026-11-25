"use client";

import { confirmAction } from "@/components/confirm-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, Dialog, InputArea, Loader, Select, Table } from "@cloudflare/kumo";
import { toast } from "sonner";
import {
  cancelRentRequestAction,
  createRentRequestAction,
  getRentASpaceAction,
  type AvailableSpace,
} from "@/app/actions/leasing";
import { STAGE_LABEL, TERM_CHOICES, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { DialogHeader, InvoiceButton, StatusText } from "@/components/leasing/shared";

type Data = Extract<Awaited<ReturnType<typeof getRentASpaceAction>>, { success: true }>["data"];

const floorLabel = (f?: string | null) => (f ? `${f.charAt(0).toUpperCase()}${f.slice(1)} floor` : "");
const INVOICES_PER_PAGE = 10;

export default function RentASpacePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<AvailableSpace | null>(null);
  const [floor, setFloor] = useState("all");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    getRentASpaceAction().then((res) => {
      if (!alive) return;
      if (!res.success) return setError(res.error);
      setError(null);
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const floors = useMemo(() => [...new Set((data?.spaces ?? []).map((s) => s.floor))], [data]);
  const pendingUnits = useMemo(
    () => new Set((data?.requests ?? []).filter((r) => r.status === "PENDING").map((r) => r.unitId)),
    [data],
  );

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6 sm:p-8">
        <Banner variant="error" description={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  const active = data.leases.filter((l) => l.status === "ACTIVE");
  const ended = data.leases.filter((l) => l.status !== "ACTIVE");
  const spaces = data.spaces.filter((s) => floor === "all" || s.floor === floor);
  const pages = Math.max(1, Math.ceil(data.invoices.length / INVOICES_PER_PAGE));
  const invoices = data.invoices.slice(page * INVOICES_PER_PAGE, (page + 1) * INVOICES_PER_PAGE);

  const cancel = async (id: string) => {
    if (!(await confirmAction({ title: "Cancel this request?", description: "The mall office will no longer review it. You can send a new one later.", confirmLabel: "Cancel request", cancelLabel: "Keep request" }))) return;
    setBusyId(id);
    const res = await cancelRentRequestAction(id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Request cancelled.");
    reload();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Rent a Space</h1>
        <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">
          Send a request for the space you want, then pay at the SR Mall management office. The office approves the
          request once payment is received, and your e-invoice appears below.
        </p>
      </header>

      {/* Your spaces */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-kumo-default">Your spaces</h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">
            You don&apos;t rent a space yet. Choose one below and send a request.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {active.map((l) => (
              <li key={l.id} className="rounded-xl border border-kumo-line bg-kumo-base p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kumo-default">Unit {l.unitId}</p>
                    <p className="text-sm text-kumo-subtle">
                      {floorLabel(l.floor)}
                      {l.floor ? ", " : ""}
                      {peso(l.monthlyRent)} a month
                    </p>
                  </div>
                  {l.stage && <StatusText status={l.stage === "ACTIVE" ? "ACTIVE" : l.stage} label={STAGE_LABEL[l.stage]} />}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-kumo-subtle">Since</dt>
                    <dd className="text-kumo-default">{formatPHDate(l.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-kumo-subtle">Paid through</dt>
                    <dd className="text-kumo-default">{formatPHDate(l.endDate)}</dd>
                  </div>
                </dl>
                {(l.stage === "GRACE" || l.stage === "OVERDUE" || l.stage === "DUE") && (
                  <div className="mt-4">
                    <Banner
                      variant="error"
                      description={`Rent was due ${formatPHDate(l.endDate)}. Pay at the management office by ${formatPHDate(l.graceEnds)} to keep this space.`}
                    />
                  </div>
                )}
                {l.stage === "UPCOMING" && (
                  <p className="mt-4 text-sm text-kumo-subtle">
                    Renew by paying at the management office on or before {formatPHDate(l.endDate)}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {ended.length > 0 && (
          <details className="rounded-xl border border-kumo-line bg-kumo-base p-4 text-sm">
            <summary className="cursor-pointer text-kumo-default">Past leases ({ended.length})</summary>
            <ul className="mt-3 space-y-2">
              {ended.map((l) => (
                <li key={l.id} className="text-kumo-subtle">
                  <span className="text-kumo-default">Unit {l.unitId}</span>, {formatPHDate(l.startDate)} to{" "}
                  {formatPHDate(l.endedAt ?? l.endDate)}
                  {l.endReason ? `. ${l.endReason}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Requests */}
      {data.requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-kumo-default">Your requests</h2>
          <div className="overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Space</Table.Head>
                  <Table.Head>Term</Table.Head>
                  <Table.Head>Sent</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head className="text-right" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.requests.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell className="font-medium text-kumo-default">Unit {r.unitId}</Table.Cell>
                    <Table.Cell className="text-sm text-kumo-default">
                      {r.months} month{r.months === 1 ? "" : "s"}
                    </Table.Cell>
                    <Table.Cell className="text-sm text-kumo-default">{formatPHDate(r.createdAt)}</Table.Cell>
                    <Table.Cell>
                      <StatusText status={r.status} label={r.status === "PENDING" ? "Waiting for payment" : undefined} />
                      {r.adminComment && <p className="max-w-xs text-xs text-kumo-subtle">{r.adminComment}</p>}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {r.status === "PENDING" && (
                        <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => cancel(r.id)}>
                          Cancel
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </section>
      )}

      {/* Available spaces */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-kumo-default">Available spaces ({spaces.length})</h2>
          {floors.length > 1 && (
            <Select
              aria-label="Floor"
              value={floor}
              items={{ all: "All floors", ...Object.fromEntries(floors.map((f) => [f, floorLabel(f)])) }}
              onValueChange={(v) => setFloor((v as string) || "all")}
              className="min-w-44"
            >
              <Select.Option value="all">All floors</Select.Option>
              {floors.map((f) => (
                <Select.Option key={f} value={f}>
                  {floorLabel(f)}
                </Select.Option>
              ))}
            </Select>
          )}
        </div>
        {spaces.length === 0 ? (
          <p className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">
            No spaces are available right now. Check again later.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <li key={s.unitId} className="flex flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt={`Unit ${s.unitId}`} loading="lazy" className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-kumo-recessed text-sm text-kumo-subtle">No photo yet</div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-semibold text-kumo-default">Unit {s.unitId}</p>
                  <p className="text-sm text-kumo-subtle">
                    {floorLabel(s.floor)}, {s.category}, {s.sqm} sqm
                  </p>
                  <p className="mt-2 text-sm text-kumo-default">{peso(s.monthlyRent)} a month</p>
                  {s.features.length > 0 && <p className="mt-1 text-xs text-kumo-subtle">{s.features.join(", ")}</p>}
                  <div className="mt-4 flex flex-1 items-end">
                    <Button
                      className="w-full"
                      variant={pendingUnits.has(s.unitId) ? "secondary" : "primary"}
                      disabled={pendingUnits.has(s.unitId)}
                      onClick={() => setRequesting(s)}
                    >
                      {pendingUnits.has(s.unitId) ? "Request sent" : "Request this space"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* E-invoices */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-kumo-default">E-invoices</h2>
        {data.invoices.length === 0 ? (
          <p className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">
            Your e-invoices appear here after the office records a payment.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Invoice</Table.Head>
                    <Table.Head>Space</Table.Head>
                    <Table.Head>Period</Table.Head>
                    <Table.Head className="text-right">Amount</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head className="text-right" />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {invoices.map((i) => (
                    <Table.Row key={i.id}>
                      <Table.Cell>
                        <p className="font-medium text-kumo-default">{i.invoiceNumber}</p>
                        <p className="text-xs text-kumo-subtle">Issued {formatPHDate(i.issuedAt)}</p>
                      </Table.Cell>
                      <Table.Cell className="text-sm text-kumo-default">{i.unitId ? `Unit ${i.unitId}` : "-"}</Table.Cell>
                      <Table.Cell className="text-sm text-kumo-default">{i.month}</Table.Cell>
                      <Table.Cell className="text-right text-sm text-kumo-default">{peso(i.amount)}</Table.Cell>
                      <Table.Cell>
                        <StatusText status={i.status} />
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <InvoiceButton invoiceId={i.id} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-3 text-sm text-kumo-subtle">
                <span>
                  Page {page + 1} of {pages}
                </span>
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog.Root open={!!requesting} onOpenChange={(o) => !o && setRequesting(null)}>
        <Dialog size="base" className="w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-7">
          {requesting && (
            <RequestForm
              key={requesting.unitId}
              space={requesting}
              onDone={() => {
                setRequesting(null);
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}

const TERM_ITEMS = Object.fromEntries(TERM_CHOICES.map((m) => [String(m), `${m} month${m === 1 ? "" : "s"}`]));

function RequestForm({ space, onDone }: { space: AvailableSpace; onDone: () => void }) {
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createRentRequestAction({ unitId: space.unitId, months: Number(months), note });
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(`Request sent for Unit ${space.unitId}.`);
    onDone();
  };

  return (
    <>
      <DialogHeader title={`Request Unit ${space.unitId}`} description={`${floorLabel(space.floor)}, ${space.sqm} sqm, ${peso(space.monthlyRent)} a month`} />
      <form onSubmit={submit} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <Select label="Lease term" value={months} items={TERM_ITEMS} onValueChange={(v) => setMonths((v as string) || "12")} className="w-full">
          {TERM_CHOICES.map((m) => (
            <Select.Option key={m} value={String(m)}>
              {TERM_ITEMS[String(m)]}
            </Select.Option>
          ))}
        </Select>
        <InputArea
          label="Note to the office"
          description="Optional. For example, when you plan to visit to pay."
          value={note}
          onValueChange={setNote}
          maxLength={1000}
        />
        <p className="text-sm text-kumo-subtle">
          Next step: pay at the SR Mall management office. The space is yours once the office approves your request.
        </p>
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="primary" loading={saving}>
            Send request
          </Button>
        </div>
      </form>
    </>
  );
}
