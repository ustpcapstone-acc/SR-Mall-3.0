"use client";

import { hasAssignedUnit } from "@/lib/products";
import { optimizedImage } from "@/lib/media";
import { floorLabel } from "@/lib/floors";
import React, { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@cloudflare/kumo";
import { Heart, MessageCircle, Play, Star, Store } from "lucide-react";
import { DigitalStorefront } from "@/types/storefront";
import { useAuth } from "@/app/providers";
import { FAVORITES_EVENT, readLocalFavorites, setFavorite } from "@/lib/favorites";

interface ShopCardProps {
  shop: DigitalStorefront;
  onClick?: () => void;
  onMessage?: (shopName: string) => void;
}

/** Real, loadable image URLs only (blob: previews and placeholders are skipped). */
const usable = (url?: string | null) => (url && !url.startsWith("blob:") && !url.includes("placeholder") ? url : null);

/**
 * Shop card for the home page and Mall Directory: photo on top, then logo,
 * name, location, rating, category and whether the shop is open.
 *
 * The shop's bio isn't shown here; it's on the shop page (/shop/[id]).
 *
 * While the shop has an approved promo running, the promo's picture is the
 * photo and its title is listed. A video promo shows its first frame with a
 * play icon and plays (muted) on hover, never by itself in the grid.
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
  const hasUnit = hasAssignedUnit(unit_id);
  const floor = floorLabel(shop.floor);
  const location = hasUnit ? `Unit ${unit_id}${floor ? `, ${floor}` : ""}` : "Opening soon";
  const rating = shop.reviewCount ? Number(shop.avgRating || 0) : 0;
  const href = id === "preview" ? "#" : `/shop/${id}`;

  const roundButton =
    "flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <article
      onMouseEnter={promoVideo ? startPreview : undefined}
      onMouseLeave={promoVideo ? stopPreview : undefined}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl"
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
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
      />

      {/* Photo */}
      <div className={cn("relative aspect-16/10 overflow-hidden bg-kumo-recessed", !is_open && "grayscale-60")}>
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
              className="absolute inset-0 size-full object-cover"
            />
            {!playing && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play className="ml-0.5 size-5" fill="currentColor" aria-hidden />
                </span>
              </span>
            )}
          </>
        ) : promoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(promoImage, 800)}
            alt={promo?.title || shop_name}
            loading="lazy"
            onError={() => setPromoBroken(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(cover, 800)}
            alt={shop_name}
            loading="lazy"
            onError={() => setCoverBroken(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : logo ? (
          // No gallery photo yet: the logo on a plain background.
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImage(logo, 200)}
              alt={shop_name}
              loading="lazy"
              onError={() => setLogoBroken(true)}
              className="h-2/3 w-1/2 object-contain"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-kumo-subtle">
            <Store className="size-8" aria-hidden />
            <p className="text-sm">No photo yet</p>
          </div>
        )}

        {/* Favourite + chat (above the card link) */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFavorite}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? `Remove ${shop_name} from favourites` : `Save ${shop_name} to favourites`}
            title={isFavorited ? "Saved" : "Save to favourites"}
            className={cn(roundButton, isFavorited && "bg-primary text-white")}
          >
            <Heart className="size-4" fill={isFavorited ? "currentColor" : "none"} aria-hidden />
          </button>
          {onMessage && (
            <button
              type="button"
              onClick={() => onMessage(shop_name)}
              aria-label={`Message ${shop_name}`}
              title="Message this shop"
              className={roundButton}
            >
              <MessageCircle className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          {logo && (cover || promo) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizedImage(logo, 96)}
              alt=""
              loading="lazy"
              onError={() => setLogoBroken(true)}
              className="size-11 shrink-0 rounded-full border border-kumo-line object-cover"
            />
          )}
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight text-kumo-default">{shop_name}</h3>
            <p className="truncate text-sm text-kumo-subtle">{location}</p>
          </div>
        </div>

        {promo && <p className="line-clamp-1 text-sm font-medium text-primary">Promo: {promo.title}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-kumo-line pt-3 text-sm">
          {rating > 0 ? (
            <span className="flex items-center gap-1 text-kumo-default">
              <Star className="size-4 text-amber-500" fill="currentColor" aria-hidden />
              <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
              <span className="text-kumo-subtle">({shop.reviewCount})</span>
            </span>
          ) : (
            <span className="text-kumo-subtle">No reviews yet</span>
          )}
          <span className="truncate text-kumo-subtle">{shop.category || "General"}</span>
          <span className={cn("font-medium", is_open ? "text-kumo-success" : "text-kumo-subtle")}>
            {is_open ? "Open now" : "Closed"}
          </span>
        </div>
      </div>
    </article>
  );
};
