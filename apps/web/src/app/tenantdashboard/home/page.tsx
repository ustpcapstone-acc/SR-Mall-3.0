"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, Loader } from "@cloudflare/kumo";
import { toast } from "sonner";
import { getRentASpaceAction } from "@/app/actions/leasing";
import { setWorkspaceAction } from "@/app/actions/workspace";
import { STAGE_LABEL, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { InvoiceButton, StatusText } from "@/components/leasing/shared";

type Data = Extract<Awaited<ReturnType<typeof getRentASpaceAction>>, { success: true }>["data"];

const floorLabel = (f?: string | null) => (f ? `${f.charAt(0).toUpperCase()}${f.slice(1)} floor` : "");

/** Home workspace: the tenant account, its spaces and requests. */
export default function TenantHomePage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getRentASpaceAction().then((res) => {
      if (!alive) return;
      if (res.success) setData(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  const open = async (leaseId: string) => {
    setOpening(leaseId);
    const res = await setWorkspaceAction(leaseId);
    if (!res.success) {
      setOpening(null);
      return toast.error(res.error);
    }
    router.push(res.redirectTo);
    router.refresh();
  };

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

  const spaces = data.leases.filter((l) => l.status === "ACTIVE");
  const pending = data.requests.filter((r) => r.status === "PENDING");
  const recentInvoices = data.invoices.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">{data.shopName}</h1>
        <p className="mt-1 text-sm text-kumo-subtle">
          Your account at SR Mall. Each space you rent has its own workspace for its storefront, promos and payments.
        </p>
      </header>

      {spaces.length === 0 && (
        <Banner
          variant="default"
          description={
            pending.length
              ? `Your request${pending.length === 1 ? " is" : "s are"} waiting for payment at the management office. The space is yours once the office approves it.`
              : "You don't rent a space yet. Choose one on Rent a Space, send a request, then pay at the management office."
          }
        />
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Spaces you rent</p>
          <p className="mt-1 text-2xl font-semibold text-kumo-default">{spaces.length}</p>
        </div>
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Requests waiting</p>
          <p className="mt-1 text-2xl font-semibold text-kumo-default">{pending.length}</p>
        </div>
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
          <p className="text-sm text-kumo-subtle">Spaces available to rent</p>
          <p className="mt-1 text-2xl font-semibold text-kumo-default">{data.spaces.length}</p>
          <Link href="/tenantdashboard/rent-a-space" className="mt-1 inline-block text-sm text-kumo-link hover:underline">
            Browse spaces
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-kumo-default">Your spaces</h2>
        {spaces.length === 0 ? (
          <p className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">None yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {spaces.map((l) => (
              <li key={l.id} className="flex flex-col rounded-xl border border-kumo-line bg-kumo-base p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kumo-default">Unit {l.unitId}</p>
                    <p className="text-sm text-kumo-subtle">
                      {floorLabel(l.floor)}
                      {l.floor ? ", " : ""}paid through {formatPHDate(l.endDate)}
                    </p>
                  </div>
                  {l.stage && <StatusText status={l.stage} label={STAGE_LABEL[l.stage]} />}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" loading={opening === l.id} onClick={() => open(l.id)}>
                    Open workspace
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentInvoices.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold text-kumo-default">Recent e-invoices</h2>
            <Link href="/tenantdashboard/rent-a-space" className="text-sm text-kumo-link hover:underline">
              See all
            </Link>
          </div>
          <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
            {recentInvoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-kumo-default">
                    {i.invoiceNumber}
                    {i.unitId ? `, Unit ${i.unitId}` : ""}
                  </p>
                  <p className="text-xs text-kumo-subtle">
                    {formatPHDate(i.issuedAt)}, {peso(i.amount)}
                  </p>
                </div>
                <InvoiceButton invoiceId={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
