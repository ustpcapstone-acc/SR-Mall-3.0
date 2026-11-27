"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
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
      <section>
      <div className="mb-3">
        <h2 className="font-display text-xl font-semibold text-kumo-default">Promos</h2>
        <p className="text-sm text-kumo-subtle">{promos.length} running now</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {promos.map((p) => {
          const isVideo = p.mediaType === "VIDEO" && p.promoVideo;
          return (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base shadow-xs"
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
              </div>
              <div className="space-y-2 p-4 sm:p-5">
                <h3 className="text-lg font-semibold leading-tight text-kumo-default sm:text-xl">
                  {p.title}
                </h3>
                {p.description?.trim() && (
                  <p className="text-sm leading-relaxed text-kumo-subtle">
                    {p.description.trim()}
                  </p>
                )}
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-kumo-subtle">
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

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-10 sm:pb-16">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-semibold text-kumo-default">Current promos</h2>
        <p className="text-sm text-kumo-subtle">{promos.length} running now</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        {promos.map((p) => {
          const isVideo = p.mediaType === "VIDEO" && p.promoVideo;
          return (
            <article
              key={p.id}
              className="bg-kumo-base rounded-2xl sm:rounded-2xl border border-kumo-line overflow-hidden shadow-xs"
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
                <h3 className="text-lg sm:text-2xl font-semibold text-kumo-default tracking-tight">{p.title}</h3>
                {p.description?.trim() && (
                  <p className="text-sm text-kumo-subtle leading-relaxed">{p.description.trim()}</p>
                )}
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-kumo-subtle">
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
