"use client";

/**
 * Live unit (AreaSlot) status for the public pages.
 *
 * When a customer reserves a unit, every other open "Available Spaces" /
 * homepage list flips that card to Pending within a second (Supabase
 * Realtime on the AreaSlot table), so nobody else starts reserving it.
 * A slow poll + refresh-on-focus covers the case where realtime is down.
 */
import { useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { isChatRealtimeConfigured } from "@/lib/chat-realtime";

type SlotPatch = { id: string; status: string; tenant_id: string | null };
type Listener = (patch: SlotPatch) => void;

const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;

/** Same-tab broadcast (e.g. the modal after a successful reservation). */
export function announceSlotChange(patch: SlotPatch) {
  listeners.forEach((l) => l(patch));
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  if (!channel && isChatRealtimeConfigured()) {
    channel = supabase
      .channel("sr-mall-slots")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "AreaSlot" }, (payload: any) => {
        const row = payload?.new;
        if (!row?.id) return;
        announceSlotChange({ id: row.id, status: row.status, tenant_id: row.tenant_id ?? null });
      })
      .subscribe();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      const c = channel;
      channel = null;
      void supabase.removeChannel(c);
    }
  };
}

/**
 * Keep a list of slots live. `apply` merges a status change into the list;
 * `refetch` reloads it (used on tab focus and every 30s as a fallback).
 */
export function useLiveSlots(apply: (patch: SlotPatch) => void, refetch: () => void) {
  useEffect(() => {
    const unsubscribe = subscribe(apply);
    const poll = setInterval(() => {
      if (!document.hidden) refetch();
    }, 30000);
    const onVisible = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // apply/refetch are stable page callbacks; re-subscribing each render isn't wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Merge a status change into a slot array (returns the same array if nothing changed). */
export function mergeSlotPatch<T extends { id: string; status: string; tenant_id?: string | null }>(
  list: T[],
  patch: SlotPatch,
): T[] {
  let changed = false;
  const next = list.map((s) => {
    if (s.id !== patch.id || (s.status === patch.status && (s.tenant_id ?? null) === patch.tenant_id)) return s;
    changed = true;
    return { ...s, status: patch.status, tenant_id: patch.tenant_id };
  });
  return changed ? next : list;
}

/**
 * Can this viewer open a unit card? Available units: yes. A unit someone
 * else has reserved (Pending) or that's occupied: no. Your own reservation: yes.
 */
export function slotAccess(slot: { status: string; tenant_id?: string | null }, viewerId?: string | null) {
  if (slot.status === "AVAILABLE") return { open: true, label: "Available", mine: false } as const;
  const mine = Boolean(viewerId && slot.tenant_id === viewerId);
  if (slot.status === "RESERVED") return { open: mine, label: mine ? "Your reservation" : "Pending", mine } as const;
  return { open: false, label: "Occupied", mine } as const;
}
