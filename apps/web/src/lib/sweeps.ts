import { after } from "next/server";
import { processExpiredReservationsAction } from "@/app/actions/space-slot";
import { processExpiredMerchantApplicationsAction } from "@/app/actions/tenant";
import { processExpiredEventBookingsAction } from "@/app/actions/inquiry";

/**
 * Auto-rejection sweeps (expired reservations, merchant applications, event
 * bookings) used to run *inside* the admin read actions, so every Bookings
 * load waited on writes, notifications and emails before showing anything.
 *
 * Reads now call `scheduleSweeps()` instead: the sweep runs after the response
 * has been sent, at most once per SWEEP_INTERVAL_MS per server instance. The
 * `/api/cron/process-reservations` cron still runs them on a schedule.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let lastSweepAt = 0;
let sweeping = false;

export async function runAllSweeps() {
  const [reservations, merchantApplications, eventBookings] = await Promise.all([
    processExpiredReservationsAction(),
    processExpiredMerchantApplicationsAction(),
    processExpiredEventBookingsAction(),
  ]);
  return { reservations, merchantApplications, eventBookings };
}

export function scheduleSweeps() {
  if (sweeping || Date.now() - lastSweepAt < SWEEP_INTERVAL_MS) return;
  sweeping = true;
  lastSweepAt = Date.now();

  after(async () => {
    try {
      await runAllSweeps();
    } catch (err) {
      console.error("[SWEEPS] background sweep failed:", err);
    } finally {
      sweeping = false;
    }
  });
}
