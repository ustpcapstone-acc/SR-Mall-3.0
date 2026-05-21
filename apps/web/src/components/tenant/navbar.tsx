"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
// @ts-ignore
import { useRouter } from "next/navigation";
import { DashboardThemeToggle } from "../theme-toggle";
import NotificationDropdown from "../notification-dropdown";
import { Bell, ChevronDown, LogOut, Search, User, Menu } from "lucide-react";

interface TenantNavbarProps {
  onMenuClick?: () => void;
}

export const TenantNavbar = ({ onMenuClick }: TenantNavbarProps) => {
  const { logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/public-view");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Left: Mobile Menu + Brand */}
        <div className="flex items-center gap-3 sm:gap-8">
          {/* Mobile Menu Button - Left Aligned */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-charcoal dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Brand Logo */}
          <Link href="/tenantdashboard">
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-black text-lg sm:text-xl">
                  S
                </span>
              </div>
              <div className="hidden sm:flex flex-col whitespace-nowrap">
                <h1 className="text-charcoal dark:text-white font-black text-base lg:text-lg tracking-tighter leading-none mb-0.5 mt-0.5">
                  SR-MANAGE
                </h1>
                <span className="text-[9px] lg:text-[10px] text-primary font-black uppercase tracking-[0.2em] leading-none">
                  Tenant Portal
                </span>
              </div>
            </div>
          </Link>        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-1 sm:gap-3">
          <DashboardThemeToggle />

          {/* Notification Bell */}
          <div className="hidden sm:block">
            <NotificationDropdown />
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block"></div>

          {/* Profile Button */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 rounded-full border border-slate-100 dark:border-white/5 transition-all hover:shadow-lg"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner tracking-wider overflow-hidden border border-slate-100 dark:border-white/5">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user?.name ? user.name.charAt(0).toUpperCase() : "T"
                )}
              </div>
              <div className="flex-col items-start leading-none hidden md:flex">
                <span className="text-xs font-bold text-charcoal dark:text-white">
                  {user?.name?.split(" ")[0] || "Tenant"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium tracking-tight">
                  Account
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform hidden sm:block ${isProfileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-3 w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/5 py-2 animate-fade-in-up">
                <div className="px-4 py-2 border-b border-slate-50 dark:border-white/5 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Menu
                  </p>
                </div>
                <Link
                  href="/tenantdashboard/profile-settings"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <div className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-charcoal dark:text-slate-300 cursor-pointer">
                    <User size={16} /> Profile
                  </div>
                </Link>
                <Link href="/public-view">
                  <div className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-charcoal dark:text-slate-300 cursor-pointer">
                    <Search size={16} /> Directory
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/5 transition-colors mt-1 border-t border-slate-50 dark:border-white/5"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
