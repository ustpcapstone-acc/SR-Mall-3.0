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
      // A tenant's alert may belong to another shop or unit: reload the workspace's list.
      if (user?.role === "TENANT") return void load(false);
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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-kumo-line">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20">
            <Bell size={12} /> {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">
            Notifications
          </h1>
          <p className="text-kumo-subtle font-medium">Everything the system has told you, newest first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={markAll}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/20 disabled:opacity-40"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
          <button
            type="button"
            onClick={clearRead}
            disabled={busy}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-kumo-line text-xs font-semibold text-kumo-subtle hover:bg-kumo-tint disabled:opacity-40"
          >
            <Trash2 size={14} /> Clear read
          </button>
          <Link
            href={notificationSettingsHref(user?.role)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-kumo-line text-xs font-semibold text-kumo-subtle hover:bg-kumo-tint"
          >
            <Settings size={14} /> Settings
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 bg-kumo-base rounded-2xl border border-kumo-line w-fit max-w-full overflow-x-auto shadow-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              tab === t.key ? "bg-primary text-white shadow-md shadow-primary/25" : "text-kumo-subtle hover:text-kumo-default",
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
      <div className="bg-kumo-base border border-kumo-line rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center space-y-2 px-6">
            <Bell className="w-10 h-10 text-kumo-subtle mx-auto" />
            <p className="font-semibold text-kumo-default">Nothing here</p>
            <p className="text-sm text-kumo-subtle">
              {tab === "UNREAD" ? "You've read everything." : "Notifications in this category will appear here."}
            </p>
          </div>
        ) : (
          <ul>
            {items.map((n, i) => (
              <li key={n.id}>
                {startsNewDay(items[i - 1]?.createdAt, n.createdAt) && (
                  <p className="px-6 pt-5 pb-2 text-xs font-semibold text-kumo-subtle bg-kumo-recessed border-y border-kumo-line first:border-t-0">
                    {formatDayLabel(n.createdAt)}
                  </p>
                )}
                <div
                  className={clsx(
                    "group flex items-start gap-4 px-6 py-4 border-b border-kumo-line transition-colors",
                    n.isRead ? "hover:bg-kumo-tint" : "bg-primary/4 hover:bg-primary/[0.07]",
                  )}
                >
                  <button type="button" onClick={() => open(n)} className="flex items-start gap-4 flex-1 min-w-0 text-left">
                    <NotificationIcon type={n.type} boxed />
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={clsx("text-sm text-kumo-default", n.isRead ? "font-medium" : "font-semibold")}>{n.title}</span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                      </span>
                      <span className="block text-sm text-kumo-subtle mt-0.5 wrap-anywhere">{n.message}</span>
                      <span className="flex items-center gap-2 mt-1.5">
                        <NotificationTypeLabel type={n.type} />
                        <span className="text-xs font-bold text-kumo-subtle">· {timeAgo(n.createdAt)}</span>
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
                        className="p-2 rounded-lg text-kumo-subtle hover:text-primary hover:bg-primary/10"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      title="Delete"
                      aria-label="Delete notification"
                      className="p-2 rounded-lg text-kumo-subtle hover:text-red-600 hover:bg-red-500/10"
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-kumo-recessed text-xs font-semibold text-kumo-subtle hover:bg-kumo-tint disabled:opacity-50"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />} Load older
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
