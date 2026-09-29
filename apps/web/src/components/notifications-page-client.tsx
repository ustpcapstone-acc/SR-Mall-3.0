"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Loader2, Settings, Trash2 } from "lucide-react";
import { useAuth } from "@/app/providers";
import {
  clearReadNotificationsAction,
  deleteNotificationAction,
  getNotificationsAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
  type NotificationItem,
  type NotificationTab,
} from "@/app/actions/notification";
import { getNotificationRoute } from "@/lib/notification-routes";
import { notificationSettingsHref } from "@/lib/notification-types";
import { useLiveNotifications } from "@/lib/notification-live";
import { formatDayLabel, startsNewDay } from "@/lib/chat-time";
import { NotificationIcon, NotificationTypeLabel, openChatFromRoute, timeAgo } from "@/components/notifications/notification-ui";

const PAGE_SIZE = 30;

const TABS: { key: NotificationTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "MONEY", label: "Money" },
  { key: "ACTION", label: "Action needed" },
  { key: "SECURITY", label: "Security" },
  { key: "INFO", label: "Updates" },
  { key: "MESSAGE", label: "Messages" },
];

/** Shared by /admindashboard/notifications, /tenantdashboard/notifications and /profile/notifications. */
export default function NotificationsPageClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<NotificationTab>("ALL");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!user?.id) return;
      if (showSpinner) setLoading(true);
      const res = await getNotificationsAction(user.id, { tab, limit: PAGE_SIZE });
      if (res.success) {
        setItems(res.data.items);
        setHasMore(res.data.hasMore);
        setUnreadCount(res.data.unreadCount);
      } else toast.error(res.error);
      setLoading(false);
    },
    [user?.id, tab],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useLiveNotifications(
    user?.id,
    (n) => {
      if (tab === "ALL" || tab === "UNREAD") setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
      else void load(false);
      if (n.type !== "MESSAGE") setUnreadCount((c) => c + 1);
    },
    () => load(false),
  );

  const loadMore = async () => {
    if (!user?.id || !items.length) return;
    setLoadingMore(true);
    const res = await getNotificationsAction(user.id, { tab, limit: PAGE_SIZE, before: items[items.length - 1].createdAt });
    if (res.success) {
      setItems((prev) => [...prev, ...res.data.items.filter((n) => !prev.some((p) => p.id === n.id))]);
      setHasMore(res.data.hasMore);
    }
    setLoadingMore(false);
  };

  const markRead = async (n: NotificationItem) => {
    if (!user?.id || n.isRead) return;
    setItems((prev) => (tab === "UNREAD" ? prev.filter((p) => p.id !== n.id) : prev.map((p) => (p.id === n.id ? { ...p, isRead: true } : p))));
    if (n.type !== "MESSAGE") setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationAsReadAction(user.id, n.id);
  };

  const remove = async (n: NotificationItem) => {
    if (!user?.id) return;
    setItems((prev) => prev.filter((p) => p.id !== n.id));
    if (!n.isRead && n.type !== "MESSAGE") setUnreadCount((c) => Math.max(0, c - 1));
    const res = await deleteNotificationAction(user.id, n.id);
    if (!res.success) {
      toast.error("Couldn't delete the notification");
      void load(false);
    }
  };

  const markAll = async () => {
    if (!user?.id) return;
    setBusy(true);
    await markAllNotificationsAsReadAction(user.id);
    await load(false);
    setBusy(false);
    toast.success("All notifications marked as read");
  };

  const clearRead = async () => {
    if (!user?.id) return;
    setBusy(true);
    const res = await clearReadNotificationsAction(user.id);
    await load(false);
    setBusy(false);
    if (res.success) toast.success(res.deleted ? `Cleared ${res.deleted} read notification${res.deleted === 1 ? "" : "s"}` : "Nothing to clear");
    else toast.error(res.error || "Couldn't clear notifications");
  };

  const open = (n: NotificationItem) => {
    void markRead(n);
    const target = getNotificationRoute(n, user?.role);
    openChatFromRoute(target);
    router.push(target);
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1100px] mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <Bell size={12} /> {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Notifi<span className="text-primary">cations.</span>
          </h1>
          <p className="text-slate-500 font-medium">Everything the system has told you, newest first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={markAll}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-40"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
          <button
            type="button"
            onClick={clearRead}
            disabled={busy}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
          >
            <Trash2 size={14} /> Clear read
          </button>
          <Link
            href={notificationSettingsHref(user?.role)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Settings size={14} /> Settings
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 w-fit max-w-full overflow-x-auto shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              tab === t.key ? "bg-primary text-white shadow-md shadow-primary/25" : "text-slate-400 hover:text-charcoal dark:hover:text-white",
            )}
          >
            {t.label}
            {t.key === "UNREAD" && unreadCount > 0 && tab !== "UNREAD" && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center space-y-2 px-6">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-black text-charcoal dark:text-white">Nothing here</p>
            <p className="text-sm text-slate-500">
              {tab === "UNREAD" ? "You've read everything." : "Notifications in this category will appear here."}
            </p>
          </div>
        ) : (
          <ul>
            {items.map((n, i) => (
              <li key={n.id}>
                {startsNewDay(items[i - 1]?.createdAt, n.createdAt) && (
                  <p className="px-6 pt-5 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/60 dark:bg-white/[0.02] border-y border-slate-100 dark:border-white/5 first:border-t-0">
                    {formatDayLabel(n.createdAt)}
                  </p>
                )}
                <div
                  className={clsx(
                    "group flex items-start gap-4 px-6 py-4 border-b border-slate-100 dark:border-white/5 transition-colors",
                    n.isRead ? "hover:bg-slate-50 dark:hover:bg-zinc-800/40" : "bg-primary/[0.04] hover:bg-primary/[0.07]",
                  )}
                >
                  <button type="button" onClick={() => open(n)} className="flex items-start gap-4 flex-1 min-w-0 text-left">
                    <NotificationIcon type={n.type} boxed />
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={clsx("text-sm text-charcoal dark:text-white", n.isRead ? "font-medium" : "font-black")}>{n.title}</span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                      </span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5 [overflow-wrap:anywhere]">{n.message}</span>
                      <span className="flex items-center gap-2 mt-1.5">
                        <NotificationTypeLabel type={n.type} />
                        <span className="text-[10px] font-bold text-slate-400">· {timeAgo(n.createdAt)}</span>
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead(n)}
                        title="Mark as read"
                        aria-label="Mark as read"
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      title="Delete"
                      aria-label="Delete notification"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="p-4 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />} Load older
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
