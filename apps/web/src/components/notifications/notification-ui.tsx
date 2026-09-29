"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Search,
  Settings,
  Star,
  Store,
  Wallet,
} from "lucide-react";
import { notificationTypeInfo, type NotificationIconKey } from "@/lib/notification-types";

const ICONS: Record<NotificationIconKey, React.ComponentType<{ size?: number; className?: string }>> = {
  money: Wallet,
  check: CheckCircle2,
  calendar: CalendarDays,
  alert: AlertTriangle,
  message: MessageSquare,
  store: Store,
  star: Star,
  megaphone: Megaphone,
  settings: Settings,
  search: Search,
  bell: Bell,
};

/** One icon/colour per notification type, shared by the bell and the page. */
export function NotificationIcon({ type, size = 18, boxed = false }: { type: string; size?: number; boxed?: boolean }) {
  const info = notificationTypeInfo(type);
  const Icon = ICONS[info.icon];
  if (!boxed) return <Icon size={size} className={info.tone} />;
  return (
    <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
      <Icon size={size} className={info.tone} />
    </span>
  );
}

export function NotificationTypeLabel({ type, className }: { type: string; className?: string }) {
  return (
    <span className={clsx("text-[10px] font-black uppercase tracking-widest text-slate-400", className)}>
      {notificationTypeInfo(type).label}
    </span>
  );
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Open the chat box on public pages when a customer clicks a message link. */
export function openChatFromRoute(target: string) {
  if (typeof window === "undefined" || !target.includes("chat=open")) return;
  try {
    const url = new URL(target, window.location.origin);
    const shop = url.searchParams.get("shop");
    const detail = { recipient: url.searchParams.get("recipient"), shop: shop ? decodeURIComponent(shop) : null };
    sessionStorage.setItem("pending_chat_open", JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("open-mall-chat", { detail }));
  } catch {
    /* ignore */
  }
}
