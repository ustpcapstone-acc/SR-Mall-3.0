"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import clsx from "clsx";

export const PublicThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-2.5 w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-white/5 animate-pulse" />
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2.5 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-white/5 text-slate-400 hover:text-primary transition-all hover:bg-white dark:hover:bg-zinc-700 hover:shadow-lg active:scale-95 cursor-pointer flex items-center justify-center group"
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun
          size={20}
          className="text-yellow-500 group-hover:scale-110 transition-transform"
        />
      ) : (
        <Moon
          size={20}
          className="text-slate-600 group-hover:scale-110 transition-transform"
        />
      )}
    </button>
  );
};

export const DashboardThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-2.5 w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 animate-pulse" />
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary transition-all hover:bg-white dark:hover:bg-black hover:shadow-xs active:scale-95 cursor-pointer flex items-center justify-center group"
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun
          size={18}
          className="text-yellow-500 group-hover:scale-110 transition-transform"
        />
      ) : (
        <Moon
          size={18}
          className="text-slate-500 group-hover:scale-110 transition-transform"
        />
      )}
    </button>
  );
};
