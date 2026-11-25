import React from "react";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { cn } from "@cloudflare/kumo";

/**
 * The top of a public list page: back link, serif title, one line of help and
 * the page's search or main button. Kept short so the list starts on screen.
 */
export function PublicHeader({
  title,
  description,
  backHref = "/",
  backLabel = "Back to home",
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** Search box or buttons, right-aligned on wide screens. */
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-kumo-line bg-kumo-base pb-6 pt-24 sm:pb-8 sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Link
          href={backHref}
          className="group mb-3 inline-flex items-center gap-2 text-sm font-medium text-kumo-subtle transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
          {backLabel}
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-kumo-default sm:text-4xl">{title}</h1>
            {description && <p className="mt-2 max-w-xl text-base text-kumo-subtle">{description}</p>}
          </div>
          {children && <div className="w-full md:w-96 md:shrink-0">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/** The search box used in public page headers and sections. */
export function PublicSearch({
  value,
  onChange,
  placeholder,
  label,
  suggestions,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Matches listed under the box while something is typed. */
  suggestions?: Suggestion[];
}) {
  return (
    <div className="relative w-full">
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-kumo-subtle" />
      <input
        type="text"
        suppressHydrationWarning
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-kumo-line bg-kumo-base pl-11 pr-11 text-base text-kumo-default outline-none placeholder:text-kumo-subtle focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-kumo-subtle hover:bg-kumo-tint"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      {value && suggestions && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border border-kumo-line bg-kumo-base shadow-2xl">
          {suggestions.length === 0 ? (
            <p className="p-4 text-sm text-kumo-subtle">Nothing matches that search.</p>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {suggestions.map((item) => {
                const inner = (
                  <>
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-kumo-recessed">
                      {item.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={item.image} alt="" className="absolute inset-0 size-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-kumo-default">{item.title}</span>
                      <span className="block truncate text-sm text-kumo-subtle">{item.detail}</span>
                    </span>
                  </>
                );
                const row = "flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-kumo-tint";
                return (
                  <li key={item.key}>
                    {item.href ? (
                      <Link href={item.href} className={row}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={item.onSelect} className={row}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export type Suggestion = {
  key: string;
  title: string;
  detail: string;
  image?: string | null;
  href?: string;
  onSelect?: () => void;
};

/** A labelled row of choices (category, sort order). */
export function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar flex items-center gap-2 overflow-x-auto sm:flex-wrap">
      <span className="shrink-0 text-sm font-medium text-kumo-subtle">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          suppressHydrationWarning
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition-colors",
            value === option.id
              ? "border-primary bg-primary text-white"
              : "border-kumo-line bg-kumo-base text-kumo-default hover:border-primary hover:text-primary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
