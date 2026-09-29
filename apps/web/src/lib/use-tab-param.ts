"use client";

import { useEffect } from "react";

/** Open the `?tab=` given in the URL (e.g. the bell's settings link) if it's one of `allowed`. */
export function useTabParam<T extends string>(allowed: readonly { key: T }[], setTab: (t: T) => void) {
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    const match = allowed.find((t) => t.key === wanted);
    if (match) setTab(match.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
