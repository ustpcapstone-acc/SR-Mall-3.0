"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@cloudflare/kumo";
import { ArrowRight, Money } from "@phosphor-icons/react";
import { getMyStaffAccessAction } from "@/app/actions/staff";
import { DialogHeader } from "@/components/leasing/shared";
import { canOpen, type StaffAccess } from "@/lib/permissions";

/*
 * Payments are recorded on different pages depending on what the money is for.
 * This one button asks that question and takes staff to the right place, so
 * nobody has to remember which page does what.
 */
const CHOICES = [
  {
    key: "renewal",
    title: "A tenant is paying to renew their lease",
    how: "On Renewals, choose the lease and press Record payment.",
    href: "/admindashboard/renewals",
  },
  {
    key: "request",
    title: "A tenant is paying for a new space",
    how: "On Rent Requests, open the request and press Approve and send e-invoice.",
    href: "/admindashboard/rent-requests",
  },
  {
    key: "bill",
    title: "A tenant is paying an unpaid bill in cash",
    how: "On Tenant Monitoring, open the tenant, go to the Payments tab and press Record Cash on the bill.",
    href: "/admindashboard/tenant-monitoring",
  },
  {
    key: "slip",
    title: "A tenant sent a bank deposit slip",
    how: "On Tenant Monitoring, open a tenant marked Verifying. On the Payments tab, view the slip and press Approve.",
    href: "/admindashboard/tenant-monitoring?payment=verifying",
  },
] as const;

export function RecordPaymentGuide({
  onShowTenants,
}: {
  /** On Tenant Monitoring itself: filter the list instead of navigating. */
  onShowTenants?: (onlyVerifying: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<StaffAccess | null>(null);

  useEffect(() => {
    let alive = true;
    getMyStaffAccessAction().then((a) => alive && setAccess(a));
    return () => {
      alive = false;
    };
  }, []);

  // Only offer the pages this staff role can open.
  const choices = access ? CHOICES.filter((c) => canOpen(access, c.href.split("?")[0])) : [];
  if (!choices.length) return null;

  const go = (c: (typeof CHOICES)[number]) => {
    setOpen(false);
    if (onShowTenants && (c.key === "bill" || c.key === "slip")) onShowTenants(c.key === "slip");
    else router.push(c.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <Money size={18} aria-hidden />
        Record a payment
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-5 sm:p-7">
          <DialogHeader title="Record a payment" description="What is the payment for?" />
          <ul className="space-y-2">
            {choices.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => go(c)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-kumo-line bg-kumo-base p-4 text-left hover:border-primary focus:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  <span>
                    <span className="block text-sm font-semibold text-kumo-default">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-kumo-subtle">{c.how}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-kumo-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
