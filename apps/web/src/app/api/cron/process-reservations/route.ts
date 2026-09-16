import { NextResponse } from "next/server";
import { processExpiredReservationsAction } from "@/app/actions/space-slot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await processExpiredReservationsAction();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in process-reservations cron route:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
