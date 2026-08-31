"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  const { isAuthenticated, user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [allShops, setAllShops] = useState<DigitalStorefront[]>([]);

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
            "max-w-7xl",
            "mx-auto",
            "px-4",
            "h-20",
            "flex",
            "items-center",
            "justify-between",
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
              "gap-3",
              "xl:gap-8",
            )}
          >
            <Link
              href="/products"
              className={clsx(
                "text-[10px] xl:text-[11px]",
                "font-black",
                "text-primary",
                "hover:text-primary-hover",
                "transition-colors",
                "uppercase",
                "tracking-[0.1em] xl:tracking-[0.2em]",
                "whitespace-nowrap"
              )}
            >
              Products
            </Link>
            <Link
              href="#directory"
              className={clsx(
                "text-xs xl:text-sm",
                "font-medium",
                "text-slate-500",
                "dark:text-slate-300",
                "hover:text-primary",
                "transition-colors",
                "whitespace-nowrap"
              )}
            >
              Mall Directory
            </Link>
            <Link
              href="#availability"
              className={clsx(
                "text-xs xl:text-sm",
                "font-medium",
                "text-slate-500",
                "dark:text-slate-300",
                "hover:text-primary",
                "transition-colors",
                "whitespace-nowrap"
              )}
            >
              Available Spaces
            </Link>
            <Link
              href="#events"
              className={clsx(
                "text-xs xl:text-sm",
                "font-medium",
                "text-slate-500",
                "dark:text-slate-300",
                "hover:text-primary",
                "transition-colors",
                "whitespace-nowrap"
              )}
            >
              What's On
            </Link>
            <Link
              href="#location"
              className={clsx(
                "text-xs xl:text-sm",
                "font-medium",
                "text-slate-500",
                "dark:text-slate-300",
                "hover:text-primary",
                "transition-colors",
                "whitespace-nowrap"
              )}
            >
              Location
            </Link>
          </div>

          {/* Right: Actions */}
          <div className={clsx("flex items-center gap-1.5 sm:gap-4")}>
            <div
              className={clsx(
                "hidden",
                "xl:flex",
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
                  "gap-2 sm:gap-4",
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
                      "lg:flex",
                      "items-center",
                      "gap-2",
                      "px-5",
                      "py-2",
                      "bg-white",
                      "text-black",
                      "font-black",
                      "text-xs",
                      "uppercase",
                      "tracking-widest",
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
                        "gap-2 sm:gap-3",
                        "p-1.5 sm:px-4 sm:py-2",
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
                          <Link
                            href="/lost-and-found"
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
                            <Search size={16} className="text-primary" /> Lost and Found
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
            {[
              { href: "/products", label: "All Products" },
              { href: "#directory", label: "Mall Directory" },
              { href: "#availability", label: "Available Spaces" },
              { href: "#event-inquiry", label: "Book an Event" },
              { href: "#location", label: "Location" },
              { href: "#feedback", label: "Reviews" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
              >
                {link.label}
                <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              </Link>
            ))}
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
                <Link
                  href="/lost-and-found"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-white/5 text-base font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
                >
                  Lost and Found
                  <Search size={16} className="text-primary/60" />
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
