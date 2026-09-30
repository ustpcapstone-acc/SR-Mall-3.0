"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Bell, CheckCheck, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import {
  getNotificationsAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
  type NotificationItem,
} from "@/app/actions/notification";
import { getNotificationRoute } from "@/lib/notification-routes";
import { notificationSettingsHref, notificationsPageHref } from "@/lib/notification-types";
import { useLiveNotifications } from "@/lib/notification-live";
import { applyTitle, openUnreadChat, setChatNavigator, useChatUnread } from "@/lib/chat-unread";
import type { UnreadChat } from "@/app/actions/chat-queries";
import { NotificationIcon, openChatFromRoute, timeAgo } from "@/components/notifications/notification-ui";

const BELL_LIMIT = 10;

/**
 * The bell in the admin, tenant and public navbars. One list, newest first:
 *  - alerts (reservations, payments, reviews, applications…)
 *  - unread chats, one row per contact ("Demo Shop · 2 new messages"), from the
 *    live chat-unread store — the same count as the sidebar / launcher badges.
 */
export default function NotificationDropdown({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const chats = useChatUnread(user?.id);
  const pathname = usePathname();

  const load = useCallback(async () => {
    if (!user?.id) return;
    const res = await getNotificationsAction(user.id, { excludeMessages: true, limit: BELL_LIMIT });
    if (res.success) {
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // New alert → show it right away (and a toast), no polling needed.
  // Chat messages get their own toast from the chat-unread store.
  useLiveNotifications(
    user?.id,
    (n) => {
      if (n.type === "MESSAGE") return;
      setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, BELL_LIMIT)));
      setUnreadCount((c) => c + 1);
      toast.info(n.title, { description: n.message, duration: 5000 });
    },
    load,
  );

  // Chat toasts' "Reply" buttons navigate through the router (no full reload).
  useEffect(() => {
    setChatNavigator((href) => router.push(href));
    return () => setChatNavigator(null);
  }, [router]);
  // Keep "(n)" in the browser tab title after page changes.
  useEffect(() => {
    const t = setTimeout(applyTitle, 50);
    return () => clearTimeout(t);
  }, [pathname, chats.total]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const markRead = async (id: string) => {
    if (!user?.id) return;
    const target = items.find((n) => n.id === id);
    if (!target || target.isRead) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationAsReadAction(user.id, id);
  };

  const markAll = async () => {
    if (!user?.id) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsAsReadAction(user.id, { excludeMessages: true });
  };

  const open = (n: NotificationItem) => {
    void markRead(n.id);
    setIsOpen(false);
    const target = getNotificationRoute(n, user?.role);
    openChatFromRoute(target);
    router.push(target);
  };

  const openChat = (chat: UnreadChat) => {
    setIsOpen(false);
    openUnreadChat(chat);
  };

  if (!user) return null;
  const badge = unreadCount + chats.total;
  // Chats and alerts in one timeline, newest first.
  const rows: ({ kind: "chat"; at: string; chat: UnreadChat } | { kind: "alert"; at: string; n: NotificationItem })[] = [
    ...chats.items.map((chat) => ({ kind: "chat" as const, at: chat.lastAt, chat })),
    ...items.map((n) => ({ kind: "alert" as const, at: n.createdAt, n })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={badge > 0 ? `Notifications, ${badge} unread` : "Notifications"}
        aria-expanded={isOpen}
        className="relative p-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
      >
        <Bell size={20} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed sm:absolute left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 sm:right-0 top-24 sm:top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-charcoal dark:text-white">Notifications</h3>
                {badge > 0 && (
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {badge} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    title="Mark all alerts as read"
                    aria-label="Mark all alerts as read"
                    className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                  >
                    <CheckCheck size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(notificationSettingsHref(user.role));
                  }}
                  title="Notification settings"
                  aria-label="Notification settings"
                  className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                >
                  <Settings size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="p-2 rounded-lg text-slate-400 hover:text-charcoal dark:hover:text-white sm:hidden"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {rows.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-charcoal dark:text-white">You&apos;re all caught up</p>
                  <p className="text-xs text-slate-400 mt-1">New alerts and messages will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                  {rows.map((row) =>
                    row.kind === "chat" ? (
                      <li key={`chat-${row.chat.key}`}>
                        <button
                          type="button"
                          onClick={() => openChat(row.chat)}
                          className="w-full text-left flex items-start gap-3 px-5 py-4 transition-colors bg-primary/[0.04] hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                        >
                          <span className="mt-0.5">
                            <NotificationIcon type="MESSAGE" size={16} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-charcoal dark:text-white truncate">
                              {row.chat.name} · {row.chat.unread} new message{row.chat.unread === 1 ? "" : "s"}
                            </span>
                            <span className="block text-xs text-slate-500 line-clamp-2 mt-0.5">{row.chat.preview}</span>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                              {timeAgo(row.chat.lastAt)} · Tap to reply
                            </span>
                          </span>
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                        </button>
                      </li>
                    ) : (() => {
                    const n = row.n;
                    return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        className={clsx(
                          "w-full text-left flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60",
                          !n.isRead && "bg-primary/[0.04]",
                        )}
                      >
                        <span className="mt-0.5">
                          <NotificationIcon type={n.type} size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={clsx("block text-sm text-charcoal dark:text-white", n.isRead ? "font-medium" : "font-bold")}>
                            {n.title}
                          </span>
                          <span className="block text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                        {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />}
                      </button>
                    </li>
                    );
                    })(),
                  )}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push(notificationsPageHref(user.role));
              }}
              className="w-full text-center py-3.5 border-t border-slate-100 dark:border-white/5 text-xs font-black uppercase tracking-widest text-primary hover:bg-slate-50 dark:hover:bg-zinc-800/40"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
