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
  Store,
} from "lucide-react";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { DigitalStorefront } from "@/types/storefront";
import { useAuth } from "@/app/providers";
import { LoginModal } from "./login-modal";
import { MerchantApplicationModal } from "./merchant-application-modal";
import NotificationDropdown from "./notification-dropdown";
import { PublicThemeToggle } from "./theme-toggle";
import clsx from "clsx";

export const Navbar = () => {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState<string>("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [allShops, setAllShops] = useState<DigitalStorefront[]>([]);

  const navItems = [
    { id: "products", label: "Products", href: "/products" },
    { id: "directory", label: "Mall Directory", href: "/public-view#directory" },
    { id: "availability", label: "Available Spaces", href: "/public-view#availability" },
    { id: "events", label: "What's On", href: "/public-view#events" },
    { id: "location", label: "Location", href: "/public-view#location" },
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
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-md border-2 border-primary/10 group-hover:border-primary/40 transition-all duration-500">
              <img
                src="/images/srmall-logo/sr_logo2.jpg"
                alt="SR Logo"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-xl font-black tracking-tighter text-charcoal dark:text-white leading-none">
                SR MALL
              </span>
              <span className="hidden xs:block text-[7px] sm:text-[9px] font-bold text-primary tracking-[0.2em] sm:tracking-[0.3em] uppercase leading-none mt-0.5">
                Management
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
                    "relative py-1.5 px-2.5 xl:px-3 text-xs xl:text-sm tracking-wider uppercase transition-all duration-300 whitespace-nowrap rounded-xl",
                    isActive
                      ? "text-primary font-black scale-105"
                      : "text-slate-600 dark:text-slate-300 font-bold hover:text-charcoal dark:hover:text-white",
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(190,30,45,0.6)] animate-in fade-in zoom-in duration-300" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className={clsx("flex items-center gap-2 sm:gap-3 shrink-0")}>
            <div
              className={clsx(
                "hidden",
                "2xl:flex",
                "items-center",
                "gap-2",
                "px-3",
                "py-1.5",
                "rounded-full",
                "bg-red-50",
                "dark:bg-red-950/20",
                "border",
                "border-red-900/10",
              )}
            >
              <span className={clsx("flex", "h-2", "w-2", "relative")}>
                <span
                  className={clsx(
                    "animate-ping",
                    "absolute",
                    "inline-flex",
                    "h-full",
                    "w-full",
                    "rounded-full",
                    "bg-primary",
                    "opacity-75",
                  )}
                ></span>
                <span
                  className={clsx(
                    "relative",
                    "inline-flex",
                    "rounded-full",
                    "h-2",
                    "w-2",
                    "bg-primary",
                  )}
                ></span>
              </span>
              <span
                className={clsx(
                  "text-[10px]",
                  "font-bold",
                  "uppercase",
                  "tracking-wider",
                  "text-primary",
                )}
              >
                Mall is Open: 10AM - 9PM
              </span>
            </div>

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
                {(user?.role === "ADMIN" || user?.role === "TENANT") && (
                  <Link
                    href={
                      user.role === "ADMIN"
                        ? "/admindashboard"
                        : "/tenantdashboard"
                    }
                    className={clsx(
                      "hidden",
                      "sm:flex",
                      "items-center",
                      "gap-2",
                      "px-4",
                      "py-1.5",
                      "bg-white",
                      "text-black",
                      "font-black",
                      "text-xs",
                      "uppercase",
                      "tracking-wider",
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
                            "text-[8px] sm:text-[10px]",
                            "text-slate-500",
                            "dark:text-slate-400",
                            "font-medium",
                            "tracking-tight",
                            "uppercase",
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
                          "z-[60]",
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
                              "font-black",
                              "text-slate-400",
                              "uppercase",
                              "tracking-[0.2em]",
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

                          {(user?.role === "CUSTOMER" ||
                            user?.role === "USER") && (
                              <button
                                suppressHydrationWarning
                                onClick={() => {
                                  setIsMerchantModalOpen(true);
                                  setIsProfileOpen(false);
                                }}
                                className={clsx(
                                  "w-full",
                                  "flex",
                                  "items-center",
                                  "gap-3",
                                  "px-6",
                                  "py-3",
                                  "text-xs",
                                  "font-black",
                                  "text-primary",
                                  "hover:bg-primary/5",
                                  "transition-colors",
                                  "uppercase",
                                  "tracking-widest",
                                )}
                              >
                                <Store size={16} /> Become a Partner
                              </button>
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
                              "font-black",
                              "text-primary",
                              "hover:bg-primary/5",
                              "rounded-xl",
                              "transition-colors",
                              "uppercase",
                              "tracking-widest",
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
                  <span className="text-lg font-black text-charcoal dark:text-white leading-tight">
                    {user?.name || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-0.5">
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
                      ? "text-primary font-black"
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

            {isAuthenticated &&
              (user?.role === "ADMIN" || user?.role === "TENANT") && (
                <Link
                  href={
                    user?.role === "ADMIN"
                      ? "/admindashboard"
                      : "/tenantdashboard"
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-primary"
                >
                  Go to Dashboard
                  <ChevronDown
                    size={16}
                    className="-rotate-90 text-primary/40"
                  />
                </Link>
              )}

            {isAuthenticated &&
              (user?.role === "CUSTOMER" || user?.role === "USER") && (
                <button
                  onClick={() => {
                    setIsMerchantModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between w-full py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-primary text-left"
                >
                  Become a Partner
                  <Store size={16} className="text-primary/60" />
                </button>
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
              <button
                onClick={() => {
                  setIsLoginOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="mt-4 w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-2xl active:scale-95 shadow-xl shadow-primary/30 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <MerchantApplicationModal
        isOpen={isMerchantModalOpen}
        onClose={() => setIsMerchantModalOpen(false)}
      />
    </>
  );
};
