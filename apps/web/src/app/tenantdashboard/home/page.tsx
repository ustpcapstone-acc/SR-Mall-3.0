"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, Loader, Select } from "@cloudflare/kumo";
import { toast } from "sonner";
import { getRentASpaceAction } from "@/app/actions/leasing";
import { setUnitShopAction, setWorkspaceAction } from "@/app/actions/workspace";
import { confirmAction } from "@/components/confirm-dialog";
import { STAGE_LABEL, peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";
import { InvoiceButton, StatusText } from "@/components/leasing/shared";
import { GettingStarted } from "@/components/tenant/getting-started";

type Data = Extract<Awaited<ReturnType<typeof getRentASpaceAction>>, { success: true }>["data"];

const floorLabel = (f?: string | null) => (f ? `${f.charAt(0).toUpperCase()}${f.slice(1)} floor` : "");

/** Home workspace: the tenant account, its spaces and requests. */
export default function TenantHomePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

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

  const open = async (leaseId: string, page?: string) => {
    setOpening(page ?? leaseId);
    const res = await setWorkspaceAction(leaseId);
    if (!res.success) {
      setOpening(null);
      return toast.error(res.error);
    }
    window.location.assign(page ?? res.redirectTo);
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

  // Which shop each unit belongs to ("main" or a separate shop's id).
  const shopOf = (l: (typeof spaces)[number]) => l.shopId ?? "main";
  const unitsOf = (shop: string, except?: string) =>
    spaces.filter((l) => shopOf(l) === shop && l.id !== except).map((l) => l.unitId);
  const shopChoices = [{ id: "main", shopName: data.shopName }, ...data.separateShops].filter(
    // Empty shops nothing uses aren't offered; "new" brings a unit's own one back.
    (s) => s.shopName || unitsOf(s.id).length,
  );
  const choicesFor = (l: (typeof spaces)[number]) => {
    const items: Record<string, string> = Object.fromEntries(
      shopChoices.map((s) => {
        const others = unitsOf(s.id, l.id);
        return [s.id, `${s.shopName || "New shop"}${others.length ? ` (with Unit ${others.join(", ")})` : ""}`];
      }),
    );
    // A unit that already has a shop to itself is already separate.
    if (unitsOf(shopOf(l), l.id).length) items.new = "A separate new shop";
    return items;
  };

  const changeShop = async (l: (typeof spaces)[number], choice: string) => {
    if (choice === shopOf(l)) return;
    const name = choicesFor(l)[choice];
    const ok = await confirmAction({
      title: choice === "new" ? `Give Unit ${l.unitId} its own shop?` : `Move Unit ${l.unitId} to ${name}?`,
      description:
        choice === "new"
          ? "Unit " +
            l.unitId +
            " gets a separate shop with its own storefront, products, promos, reviews and messages, starting empty. Payments, staff and complaints stay with the unit. Nothing is deleted."
          : "The unit will show that shop's storefront, products, promos, reviews and messages. The shop it leaves keeps its records. Payments, staff and complaints stay with the unit.",
      confirmLabel: choice === "new" ? "Create separate shop" : "Move unit",
      destructive: false,
    });
    if (!ok) return;
    setMoving(l.id);
    const res = await setUnitShopAction(l.id, choice);
    if (!res.success) {
      setMoving(null);
      return toast.error(res.error);
    }
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">{data.shopName}</h1>
        <p className="mt-1 text-sm text-kumo-subtle">
          Your account at SR Mall. Each space you rent has its own workspace for its storefront, promos and payments.
        </p>
      </header>

      <GettingStarted
        progress={{ hasSpace: spaces.length > 0, hasPendingRequest: pending.length > 0, storefront: data.storefront }}
        opening={opening === "/tenantdashboard/digital-storefront"}
        onOpenStorefront={() => spaces[0] && open(spaces[0].id, "/tenantdashboard/digital-storefront")}
      />

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
        {spaces.length > 1 && (
          <p className="text-sm text-kumo-subtle">
            Units in the same shop share one storefront, promos, reviews and messages. Separate shops are managed on their
            own. Payments and complaints are always kept per unit.
          </p>
        )}
        {spaces.length === 0 ? (
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-6">
            <p className="text-sm text-kumo-subtle">
              {pending.length
                ? "No space yet. Your request is waiting for payment and approval at the management office."
                : "You don't rent a space yet."}
            </p>
            <Link href="/tenantdashboard/rent-a-space" className="mt-2 inline-block text-sm font-medium text-kumo-link hover:underline">
              {pending.length ? "View my request" : "See available spaces"}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {spaces.map((l) => (
              <li key={l.id} className="flex flex-col rounded-xl border border-kumo-line bg-kumo-base p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kumo-default">{l.shopName || "New shop"}</p>
                    <p className="text-sm text-kumo-subtle">
                      Unit {l.unitId}, {floorLabel(l.floor)}
                      {l.floor ? ", " : ""}paid through {formatPHDate(l.endDate)}
                    </p>
                  </div>
                  {l.stage && <StatusText status={l.stage} label={STAGE_LABEL[l.stage]} />}
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  {spaces.length > 1 || l.shopId ? (
                    <Select
                      label="Shop for this unit"
                      value={shopOf(l)}
                      items={choicesFor(l)}
                      disabled={moving !== null}
                      onValueChange={(v) => changeShop(l, (v as string) || shopOf(l))}
                      className="w-full sm:w-64"
                    >
                      {Object.entries(choicesFor(l)).map(([value, text]) => (
                        <Select.Option key={value} value={value}>
                          {text}
                        </Select.Option>
                      ))}
                    </Select>
                  ) : (
                    <span />
                  )}
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
