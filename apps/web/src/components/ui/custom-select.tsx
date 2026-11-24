"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: "emerald" | "amber" | "slate" | "blue" | "red";
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

const TONE_DOT: Record<NonNullable<CustomSelectOption["tone"]>, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  red: "bg-red-500",
};

/**
 * Accessible, themeable replacement for a native <select>.
 * Used where the default browser menu clashes with the dashboard styling.
 */
export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className,
  buttonClassName,
  menuClassName,
  ariaLabel,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={clsx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-charcoal outline-hidden transition-all",
          "focus:border-primary focus:ring-2 focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-white/10 dark:bg-zinc-900 dark:text-white",
          buttonClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.tone && (
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[selected.tone])} />
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          size={14}
          className={clsx("shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={clsx(
            "absolute left-0 right-0 z-120 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900",
            menuClassName,
          )}
        >
          <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-[11px] font-medium text-slate-400">No options available.</p>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                      "hover:bg-slate-50 dark:hover:bg-white/5",
                      isSelected && "bg-primary/5 dark:bg-primary/10",
                      option.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {option.tone && (
                      <span className={clsx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[option.tone])} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={clsx(
                          "block truncate text-xs font-bold",
                          isSelected ? "text-primary" : "text-charcoal dark:text-white",
                        )}
                      >
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block text-[10px] font-medium leading-snug text-slate-400">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
