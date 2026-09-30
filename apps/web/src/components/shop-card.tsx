"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Heart, MessageCircle, Play, Star, Store } from "lucide-react";
import { DigitalStorefront } from "@/types/storefront";
import { useAuth } from "@/app/providers";
import { FAVORITES_EVENT, readLocalFavorites, setFavorite } from "@/lib/favorites";

interface ShopCardProps {
  shop: DigitalStorefront;
  onClick?: () => void;
  onMessage?: (shopName: string) => void;
}

const FLOOR_LABELS: Record<string, string> = {
  ground: "Ground Floor",
  first: "First Floor",
  second: "Second Floor",
};

/** Real, loadable image URLs only (blob: previews and placeholders are skipped). */
const usable = (url?: string | null) => (url && !url.startsWith("blob:") && !url.includes("placeholder") ? url : null);

/**
 * Mall Directory card — same look as the Available Spaces slot card:
 * photo with the name over it, a glass status pill, a hover pill, and a
 * two-column strip underneath (Rating · Category).
 *
 * The shop's bio isn't shown here; it's on the shop page (/shop/[id]).
 *
 * While the shop has an approved promo running, the card shows a PROMO badge
 * and the promo's image as its photo. A video promo shows its first frame
 * with a play icon and plays (muted) on hover — never autoplays in the grid.
 * The whole card links to the shop; the heart and chat buttons sit above
 * that link, so they are real, separate buttons.
 */
