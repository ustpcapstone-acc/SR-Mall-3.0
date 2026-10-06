"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Maximize2 } from "lucide-react";

/**
 * Shared chat pictures, so the admin messenger, tenant messenger and the
 * public chat box show avatars and photo attachments the same way.
 */

const initialsOf = (name?: string | null) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/** Round avatar; falls back to initials when there is no image or it fails to load. */
export function ChatAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const show = Boolean(src) && !broken;
  return (
    <div
      className={clsx(
        "w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5",
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt={name || "Avatar"} onError={() => setBroken(true)} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold text-slate-500 uppercase">{initialsOf(name)}</span>
      )}
    </div>
  );
}

/**
 * Photo attachment in a message bubble: always the same width with a capped
 * height (cropped to fit), so small and large photos look alike.
 */
export function ChatImage({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="w-52 sm:w-60 h-32 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-[11px] font-bold text-slate-400">
        Image unavailable
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="relative block w-52 sm:w-60 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 group/img focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      title="View full size"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Photo"
        loading="lazy"
        onError={() => setBroken(true)}
        className="block w-full h-auto max-h-64 min-h-24 object-cover hover:opacity-95 transition-opacity"
      />
      <span className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity">
        <Maximize2 size={12} />
      </span>
    </button>
  );
}

/** Bubble padding: a photo-only message gets a thin frame instead of text padding. */
export const bubblePadding = (msg: { imageUrl?: string | null; content?: string | null }) =>
  msg.imageUrl && !msg.content?.trim() ? "p-1" : "px-4 py-2.5 lg:px-5 lg:py-3";
