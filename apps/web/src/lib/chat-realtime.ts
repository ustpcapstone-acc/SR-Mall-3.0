"use client";

/**
 * Supabase Realtime for SR-Mall chat.
 *
 * Guarantees this module enforces (see task "Chat Message Performance & Real-Time Fix"):
 *  - ONE channel per conversation, no matter how many effects subscribe to it.
 *  - Subscribing again for the same conversation re-uses the open channel.
 *  - Unsubscribing the last listener disposes the channel (no leaked sockets).
 *  - Automatic reconnection with exponential backoff if the channel drops.
 *  - Duplicate events are dropped by database id before reaching listeners.
 *
 * Events consumed:
 *  - INSERT → new message for this conversation (filtered server-side by
 *    `conversationId=eq.<id>`).
 *  - DELETE → message removed elsewhere (unsend/delete). Not filtered because
 *    Postgres only replicates the primary key for deleted rows; listeners
 *    ignore ids they do not know.
 */

import { supabase } from "@/utils/supabase";

export type ChatRealtimeStatus = "connecting" | "subscribed" | "disconnected";

/** Row shape delivered by `postgres_changes` for the existing Message table. */
export interface ChatRealtimeRow {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

export interface ChatRealtimeHandlers {
  onMessage: (row: ChatRealtimeRow) => void;
  onDelete?: (messageId: string) => void;
  onStatus?: (status: ChatRealtimeStatus) => void;
}

interface ChannelEntry {
  conversationId: string;
  channel: ReturnType<typeof supabase.channel> | null;
  messageHandlers: Set<(row: ChatRealtimeRow) => void>;
  deleteHandlers: Set<(messageId: string) => void>;
  statusHandlers: Set<(status: ChatRealtimeStatus) => void>;
  status: ChatRealtimeStatus;
  retryTimer: ReturnType<typeof setTimeout> | null;
  attempts: number;
  disposed: boolean;
}

/** conversationId → open channel (at most one). */
const registry = new Map<string, ChannelEntry>();
/** conversationId → recently delivered message ids (guards duplicate events). */
const seen = new Map<string, Set<string>>();

const MAX_SEEN_IDS = 400;
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * `Message.createdAt` is a Postgres `timestamp without time zone` that Prisma
 * writes in UTC, but realtime payloads send it without an offset
 * ("2026-09-29T03:37:12.345"). Browsers parse that as *local* time, which put
 * live messages 8 hours in the past (PHT) and sorted them to the top of the
 * thread. Pin such values to UTC so they match rows fetched through Prisma.
 */
function normalizeRow(row: ChatRealtimeRow | undefined): ChatRealtimeRow | undefined {
  if (!row?.createdAt || typeof row.createdAt !== "string") return row;
  const hasOffset = /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(row.createdAt);
  if (hasOffset) return row;
  return { ...row, createdAt: `${row.createdAt.replace(" ", "T")}Z` };
}

/** Realtime is usable only when a real Supabase project is configured. */
export function isChatRealtimeConfigured(): boolean {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return false;
    if (url.includes("placeholder") || key.includes("placeholder")) return false;
    if (!url.startsWith("http")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to message changes for one or more conversations.
 * Returns an unsubscribe function — call it from the effect cleanup.
 */
export function subscribeToConversation(
  conversationIds: Array<string | null | undefined>,
  handlers: ChatRealtimeHandlers,
): () => void {
  const ids = Array.from(
    new Set(
      conversationIds.filter((id): id is string => Boolean(id && id.trim())),
    ),
  );

  if (ids.length === 0 || !isChatRealtimeConfigured()) {
    handlers.onStatus?.("disconnected");
    return () => {};
  }

  const detach = ids.map((id) => attach(id, handlers));

  return () => {
    detach.forEach((fn) => fn());
  };
}

function attach(id: string, handlers: ChatRealtimeHandlers): () => void {
  const entry = getOrCreate(id);

  entry.messageHandlers.add(handlers.onMessage);
  if (handlers.onDelete) entry.deleteHandlers.add(handlers.onDelete);
  if (handlers.onStatus) {
    entry.statusHandlers.add(handlers.onStatus);
    // Report the current state immediately so callers can pick
    // realtime vs. fallback polling without waiting for the socket.
    handlers.onStatus(entry.status);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;

    entry.messageHandlers.delete(handlers.onMessage);
    if (handlers.onDelete) entry.deleteHandlers.delete(handlers.onDelete);
    if (handlers.onStatus) entry.statusHandlers.delete(handlers.onStatus);

    const idle =
      entry.messageHandlers.size === 0 &&
      entry.deleteHandlers.size === 0 &&
      entry.statusHandlers.size === 0;
    if (idle) dispose(id, entry);
  };
}

function getOrCreate(id: string): ChannelEntry {
  const existing = registry.get(id);
  if (existing && !existing.disposed) return existing;

  const entry: ChannelEntry = {
    conversationId: id,
    channel: null,
    messageHandlers: new Set(),
    deleteHandlers: new Set(),
    statusHandlers: new Set(),
    status: "connecting",
    retryTimer: null,
    attempts: 0,
    disposed: false,
  };
  registry.set(id, entry);
  seen.set(id, new Set());
  openChannel(entry);
  return entry;
}

function openChannel(entry: ChannelEntry): void {
  if (entry.disposed) return;

  const channel = supabase.channel(`sr-mall-chat::${entry.conversationId}`);

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Message",
        filter: `conversationId=eq.${entry.conversationId}`,
      },
      (payload: any) => emitMessage(entry.conversationId, normalizeRow(payload?.new)),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "Message" },
      (payload: any) => emitDelete(entry.conversationId, payload?.old),
    )
    .subscribe((status: string) => onChannelStatus(entry.conversationId, status));

