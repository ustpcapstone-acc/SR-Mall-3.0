"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Loader } from "@cloudflare/kumo";
import { CalendarCheck, X } from "@phosphor-icons/react";
import { getMyPaymentScheduleAction, type ScheduleEntry } from "@/app/actions/payment-schedule";
import { PaymentSchedule } from "./payment-schedule";

/** Tenant Payments page: "See payment schedule" button and its dialog. */
export function MyScheduleButton({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ shopName: string; unitId: string; entries: ScheduleEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    let alive = true;
    setError(null);
    getMyPaymentScheduleAction(userId).then((res) => {
      if (!alive) return;
      if (res.success) setData(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [open, userId]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={(props) => (
          <Button {...props} variant="primary" icon={<CalendarCheck size={18} />} className="w-full sm:w-auto">
            See payment schedule
          </Button>
        )}
      />
      <Dialog size="lg" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-5 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-xl font-semibold text-kumo-default">Payment schedule</Dialog.Title>
            <Dialog.Description className="text-sm text-kumo-subtle">
              {data ? `${data.shopName} · Unit ${data.unitId}` : "Your bills, paid and upcoming."}
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="Close"
            render={(props) => <Button {...props} variant="secondary" shape="square" icon={<X />} aria-label="Close" />}
          />
        </div>

        {error ? (
          <p className="py-10 text-center text-sm text-kumo-danger">{error}</p>
        ) : !data ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : (
          <PaymentSchedule entries={data.entries} emptyText="No bills have been issued to you yet." />
        )}
      </Dialog>
    </Dialog.Root>
  );
}
