"use client";

import { useCallback, useEffect, useState } from "react";
import { getFloorsAction } from "@/app/actions/floors";
import { DEFAULT_FLOORS, floorLabel, type Floor } from "@/lib/floors";
import { invalidateSharedRequest, sharedRequest } from "@/lib/shared-request";

// One list for the whole page, however many cards ask for it.
let current: Floor[] = DEFAULT_FLOORS;
const listeners = new Set<(floors: Floor[]) => void>();

/** Load the floors; pass `true` right after changing them. */
export async function refreshFloors(changed = false) {
  if (changed) invalidateSharedRequest("floors");
  try {
    const res = await sharedRequest("floors", () => getFloorsAction(), 5 * 60_000);
    if (!res.success) return;
    current = res.data;
    listeners.forEach((listener) => listener(current));
  } catch {
    // Offline: keep the names already shown.
  }
}

/** The mall's floors (bottom up) and `label(id)` for a unit's floor name. */
export function useFloors() {
  const [floors, setFloors] = useState(current);
  useEffect(() => {
    listeners.add(setFloors);
    setFloors(current);
    void refreshFloors();
    return () => {
      listeners.delete(setFloors);
    };
  }, []);
  const label = useCallback((id?: string | null) => floorLabel(id, floors), [floors]);
  return { floors, label };
}