  entry.channel = channel;
  setStatus(entry, "connecting");
}

function onChannelStatus(id: string, status: string): void {
  const entry = registry.get(id);
  if (!entry || entry.disposed) return;

  switch (status) {
    case "SUBSCRIBED":
      entry.attempts = 0;
      if (entry.retryTimer) {
        clearTimeout(entry.retryTimer);
        entry.retryTimer = null;
      }
      setStatus(entry, "subscribed");
      break;
    case "CHANNEL_ERROR":
    case "TIMED_OUT":
    case "CLOSED":
      setStatus(entry, "disconnected");
      scheduleReconnect(entry);
      break;
    default:
      // "JOINING" / "TRANSPORT_CLOSED" …
      setStatus(entry, "connecting");
      break;
  }
}

/** Exponential backoff (1s → 30s) until the channel comes back. */
function scheduleReconnect(entry: ChannelEntry): void {
  if (entry.disposed || entry.retryTimer) return;

  const delay = Math.min(
    MAX_RETRY_DELAY_MS,
    1000 * 2 ** Math.min(entry.attempts, 5),
  );
  entry.attempts += 1;

  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (entry.disposed) return;

    const previous = entry.channel;
    entry.channel = null;
    if (previous) {
      try {
        void supabase.removeChannel(previous);
      } catch {
        /* channel already gone */
      }
    }
    openChannel(entry);
  }, delay);
}

function emitMessage(id: string, row: ChatRealtimeRow | undefined): void {
  const entry = registry.get(id);
  if (!entry || entry.disposed || !row?.id) return;

  const delivered = seen.get(id) ?? new Set<string>();
  if (delivered.has(row.id)) return; // duplicate realtime event
  delivered.add(row.id);
  if (delivered.size > MAX_SEEN_IDS) delivered.clear();
  seen.set(id, delivered);

  entry.messageHandlers.forEach((handler) => {
    try {
      handler(row);
    } catch (err) {
      console.error("Chat realtime handler failed:", err);
    }
  });
}

function emitDelete(id: string, old: { id?: string } | undefined): void {
  const entry = registry.get(id);
  const deletedId = old?.id;
  if (!entry || entry.disposed || !deletedId) return;

  entry.deleteHandlers.forEach((handler) => {
    try {
      handler(deletedId);
    } catch (err) {
      console.error("Chat realtime delete handler failed:", err);
    }
  });
}

function setStatus(entry: ChannelEntry, status: ChatRealtimeStatus): void {
  if (entry.status === status) return;
  entry.status = status;
  entry.statusHandlers.forEach((handler) => {
    try {
      handler(status);
    } catch (err) {
      console.error("Chat realtime status handler failed:", err);
    }
  });
}

function dispose(id: string, entry: ChannelEntry): void {
  entry.disposed = true;
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
  registry.delete(id);
  seen.delete(id);

  const channel = entry.channel;
  entry.channel = null;
  if (channel) {
    try {
      void supabase.removeChannel(channel);
    } catch {
      /* nothing to clean up */
    }
  }
}

// ─── Inbox ────────────────────────────────────────────────────────────────────
// Conversation lists (messenger hub / customer messenger) need to know about
// messages in conversations they are NOT subscribed to yet — e.g. a customer
// opening a brand-new chat. One shared, unfiltered INSERT channel serves every
// list on the page; listeners typically debounce a list refresh.

const inboxListeners = new Set<(row: ChatRealtimeRow) => void>();
let inboxChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToInbox(
  onMessage: (row: ChatRealtimeRow) => void,
): () => void {
  if (!isChatRealtimeConfigured()) return () => {};

  inboxListeners.add(onMessage);
  if (!inboxChannel) {
    inboxChannel = supabase
      .channel("sr-mall-chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message" },
        (payload: any) => {
          const row = normalizeRow(payload?.new as ChatRealtimeRow | undefined);
          if (!row?.id) return;
          inboxListeners.forEach((listener) => {
            try {
              listener(row);
            } catch (err) {
              console.error("Chat inbox handler failed:", err);
            }
          });
        },
      )
      .subscribe();
  }

  return () => {
    inboxListeners.delete(onMessage);
    if (inboxListeners.size === 0 && inboxChannel) {
      const channel = inboxChannel;
      inboxChannel = null;
      try {
        void supabase.removeChannel(channel);
      } catch {
        /* channel already gone */
      }
    }
  };
}

/** Diagnostic helper — how many chat sockets are open right now. */
export function openChatRealtimeChannels(): number {
  return registry.size;
}
