"use client";

import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { CalendarBlank } from "@phosphor-icons/react";
import { getMyStaffAccessAction } from "@/app/actions/staff";
import { canOpen } from "@/lib/permissions";
import { PaymentLedgerDialog } from "./payment-ledger-dialog";

/**
 * Dashboard header button: who has paid each month, and any tenant's schedule.
 * Hidden from staff who can't open Tenant Monitoring.
 */
export function PaymentScheduleButton({ adminId }: { adminId?: string }) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyStaffAccessAction().then((a) => alive && setAllowed(!!a && canOpen(a, "/admindashboard/tenant-monitoring")));
    return () => {
      alive = false;
    };
  }, []);

  if (!allowed) return null;

  return (
    <>
      <Button variant="secondary" icon={<CalendarBlank />} onClick={() => setOpen(true)}>
        Payment schedule
      </Button>
      <PaymentLedgerDialog open={open} onOpenChange={setOpen} adminId={adminId} />
    </>
  );
}
