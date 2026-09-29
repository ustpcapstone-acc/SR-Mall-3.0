"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { AlertTriangle, Loader2, Save } from "lucide-react";

/**
 * Shared layout for the three settings pages (admin, tenant, customer) so
 * they look and behave the same: header, tab list on the left (sticky on
 * desktop), cards on the right, sticky save bar when there are changes.
 */

export const INPUT_CLASS =
  "w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

export type SettingsTab<K extends string> = { key: K; label: string; icon: React.ComponentType<{ size?: number }> };

export function SettingsShell<K extends string>({
  eyebrow,
  title,
  accent,
  subtitle,
  tabs,
  active,
  onTab,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
  tabs: SettingsTab<K>[];
  active: K;
  onTab: (key: K) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
          {eyebrow}
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
          {title} <span className="text-primary">{accent}</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-2xl">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <nav
          aria-label="Settings sections"
          className="lg:col-span-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:sticky lg:top-24 lg:self-start pb-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              aria-current={active === t.key ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-left whitespace-nowrap transition-all border shrink-0",
                active === t.key
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/5 text-slate-500 hover:text-charcoal dark:hover:text-white hover:border-slate-200",
              )}
            >
              <t.icon size={18} />
              <span className="text-[11px] font-black uppercase tracking-widest">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="lg:col-span-9 space-y-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function SettingsCard({
  title,
  subtitle,
  icon: Icon,
  tone = "bg-primary/10 text-primary",
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size?: number }>;
  tone?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", tone)}>
              <Icon size={20} />
            </span>
          )}
          <div>
            <h2 className="text-lg font-black text-charcoal dark:text-white uppercase tracking-tight italic leading-none">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div className="px-6 md:px-8 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
          {footer}
        </div>
      )}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-1.5", error && "[&_input]:!border-red-500 [&_textarea]:!border-red-500 [&_select]:!border-red-500", className)}>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{label}</label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-600">
          <AlertTriangle size={12} /> {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  busy,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={clsx(
        "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50",
        className,
      )}
    />
  );
}

/** Sticky bar shown while a form has unsaved edits. */
export function SaveBar({
  dirty,
  saving,
  blocked,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  /** A validation message that blocks saving. */
  blocked?: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-30 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pl-6 bg-charcoal dark:bg-zinc-800 text-white rounded-2xl shadow-2xl shadow-black/20 border border-white/10">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {blocked || "You have unsaved changes"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || Boolean(blocked)}
            className="h-10 px-5 flex items-center gap-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/** Browser "leave site?" warning while there are unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

export const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;
export const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;
