"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  ShieldAlert,
  Presentation,
  Palette,
  ClipboardList,
  UserCog,
  Store,
  FileText,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { useChatUnread } from "@/lib/chat-unread";
import { useComplaintUnread } from "@/lib/complaint-unread";
import { getMyStaffAccessAction } from "@/app/actions/staff";
import { canOpen, type StaffAccess } from "@/lib/permissions";

/** Grouped by what staff are doing, in the order of a normal day. */
const navGroups = [
  {
    title: "Today",
    items: [
      { href: "/admindashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admindashboard/messenger-hub", label: "Messages", icon: MessageSquare },
      { href: "/admindashboard/complaints", label: "Complaints", icon: ClipboardList },
    ],
  },
  {
    title: "Leasing",
    items: [
      { href: "/admindashboard/rent-requests", label: "Rent Requests", icon: FileText },
      { href: "/admindashboard/bookings", label: "Bookings", icon: Calendar },
      { href: "/admindashboard/renewals", label: "Renewals", icon: RefreshCw },
    ],
  },
  {
    title: "Mall",
    items: [
      { href: "/admindashboard/space-manager", label: "Floor Spaces & Map", icon: Presentation },
      { href: "/admindashboard/tenant-monitoring", label: "Tenant Monitoring", icon: Users },
    ],
  },
  {
    title: "Website",
    items: [
      { href: "/admindashboard/public-view-cms", label: "Website Content", icon: Palette },
      { href: "/admindashboard/ad-scheduler", label: "Ad Scheduler", icon: Presentation },
    ],
  },
  {
    title: "Accounts",
    items: [
      { href: "/admindashboard/user-management", label: "User Management", icon: ShieldAlert },
      { href: "/admindashboard/roles-staff", label: "Roles & Staff", icon: UserCog },
    ],
  },
];

export const AdminSidebar = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  // Live unread chat count (same source as the bell's Messages tab).
  const unreadMessages = useChatUnread(user?.id).total;
  // Open complaints with tenant activity no admin has opened yet.
  const unreadComplaints = useComplaintUnread(user?.id);
  // Only the sections this account's role opens (the server enforces it too).
  const [access, setAccess] = useState<StaffAccess | null>(null);
  useEffect(() => {
    let alive = true;
    getMyStaffAccessAction().then((a) => alive && setAccess(a));
    return () => {
      alive = false;
    };
  }, [user?.id]);
  // A group whose pages this role can't open is left out entirely.
  const visibleGroups = access
    ? navGroups
        .map((g) => ({ ...g, items: g.items.filter((item) => canOpen(access, item.href)) }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <aside
      className={clsx(
        "w-72",
        "bg-white",
        "dark:bg-[#161b26]",
        "border-r",
        "border-slate-200",
        "dark:border-slate-800",
        "flex",
        "flex-col",
        "h-[calc(100vh-5rem)]",
        "fixed",
        "top-20",
        "left-0",
        "z-40",
        "transition-colors",
      )}
    >
      <div
        className={clsx(
          "flex-1",
          "overflow-y-auto",
          "py-4",
          "px-5",
          "space-y-1",
        )}
      >
        {visibleGroups.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} className="space-y-1 pb-3">
            <p className="px-5 pt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{group.title}</p>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-4 px-5 py-2 rounded-2xl transition-all font-bold text-sm relative group",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  <div
                    className={clsx(
                      "p-2 rounded-xl transition-all",
                      isActive
                        ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                        : "bg-slate-50 dark:bg-zinc-900 text-slate-400 group-hover:text-charcoal dark:group-hover:text-white group-hover:scale-110 group-hover:rotate-6",
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="tracking-tight text-xs flex-1">
                    {item.label}
                  </span>
                  {(() => {
                    const badge = item.icon === MessageSquare ? unreadMessages : item.icon === ClipboardList ? unreadComplaints : 0;
                    return badge > 0 ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white mr-2 shadow-md">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null;
                  })()}
                  {isActive && (
                    <div className="absolute right-4 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};
