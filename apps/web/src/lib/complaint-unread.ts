"use client";

import { useEffect, useState } from "react";
import { getComplaintUnreadCountAction } from "@/app/actions/complaint";
import { COMPLAINTS_CHANGED_EVENT } from "@/lib/complaints";

/** Tell sidebars a complaint changed (sent, replied, opened, status). */
export function announceComplaintsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COMPLAINTS_CHANGED_EVENT));
}

/**
 * Number of complaints with something new for this user (admin: new/open
 * complaints with tenant activity it hasn't opened; tenant: admin replies or
 * status changes it hasn't seen). Refreshes every minute, on focus and on
 * `announceComplaintsChanged()`.
 */
export function useComplaintUnread(userId?: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () =>
      getComplaintUnreadCountAction(userId)
        .then((n) => alive && setCount(n))
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(COMPLAINTS_CHANGED_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(COMPLAINTS_CHANGED_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return count;
}
