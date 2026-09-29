"use client";

import { useEffect } from "react";
import { applyThemeColor } from "@/lib/theme";

/** Dashboards always use the default brand colour, whatever the public site uses. */
export function ResetPublicTheme() {
  useEffect(() => {
    applyThemeColor(null);
  }, []);
  return null;
}
