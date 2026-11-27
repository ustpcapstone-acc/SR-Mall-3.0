"use client";

/**
 * Layout pieces shared by the admin pages, in Kumo's tokens: page header, stat
 * cards, panels, search box, person cell, empty state and dialog frame.
 */
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Button, Dialog, Input, Tabs, cn } from "@cloudflare/kumo";
import { CaretLeft, CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { PAGE_SIZE } from "@/lib/paging";

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

const STAT_TONE = {
  default: "text-kumo-default",
  success: "text-kumo-success",
  warning: "text-kumo-warning",
  danger: "text-kumo-danger",
} as const;

export type Tone = keyof typeof STAT_TONE;

/** A figure with its label. With `onClick` or `href` it filters or opens something. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  active,
  onClick,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span className="block text-sm text-kumo-subtle">{label}</span>
      <span className={cn("mt-1 block text-2xl font-semibold tabular-nums", STAT_TONE[tone])}>{value}</span>
      {hint && <span className="mt-1 block text-xs text-kumo-subtle">{hint}</span>}
    </>
  );
  const frame = cn(
    "block min-w-0 rounded-xl border bg-kumo-base p-4 text-left",
    active ? "border-kumo-brand ring-1 ring-kumo-brand" : "border-kumo-line",
  );
  if (href) {
    return (
      <Link href={href} className={cn(frame, "hover:bg-kumo-tint")}>
        {body}
      </Link>
    );
  }
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(frame, "cursor-pointer hover:bg-kumo-tint")}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Kumo tabs that scroll sideways on narrow screens instead of widening the page. */
export function PageTabs(props: ComponentProps<typeof Tabs>) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <Tabs {...props} />
    </div>
  );
}

/** A bordered section. `flush` drops the body padding (for tables and lists). */
export function Panel({
  title,
  description,
  actions,
  flush,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-kumo-line bg-kumo-base", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kumo-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-kumo-default">{title}</h2>}
            {description && <p className="text-sm text-kumo-subtle">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

/** Page numbers to show: always the ends and the neighbours of the current one. */
function pageList(current: number, pages: number): (number | "gap-start" | "gap-end")[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pages <= 7) return range(1, pages);
  if (current <= 4) return [...range(1, 5), "gap-end", pages];
  if (current >= pages - 3) return [1, "gap-start", ...range(pages - 4, pages)];
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", pages];
}

/** Under a list: "Showing 1–10 of 35 records", Previous, page numbers and Next. */
export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (!total) return null;
  const pages = Math.ceil(total / PAGE_SIZE);
  const current = Math.min(page, pages);
  const first = (current - 1) * PAGE_SIZE + 1;
  const last = Math.min(current * PAGE_SIZE, total);
  return (
    <div className="flex flex-col items-center gap-3 border-t border-kumo-line p-4 sm:flex-row sm:flex-wrap sm:justify-between sm:px-5">
      <p role="status" className="text-sm tabular-nums text-kumo-subtle">
        Showing {first}–{last} of {total} record{total === 1 ? "" : "s"}
      </p>
      <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          icon={<CaretLeft />}
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        {pageList(current, pages).map((entry) =>
          typeof entry === "number" ? (
            <Button
              key={entry}
              size="sm"
              variant={entry === current ? "primary" : "secondary"}
              aria-label={`Page ${entry}`}
              aria-current={entry === current ? "page" : undefined}
              onClick={() => onChange(entry)}
              className="min-w-8 justify-center tabular-nums"
            >
              {entry}
            </Button>
          ) : (
            <span key={entry} aria-hidden className="px-1 text-sm text-kumo-subtle">
              …
            </span>
          ),
        )}
        <Button
          size="sm"
          variant="secondary"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          <span className="hidden sm:inline">Next</span>
          <CaretRight aria-hidden />
        </Button>
      </nav>
    </div>
  );
}

export function EmptyNote({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-kumo-default">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-kumo-subtle">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <MagnifyingGlass
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-kumo-subtle"
      />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9"
      />
    </div>
  );
}

/** Picture (or initial), name and a second line. */
export function Person({
  name,
  detail,
  image,
  square,
}: {
  name: string;
  detail?: ReactNode;
  image?: string | null;
  square?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center overflow-hidden bg-kumo-recessed text-sm font-semibold text-kumo-default",
          square ? "rounded-lg" : "rounded-full",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" className="size-full object-cover" /> : (name.trim().charAt(0) || "?").toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-kumo-default">{name}</p>
        {detail && <p className="truncate text-sm text-kumo-subtle">{detail}</p>}
      </div>
    </div>
  );
}

// Kumo's own size sets the width from the sm breakpoint up; below it the dialog fills the screen.
const DIALOG_SIZE = { sm: "base", md: "lg", lg: "xl" } as const;

/** Dialog with a title, close button and a body that scrolls on small screens. */
export function AdminDialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof DIALOG_SIZE;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog size={DIALOG_SIZE[size]} className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Dialog.Title className="text-lg font-semibold text-kumo-default">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-sm text-kumo-subtle">{description}</Dialog.Description>}
          </div>
          <Button variant="secondary" shape="square" icon={<X />} aria-label="Close" onClick={onClose} />
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </Dialog>
    </Dialog.Root>
  );
}
