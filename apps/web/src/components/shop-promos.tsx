"use client";

import { useEffect, useState } from "react";
import { Calendar, Flame } from "lucide-react";
import { getShopActivePromosAction } from "@/app/actions/ads";
import { formatPHDate } from "@/lib/ph-date";

type ShopPromo = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  mediaType: string;
  promoImage?: string | null;
  promoVideo?: string | null;
  startDate: string | Date;
  endDate: string | Date;
};

/**
 * "Current promos" on the shop page: the shop's approved promos that are
 * running now. Videos play here with controls (the directory card only
 * previews them). Renders nothing when the shop has no live promo.
 *
 * `embedded` drops the section wrapper so the shop page can place the cards
 * inside its "Promos & sales" tab; `onCount` lets that tab show a live badge.
 */
export function ShopPromos({
  tenantId,
  embedded = false,
  onCount,
}: {
  tenantId: string;
  embedded?: boolean;
  onCount?: (count: number) => void;
}) {
  const [promos, setPromos] = useState<ShopPromo[]>([]);

  useEffect(() => {
    let alive = true;
    void getShopActivePromosAction(tenantId).then((rows: any[]) => {
      if (!alive) return;
      const list = (rows || []) as ShopPromo[];
      setPromos(list);
      onCount?.(list.length);
    });
    return () => {
      alive = false;
    };
  }, [tenantId, onCount]);

  if (promos.length === 0) return null;

  if (embedded) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {promos.map((p) => {
          const isVideo = p.mediaType === "VIDEO" && p.promoVideo;
          return (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[#E8E2DE] bg-white shadow-xs dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="relative aspect-16/10 bg-black">
                {isVideo ? (
                  <video
                    src={p.promoVideo!}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                ) : p.promoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.promoImage} alt={p.title} className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#C51D30] px-3 py-1 text-xs font-bold text-white shadow-lg shadow-[#C51D30]/30">
                  <Flame size={11} fill="currentColor" /> Promo
                </span>
              </div>
              <div className="space-y-2 p-4 sm:p-5">
                <h3 className="text-lg font-bold leading-tight text-[#21191B] dark:text-white sm:text-xl">
                  {p.title}
                </h3>
                {p.description?.trim() && (
                  <p className="text-[13px] leading-relaxed text-[#70656A] dark:text-slate-400">
                    {p.description.trim()}
                  </p>
                )}
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B7F76]">
                  <Calendar size={12} className="text-[#C51D30]" /> Until {formatPHDate(p.endDate)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-10 sm:pb-16">
      <div className="flex items-center gap-2 mb-5 sm:mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/30">
          <Flame size={12} fill="currentColor" /> Current promos
        </span>
        <span className="text-xs font-bold text-slate-400">
          {promos.length} running now
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        {promos.map((p) => {
          const isVideo = p.mediaType === "VIDEO" && p.promoVideo;
          return (
            <article
              key={p.id}
              className="bg-white dark:bg-zinc-900 rounded-[1.25rem] sm:rounded-4xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-xs"
            >
              <div className="aspect-16/10 relative bg-black">
                {isVideo ? (
                  <video
                    src={p.promoVideo!}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                ) : p.promoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.promoImage} alt={p.title} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="p-4 sm:p-6 space-y-2">
                <h3 className="text-lg sm:text-2xl font-semibold text-charcoal dark:text-white tracking-tight">{p.title}</h3>
                {p.description?.trim() && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.description.trim()}</p>
                )}
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Calendar size={12} className="text-primary" /> Until {formatPHDate(p.endDate)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
