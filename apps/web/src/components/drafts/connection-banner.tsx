"use client";

import { cn } from "@cloudflare/kumo";
import { useConnection } from "@/lib/drafts/online";

/** Shown on every page while the connection is gone, and briefly when it returns. */
export function ConnectionBanner() {
  const { online, backOnline } = useConnection();
  const visible = !online || backOnline;

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-[400] flex justify-center px-3">
      {visible && (
        <p
          className={cn(
            "rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white shadow-2xl",
            online ? "bg-emerald-700" : "bg-neutral-900",
          )}
        >
          {online ? "Back online" : "You're offline. Forms keep a draft on this device."}
        </p>
      )}
    </div>
  );
}
