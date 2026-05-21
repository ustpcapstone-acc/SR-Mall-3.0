"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { DashboardThemeToggle } from "../theme-toggle";
import NotificationDropdown from "../notification-dropdown";
import { Bell, ChevronDown, LogOut, Search, User } from "lucide-react";

export const AdminNavbar = () => {
  const { logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/public-view");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-md">
      <div className="px-8 h-20 flex items-center justify-between">
        {/* Left: Brand & Search */}
        <div className="flex-1 flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
              <h1 className="text-charcoal dark:text-white font-bold text-lg tracking-tight leading-none">
                SR-MANAGE
              </h1>
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest">
                Admin Control
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DashboardThemeToggle />
          <NotificationDropdown />

          <div className="h-6 w-px bg-white/10 mx-2"></div>

          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 rounded-full border border-slate-100 dark:border-white/5 transition-all hover:shadow-lg"
            >
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-inner tracking-wider overflow-hidden border border-slate-100 dark:border-white/5">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user?.name ? user.name.substring(0, 2).toUpperCase() : "AD"
                )}
              </div>
              <div className="flex flex-col items-start leading-none hidden md:flex">
                <span className="text-xs font-bold text-charcoal dark:text-white">
                  {user?.name || "Admin Module"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                  Super Administrator
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-4 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/5 py-3 animate-fade-in-up">
                <div className="px-5 py-2 border-b border-slate-50 dark:border-white/5 mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Account Overview
                  </p>
                </div>
                <Link
                  href="/admindashboard/profile-settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-charcoal dark:text-slate-300"
                >
                  <User size={16} /> Profile Settings
                </Link>
                <Link
                  href="/public-view"
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-charcoal dark:text-slate-300"
                >
                  <Search size={16} /> Public View
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors mt-2"
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
