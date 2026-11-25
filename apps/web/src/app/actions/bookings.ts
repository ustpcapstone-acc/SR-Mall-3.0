"use server";

import { getAreaSlots, getReservedSlotsWithDetailsAction } from "@/app/actions/space-slot";
import { getInquiriesAction } from "@/app/actions/inquiry";

/**
 * Everything the admin Bookings page needs, in ONE request.
 *
 * The browser runs server actions one at a time, so four separate calls from
 * the page were four round trips in a row. On the server these are plain
 * function calls, so the queries genuinely run in parallel.
 */
export async function getBookingsDataAction() {
  const [slots, inquiries, reservedDetailed] = await Promise.all([
    getAreaSlots(),
    getInquiriesAction(),
    getReservedSlotsWithDetailsAction(),
  ]);
  return { slots, inquiries, reservedDetailed };
}
