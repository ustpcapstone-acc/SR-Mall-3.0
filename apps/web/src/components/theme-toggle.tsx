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
      <div className="p-2.5 w-10 h-10 rounded-full bg-kumo-recessed border border-kumo-line animate-pulse" />
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2.5 rounded-full bg-kumo-recessed border border-kumo-line text-kumo-subtle hover:text-primary transition-all hover:bg-kumo-base hover:shadow-lg active:scale-95 cursor-pointer flex items-center justify-center group"
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
          className="text-kumo-subtle group-hover:scale-110 transition-transform"
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
      <div className="p-2.5 w-10 h-10 rounded-xl bg-kumo-recessed border border-kumo-line animate-pulse" />
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2.5 rounded-xl bg-kumo-recessed border border-kumo-line text-kumo-subtle hover:text-primary transition-all hover:bg-kumo-base hover:shadow-xs active:scale-95 cursor-pointer flex items-center justify-center group"
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
          className="text-kumo-subtle group-hover:scale-110 transition-transform"
        />
      )}
    </button>
  );
};
