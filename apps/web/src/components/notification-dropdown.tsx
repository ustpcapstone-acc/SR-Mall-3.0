"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  Check,
  CheckCircle,
  X,
  AlertTriangle,
  Info,
  Calendar,
  CreditCard,
  MessageSquare,
  Settings,
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
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
}

interface NotificationDropdownProps {
  className?: string;
}

export default function NotificationDropdown({
  className = "",
}: NotificationDropdownProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const mountTimeRef = useRef(Date.now());
  const isFetchingRef = useRef(false);

  const loadNotifications = async () => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await getNotificationsAction(user.id);
      if (res.success && res.data) {
        const data = res.data as unknown as Notification[];

        // Only show informational toast pop-up for notifications created after page mount
        if (!isInitialLoadRef.current) {
          const newlyArrived = data.filter(
            (n) =>
              !n.isRead &&
              !seenIdsRef.current.has(n.id) &&
              new Date(n.createdAt).getTime() >= mountTimeRef.current,
          );
          newlyArrived.forEach((n) => {
            // Purely informational toast; does NOT redirect or hijack navigation
            toast.info(n.title, {
              description: n.message,
              duration: 5000,
            });
          });
        }

        // Record all seen notification IDs
        data.forEach((n) => seenIdsRef.current.add(n.id));
        isInitialLoadRef.current = false;

        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.isRead).length);
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    loadNotifications();

    // Fast polling (10 seconds) for real-time notification pop-ups
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SPACE_RESERVATION":
        return <Calendar className="w-4 h-4 text-emerald-500" />;
      case "NEW_BOOKING_INQUIRY":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "AD_SUBMISSION_RECEIVED":
        return <Info className="w-4 h-4 text-purple-500" />;
      case "EXPIRING_CONTRACTS":
        return <Calendar className="w-4 h-4 text-orange-500" />;
      case "OVERDUE_RENT_PAYMENTS":
      case "BILLING_REMINDER":
        return <CreditCard className="w-4 h-4 text-red-500" />;
      case "FEEDBACK_SPAM_DETECTED":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "SYSTEM_HEALTH_REPORTS":
        return <Settings className="w-4 h-4 text-gray-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const markAsRead = async (notificationId: string) => {
    const res = await markNotificationAsReadAction(notificationId);
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const res = await markAllNotificationsAsReadAction(user.id);
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
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

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all group"
      >
        <Bell size={20} className="group-hover:animate-pulse" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="fixed sm:absolute left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 right-auto sm:right-0 top-24 sm:top-12 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 z-50 overflow-hidden max-w-sm sm:max-w-none">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-charcoal dark:text-white">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-primary hover:text-primary-hover transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    No notifications yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    We'll notify you when something important happens
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all cursor-pointer group relative ${
                      !notification.isRead
                        ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary"
                        : "hover:border-l-4 hover:border-l-slate-400"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-charcoal dark:text-white mb-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {notification.title}
                              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                Click to open &rarr;
                              </span>
                            </div>
                          </div>
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-4 h-4 text-primary" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => {
                if (user?.role === "ADMIN") {
                  router.push("/admindashboard/notifications");
                } else if (user?.role === "TENANT") {
                  router.push("/tenantdashboard/notifications");
                } else {
                  router.push("/profile/notifications");
                }
                setIsOpen(false);
              }}
              className="w-full text-center py-4 border-t border-slate-100 dark:border-white/5 text-xs font-bold text-primary hover:text-primary-hover transition-colors bg-slate-50/50 dark:bg-zinc-800/30"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
