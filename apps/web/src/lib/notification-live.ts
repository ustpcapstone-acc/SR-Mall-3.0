"use client";

/**
 * New notifications for the signed-in user, pushed by Supabase Realtime
 * (INSERT on "Notification" filtered by userId). One channel per user,
 * shared by every bell / notifications page open in the tab.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { isChatRealtimeConfigured } from "@/lib/chat-realtime";
import type { NotificationItem } from "@/app/actions/notification";

type Listener = (n: NotificationItem) => void;

const channels = new Map<string, { channel: ReturnType<typeof supabase.channel>; listeners: Set<Listener> }>();

function toItem(row: any): NotificationItem | null {
  if (!row?.id) return null;
  // Timestamps arrive without a zone; Prisma stores UTC (see chat-realtime).
  const raw = String(row.createdAt || "");
  const createdAt = /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(raw) ? raw : `${raw.replace(" ", "T")}Z`;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.isRead),
    createdAt: new Date(createdAt).toISOString(),
    link: row.link ?? null,
  };
}

function subscribe(userId: string, listener: Listener) {
  let entry = channels.get(userId);
  if (!entry) {
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(`sr-mall-notifications::${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification", filter: `userId=eq.${userId}` },
        (payload: any) => {
          const item = toItem(payload?.new);
          if (item) listeners.forEach((l) => l(item));
        },
      )
      .subscribe();
    entry = { channel, listeners };
    channels.set(userId, entry);
  }
  entry.listeners.add(listener);
  return () => {
    const e = channels.get(userId);
    if (!e) return;
    e.listeners.delete(listener);
    if (e.listeners.size === 0) {
      channels.delete(userId);
      void supabase.removeChannel(e.channel);
    }
  };
}

/**
 * Call `onNew` for each notification created for `userId` while mounted, and
 * `refresh` every `fallbackMs` (and on tab focus) in case realtime is down.
 */
export function useLiveNotifications(
  userId: string | undefined,
  onNew: Listener,
  refresh: () => void,
  fallbackMs = 60000,
) {
  const onNewRef = useRef(onNew);
  const refreshRef = useRef(refresh);
  onNewRef.current = onNew;
  refreshRef.current = refresh;

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = isChatRealtimeConfigured() ? subscribe(userId, (n) => onNewRef.current(n)) : () => {};
    const poll = setInterval(() => {
      if (!document.hidden) refreshRef.current();
    }, fallbackMs);
    const onVisible = () => {
      if (!document.hidden) refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, fallbackMs]);
}
