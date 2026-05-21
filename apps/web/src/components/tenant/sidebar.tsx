"use client";
import Link from "next/link";
// @ts-ignore
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Presentation,
  MessageSquare,
  Receipt,
  Star,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import clsx from "clsx";

const navItems = [
  {
    href: "/tenantdashboard",
    label: "Overview",
    icon: LayoutDashboard,
    mobileLabel: "Home",
  },
  {
    href: "/tenantdashboard/digital-storefront",
    label: "Storefront",
    icon: Store,
    mobileLabel: "Store",
  },
  {
    href: "/tenantdashboard/ad-promo-manager",
    label: "Ads & Promo",
    icon: Presentation,
    mobileLabel: "Ads",
  },
  {
    href: "/tenantdashboard/customer-messenger",
    label: "Messages",
    icon: MessageSquare,
    mobileLabel: "Chat",
  },
  {
    href: "/tenantdashboard/lease-payments",
    label: "Payments",
    icon: Receipt,
    mobileLabel: "Pay",
  },
  {
    href: "/tenantdashboard/feedback-reviews",
    label: "Reviews",
    icon: Star,
    mobileLabel: "Stars",
  },
];

interface TenantSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const TenantSidebar = ({
  isMobileOpen,
  onMobileClose,
}: TenantSidebarProps = {}) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "bg-black/50",
            "z-40",
            "lg:hidden",
          )}
          onClick={onMobileClose}
        />
      )}
      {/* Sidebar */}
      <aside
        className={clsx(
          "bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-white/10 flex flex-col transition-transform duration-300 ease-in-out",
          "lg:fixed lg:top-20 lg:left-0 lg:h-[calc(100vh-5rem)] lg:w-72 lg:z-30",
          "fixed inset-y-0 left-0 w-72 z-50",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={clsx(
            "flex",
            "items-center",
            "justify-between",
            "p-4",
            "lg:p-6",
            "border-b",
            "border-slate-200",
            "dark:border-white/10",
            "bg-slate-50/50",
            "dark:bg-white/5",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg overflow-hidden border-2 border-white dark:border-zinc-800 shadow-md">
              {/* @ts-ignore */}
              {user?.avatarUrl ? (
                /* @ts-ignore */
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                /* @ts-ignore */
                user?.name ? user.name.charAt(0).toUpperCase() : "T"
              )}
            </div>
          </div>

          <button
            onClick={onMobileClose}
            className={clsx(
              "lg:hidden",
              "p-2",
              "text-slate-500",
              "hover:text-charcoal",
              "dark:hover:text-white",
              "transition-colors",
            )}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>
        <div
          className={clsx(
            "flex-1",
            "overflow-y-auto",
            "py-6",
            "lg:py-8",
            "px-4",
            "lg:px-5",
            "space-y-2",
          )}
        >
          <div className={clsx("px-3", "lg:px-5", "mb-4", "lg:mb-6")}>
            <p
              className={clsx(
                "text-[10px]",
                "font-black",
                "text-slate-400",
                "dark:text-zinc-600",
                "uppercase",
                "tracking-[0.3em]",
                "font-sans",
              )}
            >
              Business Console
            </p>
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const linkContent = (
              <>
                <div
                  className={clsx(
                    "p-2.5 rounded-xl transition-all shrink-0",
                    isActive
                      ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-400 group-hover:text-charcoal dark:group-hover:text-white group-hover:scale-110",
                  )}
                >
                  <Icon size={20} />
                </div>
                <span
                  className={clsx(
                    "tracking-tight",
                    "uppercase",
                    "text-[11px]",
                    "lg:text-xs",
                  )}
                >
                  {isMobile ? item.mobileLabel : item.label}
                </span>
                {isActive && (
                  <div
                    className={clsx(
                      "absolute",
                      "right-3",
                      "lg:right-4",
                      "w-2",
                      "h-2",
                      "bg-primary",
                      "rounded-full",
                      "animate-pulse",
                    )}
                  />
                )}
              </>
            );
            return (
              <div key={item.href} onClick={handleLinkClick}>
                {isActive ? (
                  <div
                    className={clsx(
                      "flex",
                      "items-center",
                      "gap-3",
                      "lg:gap-4",
                      "px-4",
                      "lg:px-5",
                      "py-4",
                      "rounded-[1.25rem]",
                      "transition-all",
                      "font-bold",
                      "text-sm",
                      "relative",
                      "group",
                      "min-h-[56px]",
                      "bg-primary/10",
                      "text-primary",
                      "border",
                      "border-primary/20",
                      "shadow-sm",
                    )}
                  >
                    {linkContent}
                  </div>
                ) : (
                  <Link href={item.href}>
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "gap-3",
                        "lg:gap-4",
                        "px-4",
                        "lg:px-5",
                        "py-4",
                        "rounded-[1.25rem]",
                        "transition-all",
                        "font-bold",
                        "text-sm",
                        "relative",
                        "group",
                        "min-h-[56px]",
                        "text-slate-500",
                        "hover:bg-slate-50",
                        "dark:hover:bg-white/5",
                        "dark:text-slate-400",
                        "dark:hover:text-white",
                        "cursor-pointer",
                      )}
                    >
                      {linkContent}
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
