"use client";

import clsx from "clsx";
import { Check } from "lucide-react";

const STEPS = [
  { step: 1, label: "Business Permit", hint: "Upload requirements" },
  { step: 2, label: "Admin Review", hint: "Document verification" },
  { step: 3, label: "Approval", hint: "Unit reserved" },
] as const;

/**
 * The 1-2-3 reservation journey, rendered as three equal boxes so every step
 * has the same visual weight. Steps before `current` are completed, `current`
 * is highlighted, and later steps stay muted.
 */
export function ReservationStepper({
  current,
  compact = false,
  className,
}: {
  current: 1 | 2 | 3;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-label="Reservation progress"
      className={clsx(
        "grid grid-cols-3",
        compact ? "gap-1.5" : "gap-2",
        className,
      )}
    >
      {STEPS.map((s) => {
        const done = s.step < current;
        const active = s.step === current;

        return (
          <div
            key={s.step}
            aria-current={active ? "step" : undefined}
            className={clsx(
              "flex min-w-0 flex-col items-center justify-start rounded-xl border text-center transition-colors",
              compact ? "px-1.5 py-2.5" : "px-2 py-3",
              done
                ? "border-emerald-500/25 bg-emerald-500/5"
                : active
                  ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
                  : "border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-white/[0.02]",
            )}
          >
            <span
              className={clsx(
                "flex shrink-0 items-center justify-center rounded-full font-black tabular-nums transition-colors",
                compact ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs",
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-zinc-900",
              )}
            >
              {done ? (
                <Check size={compact ? 13 : 15} strokeWidth={3} aria-hidden />
              ) : (
                s.step
              )}
            </span>

            <p
              className={clsx(
                "mt-2 text-[9px] font-black uppercase leading-tight tracking-wider",
                done || active
                  ? "text-charcoal dark:text-white"
                  : "text-slate-400",
              )}
            >
              {s.label}
            </p>
            {!compact && (
              <p className="mt-0.5 hidden text-[9px] font-medium leading-tight text-slate-400 sm:block">
                {s.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