export const ShopCard = ({ shop, onClick, onMessage }: ShopCardProps) => {
  const { id, shop_name, unit_id, is_open } = shop;
  const [isFavorited, setIsFavorited] = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [promoBroken, setPromoBroken] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Favourites: account-backed when signed in (see lib/favorites).
  const { user } = useAuth();
  React.useEffect(() => {
    const refresh = () => setIsFavorited(readLocalFavorites().includes(id));
    refresh();
    window.addEventListener(FAVORITES_EVENT, refresh);
    return () => window.removeEventListener(FAVORITES_EVENT, refresh);
  }, [id]);

  const toggleFavorite = async () => {
    const next = !isFavorited;
    setIsFavorited(next);
    const ok = await setFavorite(id, next, user?.id);
    if (!ok) setIsFavorited(!next);
  };

  const promo = shop.activePromo && !promoBroken ? shop.activePromo : null;
  const promoVideo = promo?.mediaType === "VIDEO" ? usable(promo.video) : null;
  const promoImage = promo && !promoVideo ? usable(promo.image) : null;
  const cover = coverBroken ? null : usable(shop.gallery_urls?.[0]);

  const startPreview = () => {
    const v = videoRef.current;
    if (!v) return;
    void v.play().then(() => setPlaying(true)).catch(() => {});
  };
  const stopPreview = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
  };
  const logo = logoBroken ? null : usable(shop.logo_url);
  const hasUnit = unit_id && unit_id !== "PENDING_ASSIGNMENT";
  const floor = shop.floor ? FLOOR_LABELS[shop.floor] || shop.floor : null;
  const location = hasUnit ? `Unit ${unit_id}${floor ? ` · ${floor}` : ""}` : "Opening soon";
  const rating = shop.reviewCount ? Number(shop.avgRating || 0) : 0;
  const href = id === "preview" ? "#" : `/shop/${id}`;

  return (
    <div
      onMouseEnter={promoVideo ? startPreview : undefined}
      onMouseLeave={promoVideo ? stopPreview : undefined}
      className={clsx(
        "group relative h-full bg-white dark:bg-zinc-900 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 shadow-sm hover:shadow-2xl hover:-translate-y-2",
        !is_open && "opacity-80",
      )}
    >
      {/* Whole-card link (under the buttons) */}
      <Link
        href={href}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`Visit ${shop_name}`}
        className="absolute inset-0 z-10 rounded-[1.25rem] sm:rounded-[2rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      />

      {/* Photo */}
      <div className={clsx("aspect-[4/3] sm:aspect-[16/10] relative overflow-hidden bg-slate-100 dark:bg-black", !is_open && "grayscale-[60%]")}>
        {promoVideo ? (
          <>
            <video
              ref={videoRef}
              src={`${promoVideo}#t=0.1`}
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setPromoBroken(true)}
              className="w-full h-full object-cover"
            />
            {!playing && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-black/45 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                  <Play className="w-4 h-4 sm:w-6 sm:h-6 ml-0.5" fill="currentColor" />
                </span>
              </span>
            )}
          </>
        ) : promoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promoImage}
            alt={promo?.title || shop_name}
            loading="lazy"
            onError={() => setPromoBroken(true)}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          />
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={shop_name}
            loading="lazy"
            onError={() => setCoverBroken(true)}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          />
        ) : logo ? (
          // No gallery photo yet: the logo on a soft background.
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={shop_name}
              loading="lazy"
              onError={() => setLogoBroken(true)}
              className="w-1/2 h-2/3 object-contain transition-transform duration-1000 group-hover:scale-110"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
            <Store className="w-6 h-6 sm:w-12 sm:h-12 text-slate-200 dark:text-zinc-800 mb-2 sm:mb-4" />
            <p className="text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
              Storefront <br />
              Photo Pending
            </p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

        {/* Status pill (same style as the slot card) */}
        <div className="absolute top-2 sm:top-6 right-2 sm:right-6">
          <div
            className={clsx(
              "backdrop-blur-xl px-2 sm:px-4 py-1 sm:py-2 rounded-full border text-[7px] sm:text-[9px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-2xl",
              is_open
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-zinc-800/40 border-zinc-400/40 text-zinc-200",
            )}
          >
            {is_open ? "Open Now" : "Closed"}
          </div>
        </div>

        {/* Favourite + chat (above the card link) */}
        <div className="absolute z-20 top-2 sm:top-6 left-2 sm:left-6 flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleFavorite}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? `Remove ${shop_name} from favourites` : `Save ${shop_name} to favourites`}
            title={isFavorited ? "Saved" : "Save to favourites"}
            className={clsx(
              "w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border backdrop-blur-xl shadow-2xl transition-all",
              isFavorited
                ? "bg-primary border-primary text-white"
                : "bg-white/20 border-white/30 text-white hover:bg-white hover:text-primary",
            )}
          >
            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill={isFavorited ? "currentColor" : "none"} />
          </button>
          {onMessage && (
            <button
              type="button"
              onClick={() => onMessage(shop_name)}
              aria-label={`Message ${shop_name}`}
              title="Message this shop"
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border bg-white/20 border-white/30 text-white backdrop-blur-xl shadow-2xl hover:bg-white hover:text-primary transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>

        {/* Name + location over the photo */}
        <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-8 right-3 sm:right-8">
          {promo && (
            <span className="inline-flex max-w-full items-center gap-1 mb-1.5 sm:mb-2.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary text-white text-[7px] sm:text-[9px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-lg shadow-primary/40">
              <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="currentColor" />
              <span className="truncate">Promo · {promo.title}</span>
            </span>
          )}
          <h4 className="text-base sm:text-3xl font-black text-white tracking-tighter uppercase leading-none line-clamp-1">
            {shop_name}
          </h4>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-2">
            <div className={clsx("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full", is_open ? "bg-emerald-400 animate-pulse" : "bg-zinc-400")} />
            <p className="text-[7px] sm:text-[10px] font-bold text-white/70 uppercase tracking-widest truncate">{location}</p>
          </div>
        </div>

        {/* Hover pill (not over a playing promo video) */}
        <div
          className={clsx(
            "absolute inset-0 flex justify-center opacity-0 transition-all duration-500 pointer-events-none",
            promoVideo ? "items-start pt-12 sm:pt-20" : "items-center group-hover:bg-black/20 group-hover:backdrop-blur-[2px]",
            "group-hover:opacity-100",
          )}
        >
          <div className="px-4 sm:px-8 py-2 sm:py-3 bg-white text-black text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-full shadow-3xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            Visit Shop
          </div>
        </div>
      </div>

      {/* Strip: Rating · Category (like Floor Area · Lease) */}
      <div className="p-3 sm:p-8 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900/50">
        <div className="space-y-0.5 sm:space-y-1.5 min-w-0">
          <p className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Rating</p>
          {rating > 0 ? (
            <div className="flex items-baseline gap-1">
              <p className="text-lg sm:text-3xl font-black text-charcoal dark:text-white tracking-tighter">{rating.toFixed(1)}</p>
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 self-center" fill="currentColor" />
              <span className="text-[9px] sm:text-xs font-black text-primary">({shop.reviewCount})</span>
            </div>
          ) : (
            <p className="text-lg sm:text-3xl font-black text-charcoal dark:text-white tracking-tighter">New</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-right min-w-0">
          <span className="text-[7px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</span>
          <span className="text-[8px] sm:text-xs font-black text-charcoal dark:text-white uppercase truncate max-w-full">
            {shop.category || "General"}
          </span>
        </div>
      </div>
    </div>
  );
};
