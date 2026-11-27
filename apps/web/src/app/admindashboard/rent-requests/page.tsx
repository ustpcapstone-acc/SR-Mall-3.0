"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, Dialog, Input, InputArea, Loader, Table, Tabs } from "@cloudflare/kumo";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  approveRentRequestAction,
  getTenantDocumentLinkAction,
  listRentRequestsAction,
  rejectRentRequestAction,
  type RentRequestRow,
} from "@/app/actions/leasing";
import { addMonths, peso } from "@/lib/leasing";
import { formatPHDate, phDayStart } from "@/lib/ph-date";
import {
  DialogHeader,
  InvoiceButton,
  PaymentFields,
  StatusText,
  initialPayment,
  toPaymentForm,
  todayPH,
} from "@/components/leasing/shared";
import { useFloors } from "@/lib/use-floors";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";

type Tab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";


export default function RentRequestsPage() {
  const { label: floorLabel } = useFloors();
  const [rows, setRows] = useState<RentRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    listRentRequestsAction().then((res) => {
      if (!alive) return;
      if (!res.success) return setError(res.error);
      setError(null);
      setRows(res.data);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: rows?.length ?? 0 };
    rows?.forEach((r) => {
      if (r.status in c) c[r.status as keyof typeof c]++;
    });
    return c;
  }, [rows]);
  const visible = (rows ?? []).filter((r) => tab === "ALL" || r.status === tab);
  const open = rows?.find((r) => r.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Rent Requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">
          Tenants ask for a space here. Approve a request once the tenant has paid at the office: the space is assigned,
          the lease starts and a paid e-invoice is sent to the tenant.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        tabs={[
          { value: "PENDING", label: `Pending (${counts.PENDING})` },
          { value: "APPROVED", label: `Approved (${counts.APPROVED})` },
          { value: "REJECTED", label: `Rejected (${counts.REJECTED})` },
          { value: "ALL", label: `All (${counts.ALL})` },
        ]}
      />

      {error ? (
        <Banner variant="error" description={error} />
      ) : !rows ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-kumo-line bg-kumo-base p-8 text-center text-sm text-kumo-subtle">
          {tab === "PENDING" ? "No requests waiting for a decision." : "Nothing here yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Tenant</Table.Head>
                <Table.Head>Space</Table.Head>
                <Table.Head>Term</Table.Head>
                <Table.Head>Requested</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visible.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <p className="font-medium text-kumo-default">{r.tenant.shopName}</p>
                    <p className="text-sm text-kumo-subtle">{r.tenant.companyName || r.tenant.ownerEmail}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="font-medium text-kumo-default">Unit {r.unitId}</p>
                    <p className="text-sm text-kumo-subtle">
                      {r.space ? `${floorLabel(r.space.floor)}, ${peso(r.space.monthlyRent)} a month` : "Space removed"}
                    </p>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-kumo-default">
                    {r.months} month{r.months === 1 ? "" : "s"}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-kumo-default">{formatPHDate(r.createdAt)}</Table.Cell>
                  <Table.Cell>
                    <StatusText status={r.status} />
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button size="sm" variant={r.status === "PENDING" ? "primary" : "secondary"} onClick={() => setOpenId(r.id)}>
                      {r.status === "PENDING" ? "Review" : "View"}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <Dialog.Root open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <Dialog size="lg" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto p-5 sm:p-7">
          {open && (
            <ReviewRequest
              key={open.id}
              request={open}
              onDone={() => {
                setOpenId(null);
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-kumo-subtle">{label}</dt>
      <dd className="text-sm text-kumo-default">{children || "-"}</dd>
    </div>
  );
}

function ReviewRequest({ request: r, onDone }: { request: RentRequestRow; onDone: () => void }) {
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const { label: floorLabel } = useFloors();
  const [opening, setOpening] = useState<string | null>(null);

  const openDoc = async (type: string) => {
    // Open the tab now so pop-up blockers allow it, then point it at the link.
    const win = window.open("", "_blank");
    setOpening(type);
    const res = await getTenantDocumentLinkAction(r.tenant.id, type);
    setOpening(null);
    if (!res.success) {
      win?.close();
      return toast.error(res.error);
    }
    if (win) {
      win.opener = null;
      win.location.href = res.url;
    } else window.location.assign(res.url);
  };

  return (
    <>
      <DialogHeader
        title={`${r.tenant.shopName}: Unit ${r.unitId}`}
        description={`Requested ${formatPHDate(r.createdAt)} for ${r.months} month${r.months === 1 ? "" : "s"}`}
      />

      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-kumo-default">Tenant</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Registered business">{r.tenant.companyName}</Detail>
            <Detail label="Store name">{r.tenant.shopName}</Detail>
            <Detail label="Contact person">{r.tenant.ownerName}</Detail>
            <Detail label="Email">{r.tenant.ownerEmail}</Detail>
            <Detail label="Phone">{r.tenant.phone}</Detail>
            <Detail label="Category">{r.tenant.category}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Business address">{r.tenant.businessAddress}</Detail>
            </div>
            <div className="sm:col-span-2">
              <Detail label="Spaces they rent now">
                {r.tenant.activeSpaces.length ? r.tenant.activeSpaces.map((u) => `Unit ${u}`).join(", ") : "None"}
              </Detail>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-kumo-default">Documents</h3>
          {r.tenant.documents.length === 0 ? (
            <p className="text-sm text-kumo-subtle">No documents on file. This tenant registered before documents were collected.</p>
          ) : (
            <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
              {r.tenant.documents.map((d) => (
                <li key={d.type} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-kumo-default">{d.label}</p>
                    <p className="truncate text-xs text-kumo-subtle">{d.name}</p>
                  </div>
                  <Button size="sm" variant="secondary" icon={<ArrowSquareOut />} loading={opening === d.type} onClick={() => openDoc(d.type)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-kumo-default">Space</h3>
          {r.space ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Detail label="Unit">
                {r.unitId}, {floorLabel(r.space.floor)}
              </Detail>
              <Detail label="Size">{r.space.sqm} sqm</Detail>
              <Detail label="Listed rent">{peso(r.space.monthlyRent)} a month</Detail>
            </dl>
          ) : (
            <p className="text-sm text-kumo-subtle">This space was deleted.</p>
          )}
          {r.note && (
            <p className="mt-3 rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
              <span className="text-kumo-subtle">Tenant&apos;s note: </span>
              {r.note}
            </p>
          )}
          {r.status === "PENDING" && r.space && r.space.status !== "AVAILABLE" && (
            <div className="mt-3">
              <Banner variant="error" description={`Unit ${r.unitId} is ${r.space.status.toLowerCase()} right now, so it can't be approved.`} />
            </div>
          )}
        </section>

        {r.status !== "PENDING" ? (
          <section className="rounded-lg border border-kumo-line p-4">
            <p className="text-sm">
              <StatusText status={r.status} />
              {r.decidedAt && <span className="text-kumo-subtle"> on {formatPHDate(r.decidedAt)}</span>}
            </p>
            {r.adminComment && <p className="mt-1 text-sm text-kumo-default">{r.adminComment}</p>}
          </section>
        ) : mode === "approve" ? (
          <ApproveForm request={r} onCancel={() => setMode("view")} onDone={onDone} />
        ) : mode === "reject" ? (
          <RejectForm request={r} onCancel={() => setMode("view")} onDone={onDone} />
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary-destructive" onClick={() => setMode("reject")}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => setMode("approve")} disabled={!r.space || r.space.status !== "AVAILABLE"}>
              Approve after payment
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ApproveForm({ request: r, onCancel, onDone }: { request: RentRequestRow; onCancel: () => void; onDone: () => void }) {
  const listed = r.space?.monthlyRent ?? 0;
  const [startOn, setStartOn] = useState(todayPH());
  const [rent, setRent] = useState(String(listed));
  const [payment, setPayment] = useState(() => initialPayment(r.months, listed));
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Payment details are never kept on this device, only the lease terms and note.
  const draft = useDraft({
    form: "admin.rent-approval",
    scope: [r.id],
    value: { startOn, rent, comment },
    initial: { startOn: todayPH(), rent: String(listed), comment: "" },
    onRestore: (saved) => {
      setStartOn(saved.startOn);
      setRent(saved.rent);
      setPayment((p) => ({ ...p, amount: String((Number(p.months) || 0) * (Number(saved.rent) || 0)) }));
      setComment(saved.comment);
    },
  });

  const months = Number(payment.months) || 0;
  const paidThrough = startOn && months > 0 ? formatPHDate(addMonths(phDayStart(startOn), months)) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await draft.send(() =>
      approveRentRequestAction(r.id, { ...toPaymentForm(payment), startOn, monthlyRent: Number(rent), comment }),
    );
    setSaving(false);
    if (!res) return;
    if (!res.success) return setError(res.error);
    draft.clear();
    toast.success(`Unit ${r.unitId} assigned to ${r.tenant.shopName}. The e-invoice was sent.`);
    setInvoiceId(res.invoiceId);
  };

  if (invoiceId) {
    return (
      <section className="space-y-4 rounded-lg border border-kumo-line p-4">
        <p className="text-sm text-kumo-default">
          Approved. {r.tenant.shopName} now rents Unit {r.unitId}, and the paid e-invoice was sent to them.
        </p>
        <div className="flex justify-end gap-2">
          <InvoiceButton invoiceId={invoiceId} label="Download e-invoice" size="base" />
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-kumo-line p-4">
      <div>
        <h3 className="text-sm font-semibold text-kumo-default">Record the payment</h3>
        <p className="text-sm text-kumo-subtle">Only approve once the money is in hand.</p>
      </div>
      {error && <Banner variant="error" description={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Lease starts" type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} required />
        <Input
          label="Monthly rent (PHP)"
          type="number"
          min={0}
          step="0.01"
          value={rent}
          onChange={(e) => {
            setRent(e.target.value);
            setPayment((p) => ({ ...p, amount: String((Number(p.months) || 0) * (Number(e.target.value) || 0)) }));
          }}
          description={listed ? `Listed at ${peso(listed)}` : undefined}
          required
        />
      </div>
      <PaymentFields value={payment} onChange={setPayment} monthlyRent={Number(rent) || 0} />
      {paidThrough && <p className="text-sm text-kumo-subtle">Paid through {paidThrough}. The next renewal is due that day.</p>}
      <InputArea label="Note to the tenant" description="Optional" value={comment} onValueChange={setComment} maxLength={1000} />
      <DraftNote draft={draft} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Approve and send e-invoice
        </Button>
      </div>
    </form>
  );
}

function RejectForm({ request: r, onCancel, onDone }: { request: RentRequestRow; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = useDraft({
    form: "admin.rent-rejection",
    scope: [r.id],
    value: { reason },
    initial: { reason: "" },
    onRestore: (saved) => setReason(saved.reason),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await draft.send(() => rejectRentRequestAction(r.id, reason));
    setSaving(false);
    if (!res) return;
    if (!res.success) return setError(res.error);
    draft.clear();
    toast.success("Request rejected. The tenant was told why.");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-kumo-line p-4">
      {error && <Banner variant="error" description={error} />}
      <InputArea
        label="Reason"
        description="The tenant will see this."
        value={reason}
        onValueChange={setReason}
        maxLength={1000}
        required
      />
      <DraftNote draft={draft} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" variant="destructive" loading={saving}>
          Reject request
        </Button>
      </div>
    </form>
  );
}
