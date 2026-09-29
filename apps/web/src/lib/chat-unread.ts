"use client";

/**
 * One live source for unread chat messages, shared by the bell's Messages tab,
 * the admin/tenant sidebar badges and the customer chat launcher.
 *
 *  - Refreshes the moment a message is inserted (Supabase Realtime inbox feed),
 *    with a 60 s fallback poll and a refresh when the tab regains focus.
 *  - Shows one "New message from …" toast with a Reply button — skipped for
 *    the chat that's already open on screen.
 *  - Puts the unread count in the browser tab title: "(2) SR Mall".
 */
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { subscribeToInbox, type ChatRealtimeRow } from "@/lib/chat-realtime";
import type { UnreadChat } from "@/app/actions/chat-queries";

export interface ChatUnreadState {
  total: number;
  items: UnreadChat[];
  loaded: boolean;
}

const EMPTY: ChatUnreadState = { total: 0, items: [], loaded: false };
const FALLBACK_MS = 60_000;

let state: ChatUnreadState = EMPTY;
let currentUser: string | null = null;
let mounts = 0;
let stopLive: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Message ids that arrived live and may deserve a toast once we know who sent them. */
const pendingToasts = new Set<string>();
const toasted = new Set<string>();
/** Conversations currently open on screen (messenger / chat box). */
let viewing = new Set<string>();
let navigate: ((href: string) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  applyTitle();
}

export function applyTitle() {
  if (typeof document === "undefined") return;
  const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
  document.title = state.total > 0 ? `(${state.total > 99 ? "99+" : state.total}) ${base}` : base;
}

async function load() {
  const userId = currentUser;
  if (!userId) return;
  const { getUnreadChatsAction } = await import("@/app/actions/chat-queries");
  const res = await getUnreadChatsAction(userId);
  if (currentUser !== userId) return;
  // Anything on screen right now is being read — don't count it.
  const items = res.items.filter((i) => !viewing.has(i.conversationId));
  const hidden = res.items.filter((i) => viewing.has(i.conversationId)).reduce((n, i) => n + i.unread, 0);
  state = { total: Math.max(0, res.total - hidden), items, loaded: true };
  emit();
  showToasts();
}

function showToasts() {
  if (pendingToasts.size === 0) return;
  for (const item of state.items) {
    if (!pendingToasts.has(item.lastMessageId) || toasted.has(item.lastMessageId)) continue;
    toasted.add(item.lastMessageId);
    toast(`💬 New message from ${item.name}`, {
      id: `chat-${item.key}`, // one toast per contact, updated in place
      description: item.preview.length > 90 ? `${item.preview.slice(0, 90)}…` : item.preview,
      duration: 6000,
      action: { label: "Reply", onClick: () => openUnreadChat(item) },
    });
  }
  pendingToasts.clear();
}

export function refreshChatUnread(delay = 0) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void load(), delay);
}

function onLiveMessage(row: ChatRealtimeRow) {
  if (!currentUser || row.senderId === currentUser) return;
  if (!viewing.has(row.conversationId)) pendingToasts.add(row.id);
  // Give an open messenger time to mark the chat read first.
  refreshChatUnread(700);
}

function start(userId: string) {
  if (currentUser === userId && stopLive) return;
  stop();
  currentUser = userId;
  state = EMPTY;
  const unsubscribe = subscribeToInbox(onLiveMessage);
  const poll = setInterval(() => {
    if (!document.hidden) void load();
  }, FALLBACK_MS);
  const onVisible = () => {
    if (!document.hidden) void load();
  };
  document.addEventListener("visibilitychange", onVisible);
  stopLive = () => {
    unsubscribe();
    clearInterval(poll);
    document.removeEventListener("visibilitychange", onVisible);
  };
  void load();
}

function stop() {
  stopLive?.();
  stopLive = null;
  currentUser = null;
  state = EMPTY;
  pendingToasts.clear();
  emit();
}

/** Unread chats for the signed-in user (live). */
export function useChatUnread(userId: string | undefined | null): ChatUnreadState {
  useEffect(() => {
    if (!userId) return;
    mounts++;
    start(userId);
    return () => {
      mounts--;
      // Keep the feed while another badge/bell is still mounted.
      setTimeout(() => {
        if (mounts === 0) stop();
      }, 0);
    };
  }, [userId]);

  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (userId && currentUser === userId ? state : EMPTY),
    () => EMPTY,
  );
}

/**
 * Tell the store which conversations are open on screen, so they don't count
 * as unread or pop a toast. Returns a cleanup function.
 */
export function setViewingChats(ids: string[]) {
  viewing = new Set(ids.filter(Boolean));
  if (state.items.some((i) => viewing.has(i.conversationId))) refreshChatUnread(300);
  return () => {
    viewing = new Set();
    refreshChatUnread(300);
  };
}

/** The bell registers the router so toasts can navigate without a reload. */
export function setChatNavigator(fn: ((href: string) => void) | null) {
  navigate = fn;
}

export function openUnreadChat(item: Pick<UnreadChat, "href">) {
  const href = item.href;
  if (href.includes("chat=open")) {
    try {
      const url = new URL(href, window.location.origin);
      const detail = { recipient: url.searchParams.get("recipient"), shop: url.searchParams.get("shop") };
      sessionStorage.setItem("pending_chat_open", JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent("open-mall-chat", { detail }));
    } catch {
      /* ignore */
    }
  }
  // A messenger that's already open switches to this chat without a reload.
  const conversationId = href.match(/conversationId=([^&]+)/)?.[1];
  if (conversationId) {
    window.dispatchEvent(new CustomEvent("open-chat-conversation", { detail: { conversationId } }));
  }
  if (navigate) navigate(href);
  else window.location.href = href;
}
