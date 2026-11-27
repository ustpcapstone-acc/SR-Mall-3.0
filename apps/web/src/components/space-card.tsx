"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { cn } from "@cloudflare/kumo";
import type { AreaSlot } from "@srmall/database";
import { optimizedImage } from "@/lib/media";
import { useFloors } from "@/lib/use-floors";
import { slotAccess } from "@/lib/slot-live";

const CARD =
  "group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base text-left transition-[transform,box-shadow] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** One rentable unit: photo, unit number, floor, size and whether it's free. */
export function SpaceCard({
  slot,
  viewerId,
  onOpen,
  className,
  style,
}: {
  slot: AreaSlot;
  viewerId?: string | null;
  /** Called on click, also for units that can't be opened (the page explains why). */
  onOpen: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { label: floorLabel } = useFloors();
  const access = slotAccess(slot as any, viewerId);
  const image = slot.space_images?.[0];
  const available = slot.status === "AVAILABLE";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-disabled={!access.open}
      style={style}
      className={cn(CARD, access.open ? "cursor-pointer hover:-translate-y-1 hover:shadow-xl" : "cursor-not-allowed opacity-75", className)}
    >
      <span className="relative block aspect-16/10 w-full overflow-hidden bg-kumo-recessed">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            decoding="async"
            src={optimizedImage(image, 800)}
            alt={`Unit ${slot.unit_id}`}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-kumo-subtle">
            <Store className="size-8" aria-hidden />
            <span className="text-sm">No photo yet</span>
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1 p-4">
        <span className="font-display text-lg font-semibold leading-tight text-kumo-default sm:text-xl">Unit {slot.unit_id}</span>
        <span className="text-sm text-kumo-subtle">
          {[floorLabel(slot.floor), `${slot.sqm_size} sqm`].filter(Boolean).join(", ")}
        </span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-kumo-line pt-3 text-sm">
          <span className={cn("font-semibold", available ? "text-kumo-success" : "text-kumo-warning")}>
            {available ? "Available now" : access.label}
          </span>
          {access.open && (
            <span className="flex items-center gap-1 font-medium text-primary">
              View details
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** The last card in a home page row: goes to the full list. */
export function SeeAllCard({
  href,
  title,
  detail,
  onClick,
  className,
}: {
  href: string;
  title: string;
  detail: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        CARD,
        "min-h-56 items-center justify-center gap-3 border-dashed p-6 text-center hover:-translate-y-1 hover:border-primary hover:shadow-xl",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:scale-110">
        <ArrowRight className="size-6" aria-hidden />
      </span>
      <span className="font-display text-xl font-semibold text-kumo-default">{title}</span>
      <span className="text-sm text-kumo-subtle">{detail}</span>
    </Link>
  );
}
