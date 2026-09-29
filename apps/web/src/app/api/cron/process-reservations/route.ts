import { NextResponse } from "next/server";
import { runAllSweeps } from "@/lib/sweeps";

export const dynamic = "force-dynamic";

/**
 * Auto-rejection sweep endpoint. Runs every rule the system enforces on its
 * own so one call keeps all pending queues honest:
 *
 *   1. Space Reservation    — released after its window
 *   2. Merchant Application — auto-rejected after 72 hours pending
 *   3. Event Booking        — auto-rejected after 72 hours pending
 */

export async function GET() {
  try {
    const result = await runAllSweeps();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error in process-reservations cron route:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
