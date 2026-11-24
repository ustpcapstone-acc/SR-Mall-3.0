"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { Button } from "@cloudflare/kumo";

/**
 * Shared layout for the three settings pages (admin, tenant, customer) so
 * they look and behave the same: header, tab list on the left (sticky on
 * desktop), cards on the right, sticky save bar when there are changes.
 * Built on Kumo's tokens and Button.
 */

/** Plain inputs and textareas styled like Kumo's Input. */
export const INPUT_CLASS =
  "w-full px-3 py-2.5 bg-kumo-base border border-kumo-line rounded-lg text-sm text-kumo-default placeholder:text-kumo-placeholder focus:outline-hidden focus:ring-2 focus:ring-kumo-focus transition-shadow disabled:opacity-60 disabled:cursor-not-allowed";

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
      <div className="pb-6 border-b border-kumo-line space-y-2">
        <p className="text-sm text-kumo-subtle">{eyebrow}</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-kumo-default tracking-tight">
          {title} {accent}
        </h1>
        <p className="text-sm text-kumo-subtle max-w-2xl">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <nav
          aria-label="Settings sections"
          className="lg:col-span-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-24 lg:self-start pb-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              aria-current={active === t.key ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm whitespace-nowrap transition-colors shrink-0",
                active === t.key
                  ? "bg-kumo-tint text-kumo-default font-semibold"
                  : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default",
              )}
            >
              <t.icon size={18} />
              <span>{t.label}</span>
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
    <section className="bg-kumo-base border border-kumo-line rounded-xl overflow-hidden">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={clsx("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", tone)}>
              <Icon size={20} />
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold text-kumo-default">{title}</h2>
            {subtitle && <p className="text-sm text-kumo-subtle mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div className="px-6 md:px-8 py-4 bg-kumo-recessed border-t border-kumo-line flex justify-end gap-3">
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
    <div
      className={clsx(
        "space-y-1.5",
        error && "[&_input]:border-kumo-danger! [&_textarea]:border-kumo-danger! [&_select]:border-kumo-danger!",
        className,
      )}
    >
      <label className="text-sm font-medium text-kumo-default block">{label}</label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-kumo-danger">
          <AlertTriangle size={14} /> {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-kumo-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

type ButtonAttrs = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> & { title?: string };

export function PrimaryButton({ children, busy, ...props }: ButtonAttrs & { busy?: boolean }) {
  return (
    <Button {...props} variant="primary" loading={busy} disabled={props.disabled || busy}>
      {children}
    </Button>
  );
}

export function SecondaryButton({ children, ...props }: ButtonAttrs) {
  return (
    <Button {...props} variant="secondary">
      {children}
    </Button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pl-5 bg-kumo-base border border-kumo-line rounded-xl shadow-lg">
        <p className={clsx("text-sm", blocked ? "text-kumo-danger" : "text-kumo-default")}>
          {blocked || "You have unsaved changes."}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button type="button" variant="primary" onClick={onSave} loading={saving} disabled={Boolean(blocked)}>
            Save changes
          </Button>
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
