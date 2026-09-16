"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Calendar,
  CreditCard,
  MessageSquare,
  Settings,
  Filter,
  Check,
  Search,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/app/actions/notification";
import { getNotificationRoute } from "@/lib/notification-routes";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
}

export default function NotificationsPageClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const res = await getNotificationsAction(user.id);
    if (res.success && res.data) {
      // @ts-ignore
      setNotifications(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SPACE_RESERVATION":
        return <Calendar className="w-5 h-5 text-emerald-500" />;
      case "NEW_BOOKING_INQUIRY":
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case "AD_SUBMISSION_RECEIVED":
        return <Info className="w-5 h-5 text-purple-500" />;
      case "EXPIRING_CONTRACTS":
        return <Calendar className="w-5 h-5 text-orange-500" />;
      case "OVERDUE_RENT_PAYMENTS":
      case "BILLING_REMINDER":
        return <CreditCard className="w-5 h-5 text-red-500" />;
      case "FEEDBACK_SPAM_DETECTED":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "SYSTEM_HEALTH_REPORTS":
        return <Settings className="w-5 h-5 text-gray-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDateTime = (dateInput: string | Date) => {
    return new Date(dateInput).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const markAsRead = async (notificationId: string) => {
    const res = await markNotificationAsReadAction(notificationId);
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const res = await markAllNotificationsAsReadAction(user.id);
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    const targetUrl = getNotificationRoute(notification, user?.role);

    if (typeof window !== "undefined" && targetUrl.includes("chat=open")) {
      try {
        const parsed = new URL(targetUrl, window.location.origin);
        const recipient = parsed.searchParams.get("recipient");
        const shop = parsed.searchParams.get("shop");
        const detail = { recipient, shop: shop ? decodeURIComponent(shop) : null };
        sessionStorage.setItem("pending_chat_open", JSON.stringify(detail));
        window.dispatchEvent(
          new CustomEvent("open-mall-chat", {
            detail,
          }),
        );
      } catch (err) {
        sessionStorage.setItem("pending_chat_open", JSON.stringify({}));
        window.dispatchEvent(new CustomEvent("open-mall-chat", { detail: {} }));
      }
    }

    router.push(targetUrl);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "UNREAD" && n.isRead) return false;
    if (
      searchQuery &&
      !n.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !n.message.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-4 md:p-8 lg:p-10 min-h-screen bg-slate-50/50 dark:bg-black/40 space-y-8 animate-fade-in-up">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-4 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              Notification Center
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-charcoal dark:text-white tracking-tight leading-none italic">
            All <span className="text-primary">Notifications</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
            Review detailed alerts and system updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col overflow-hidden">
        {/* Controls */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-sm group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur opacity-0 group-hover:opacity-10 transition duration-500"></div>
            <div className="relative flex items-center bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 p-2">
              <Search size={18} className="ml-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                className="w-full px-3 py-1 bg-transparent text-charcoal dark:text-white focus:outline-none text-sm font-medium placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex bg-slate-50 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                filter === "ALL"
                  ? "bg-white dark:bg-zinc-700 text-charcoal dark:text-white shadow-sm"
                  : "text-slate-400 hover:text-charcoal dark:hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("UNREAD")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                filter === "UNREAD"
                  ? "bg-white dark:bg-zinc-700 text-charcoal dark:text-white shadow-sm"
                  : "text-slate-400 hover:text-charcoal dark:hover:text-white"
              }`}
            >
              Unread
              {unreadCount > 0 && filter !== "UNREAD" && (
                <span className="w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[9px]">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 dark:border-white/5">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-charcoal dark:text-white mb-2">
                All caught up!
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                You don't have any {filter === "UNREAD" ? "unread " : ""}
                notifications at the moment.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all cursor-pointer group relative ${
                    !notification.isRead
                      ? "bg-primary/[0.02] dark:bg-primary/5 border-l-4 border-l-primary"
                      : "hover:border-l-4 hover:border-l-slate-400"
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        !notification.isRead
                          ? "bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-white/5"
                          : "bg-slate-100 dark:bg-zinc-800/50"
                      }`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-sm md:text-base font-bold group-hover:text-primary transition-colors flex items-center gap-2 ${
                            !notification.isRead
                              ? "text-charcoal dark:text-white"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {notification.title}
                          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </h4>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {formatDateTime(notification.createdAt)}
                        </span>
                        <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to navigate &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                  {!notification.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="shrink-0 self-start sm:self-auto px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-primary hover:text-primary dark:hover:border-primary text-slate-500 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2"
                    >
                      <Check size={14} />
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
