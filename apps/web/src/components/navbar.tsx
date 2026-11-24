"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  User,
  Menu,
  LogOut,
  ChevronDown,
  X,
  Heart,
  ShoppingBag,
  LayoutDashboard,
} from "lucide-react";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { getPublicViewConfigAction } from "@/app/actions/cms";
import { applyThemeColor, PUBLIC_CONFIG_CACHE_KEY } from "@/lib/theme";
import { syncFavorites } from "@/lib/favorites";
import { DigitalStorefront } from "@/types/storefront";
import { useAuth } from "@/app/providers";
import { LoginModal } from "./login-modal";
import NotificationDropdown from "./notification-dropdown";
import { PublicThemeToggle } from "./theme-toggle";
import clsx from "clsx";

interface NavbarProps {
  config?: {
    logoUrl?: string | null;
    companyName?: string | null;
    [key: string]: any;
  } | null;
}

/** Each account type's own dashboard (customers: /account). */
function dashboardHref(role?: string) {
  if (role === "ADMIN") return "/admindashboard";
  if (role === "TENANT" || role === "TENANT_STAFF") return "/tenantdashboard";
  return "/account";
}

export const Navbar = ({ config: propConfig }: NavbarProps = {}) => {
  const [config, setConfig] = useState<any>(propConfig || null);

  // Every public page gets the CMS logo, name and theme colour: from the
  // page's prop, else the session cache, else a fetch (then cached).
  useEffect(() => {
    if (propConfig) {
      setConfig(propConfig);
      return;
    }
    let cached: any = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(PUBLIC_CONFIG_CACHE_KEY) || "null");
    } catch {
      cached = null;
    }
    if (cached) {
      setConfig(cached);
      return;
    }
    let cancelled = false;
    getPublicViewConfigAction()
      .then((data) => {
        if (cancelled || !data) return;
        setConfig(data);
        try {
          sessionStorage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(data));
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [propConfig]);

  useEffect(() => {
    applyThemeColor(config?.themeColor);
  }, [config?.themeColor]);
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState<string>("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [allShops, setAllShops] = useState<DigitalStorefront[]>([]);

  const navItems = [
    { id: "products", label: "Products", href: "/products" },
    { id: "directory", label: "Mall Directory", href: "/#directory" },
    { id: "availability", label: "Available Spaces", href: "/#availability" },
    { id: "events", label: "What's On", href: "/#events" },
    { id: "location", label: "Location", href: "/#location" },
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#directory") setActiveNav("directory");
      else if (hash === "#availability") setActiveNav("availability");
      else if (hash === "#events" || hash === "#event-inquiry") setActiveNav("events");
      else if (hash === "#location") setActiveNav("location");
      else if (pathname === "/products") setActiveNav("products");
      else if (!hash) setActiveNav("");
    }
  }, [pathname]);

  // Signed in → pull the account's favourites (and merge this browser's).
  useEffect(() => {
    if (user?.id) void syncFavorites(user.id);
  }, [user?.id]);

  const loadFavorites = () => {
    if (typeof window !== "undefined") {
      const saved = JSON.parse(
        localStorage.getItem("sr_mall_favorites") || "[]",
      );
      setFavoriteIds(saved);
    }
  };

  useEffect(() => {
    loadFavorites();

    const fetchShops = async () => {
      const res = await getAllStorefrontsAction();
      if (res.success && res.data) setAllShops(res.data);
    };
    fetchShops();

    window.addEventListener("favorites-updated", loadFavorites);
    return () => window.removeEventListener("favorites-updated", loadFavorites);
  }, []);

  const favoriteShops = allShops.filter((s) => favoriteIds.includes(s.id));

  return (
    <>
      <nav
        className={clsx(
          "fixed",
          "top-0",
          "left-0",
          "right-0",
          "z-50",
          "glass",
          "bg-white/70",
          "dark:bg-black/70",
          "border-b",
          "border-slate-100",
          "dark:border-white/5",
        )}
      >
        <div
          className={clsx(
            "w-full",
            "max-w-[1750px]",
            "mx-auto",
            "px-4",
            "sm:px-6",
            "lg:px-8",
            "h-20",
            "flex",
            "items-center",
            "justify-between",
            "gap-3",
            "xl:gap-6",
          )}
        >
          {/* Left: Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 group shrink-0"
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-md border-2 border-primary/10 group-hover:border-primary/40 transition-all duration-500 flex items-center justify-center">
              <img
                src={config?.logoUrl || "/images/srmall-logo/sr_logo2.jpg"}
                alt={config?.companyName || "SR Logo"}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base sm:text-xl font-semibold tracking-tight text-charcoal dark:text-white leading-none">
                {config?.companyName || "SR Mall"}
              </span>
            </div>
          </Link>

          {/* Center: Nav links - hidden on tablet/mobile */}
          <div
            className={clsx(
              "hidden",
              "lg:flex",
              "items-center",
              "justify-center",
              "gap-1",
              "xl:gap-3",
              "2xl:gap-6",
            )}
          >
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveNav(item.id)}
                  className={clsx(
                    "relative py-1.5 px-2.5 xl:px-3 text-sm font-medium transition-colors whitespace-nowrap rounded-lg",
                    isActive
                      ? "text-primary"
                      : "text-slate-600 dark:text-slate-300 hover:text-charcoal dark:hover:text-white",
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-2.5 right-2.5 xl:left-3 xl:right-3 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className={clsx("flex items-center gap-2 sm:gap-3 shrink-0")}>
            <p className="hidden 2xl:block text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Open daily, {config?.footerOpeningHours?.trim() || "10 AM to 9 PM"}
            </p>

            {isAuthenticated ? (
              <div
                className={clsx(
                  "flex",
                  "items-center",
                  "gap-2 sm:gap-3",
                  "relative",
                )}
              >
                <div className="flex items-center gap-2">
                  <PublicThemeToggle />
                </div>
                {isAuthenticated && user && dashboardHref(user.role) !== "/account" && (
                  <Link
                    href={dashboardHref(user.role)}
                    className={clsx(
                      "hidden",
                      "sm:flex",
                      "items-center",
                      "gap-2",
                      "px-4",
                      "py-1.5",
                      "bg-white",
                      "text-black",
                      "font-semibold",
                      "text-xs",
                      "rounded-full",
                      "hover:bg-slate-200",
                      "transition-colors",
                      "shadow-md",
                      "border",
                      "border-slate-100",
                    )}
                  >
                    Dashboard
                  </Link>
                )}

                <div className="flex items-center gap-2 sm:gap-3">
                  <NotificationDropdown />

                  <div className="relative">
                    <button
                      suppressHydrationWarning
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className={clsx(
                        "flex",
                        "items-center",
                        "gap-2",
                        "p-1 sm:px-3 sm:py-1.5",
                        "bg-slate-100",
                        "dark:bg-zinc-800",
                        "rounded-full",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "transition-all",
                        "hover:shadow-md",
                      )}
                    >
                      <div
                        className={clsx(
                          "w-7 h-7 sm:w-8 sm:h-8",
                          "rounded-full",
                          "bg-primary",
                          "text-white",
                          "flex",
                          "items-center",
                          "justify-center",
                          "font-bold",
                          "text-xs sm:text-sm",
                          "overflow-hidden",
                          "border border-slate-100 dark:border-white/5",
                        )}
                      >
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          user?.name ? user.name.charAt(0).toUpperCase() : "U"
                        )}
                      </div>
                      <div
                        className={clsx(
                          "hidden sm:flex",
                          "flex-col",
                          "items-start",
                          "leading-none",
                        )}
                      >
                        <span
                          className={clsx(
                            "text-[10px] sm:text-xs",
                            "font-bold",
                            "text-charcoal",
                            "dark:text-white",
                          )}
                        >
                          {user?.name?.split(" ")[0]}
                        </span>
                        <span
                          className={clsx(
                            "text-xs sm:text-[10px]",
                            "text-slate-500",
                            "dark:text-slate-400",
                            "font-medium",
                            "tracking-tight",
                          )}
                        >
                          {user?.role?.toLowerCase()}
                        </span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isProfileOpen && (
                      <div
                        className={clsx(
                          "absolute",
                          "top-full",
                          "right-0",
                          "mt-3",
                          "w-64 sm:w-72",
                          "bg-white",
                          "dark:bg-zinc-900",
                          "rounded-2xl sm:rounded-3xl",
                          "shadow-2xl",
                          "border",
                          "border-slate-200",
                          "dark:border-white/5",
                          "animate-fade-in-up",
                          "overflow-hidden",
                          "z-60",
                        )}
                      >
                        <div
                          className={clsx(
                            "px-6",
                            "py-4",
                            "border-b",
                            "border-slate-100",
                            "dark:border-white/5",
                            "bg-slate-50/50",
                            "dark:bg-white/5",
                          )}
                        >
                          <p
                            className={clsx(
                              "text-[10px]",
                              "font-semibold",
                              "text-slate-400",
                            )}
                          >
                            Account Overview
                          </p>
                        </div>

                        <div className="py-2">
                          <Link
                            href="/profile"
                            onClick={() => setIsProfileOpen(false)}
                            className={clsx(
                              "w-full",
                              "flex",
                              "items-center",
                              "gap-3",
                              "px-6",
                              "py-3",
                              "text-xs",
                              "font-bold",
                              "text-charcoal",
                              "dark:text-white",
                              "hover:bg-slate-50",
                              "dark:hover:bg-white/5",
                              "transition-colors",
                            )}
                          >
                            <User size={16} className="text-primary" /> My Profile
                          </Link>
                          {dashboardHref(user?.role) === "/account" && (
                            <Link
                              href="/account"
                              onClick={() => setIsProfileOpen(false)}
                              className="w-full flex items-center gap-3 px-6 py-3 text-xs font-bold text-charcoal dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                              <LayoutDashboard size={16} className="text-primary" /> My Account
                            </Link>
                          )}

                        </div>

                        <div className="p-2 border-t border-slate-100 dark:border-white/5">
                          <button
                            suppressHydrationWarning
                            onClick={() => logout()}
                            className={clsx(
                              "w-full",
                              "flex",
                              "items-center",
                              "gap-3",
                              "px-4",
                              "py-3",
                              "text-xs",
                              "font-semibold",
                              "text-primary",
                              "hover:bg-primary/5",
                              "rounded-xl",
                              "transition-colors",
                            )}
                          >
                            <LogOut size={16} /> Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <PublicThemeToggle />
                </div>
                <Link
                  href="/become-a-tenant"
                  className="hidden xl:inline-flex items-center px-5 py-2.5 rounded-full border border-primary/40 text-primary font-bold text-sm hover:bg-primary/10 transition-colors"
                >
                  Become a Tenant
                </Link>
                <button
                  suppressHydrationWarning
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-8 sm:py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-all duration-300 shadow-xl shadow-primary/20 active:scale-95"
                >
                  <User size={18} className="sm:hidden" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </div>
            )}

            <button
              suppressHydrationWarning
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-charcoal dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-20 z-40 bg-white dark:bg-zinc-900 md:hidden overflow-y-auto animate-fade-in">
          {isAuthenticated && (
            <div className="px-6 py-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.name ? user.name.charAt(0).toUpperCase() : "U"
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold text-charcoal dark:text-white leading-tight">
                    {user?.name || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-xs font-bold text-primary mt-0.5">
                    {user?.role} Account
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col px-4 py-4">
            {navItems.map((link) => {
              const isActive = activeNav === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => {
                    setActiveNav(link.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={clsx(
                    "flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base transition-colors",
                    isActive
                      ? "text-primary font-semibold"
                      : "text-slate-700 dark:text-slate-200 font-bold hover:text-charcoal dark:hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(190,30,45,0.6)]" />
                    )}
                    {link.label}
                  </span>
                  <ChevronDown
                    size={16}
                    className={clsx(
                      "-rotate-90 transition-transform",
                      isActive ? "text-primary" : "text-slate-300",
                    )}
                  />
                </Link>
              );
            })}
            {isAuthenticated && (
              <>
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
                >
                  My Profile
                  <User size={16} className="text-primary/60" />
                </Link>

              </>
            )}

            {isAuthenticated && user && (
                <Link
                  href={dashboardHref(user.role)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-primary"
                >
                  {dashboardHref(user.role) === "/account" ? "My Account" : "Go to Dashboard"}
                  <ChevronDown
                    size={16}
                    className="-rotate-90 text-primary/40"
                  />
                </Link>
              )}

            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center justify-between w-full py-4 text-base font-bold text-red-500 mt-2"
              >
                Sign Out
                <LogOut size={16} className="text-red-400" />
              </button>
            )}

            {!isAuthenticated && (
              <Link
                href="/become-a-tenant"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-primary"
              >
                Become a Tenant
                <ChevronDown size={16} className="-rotate-90 text-primary/40" />
              </Link>
            )}

            {!isAuthenticated && (
              <button
                onClick={() => {
                  setIsLoginOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="mt-4 w-full py-4 bg-primary text-white font-semibold text-sm rounded-2xl active:scale-95 shadow-xl shadow-primary/30 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
};
