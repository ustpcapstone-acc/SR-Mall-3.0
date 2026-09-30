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
 */
export function ShopPromos({ tenantId }: { tenantId: string }) {
  const [promos, setPromos] = useState<ShopPromo[]>([]);

  useEffect(() => {
    let alive = true;
    void getShopActivePromosAction(tenantId).then((rows: any[]) => {
      if (alive) setPromos(rows || []);
    });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  if (promos.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-10 sm:pb-16">
      <div className="flex items-center gap-2 mb-5 sm:mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/30">
          <Flame size={12} fill="currentColor" /> Current promos
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {promos.length} running now
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        {promos.map((p) => {
          const isVideo = p.mediaType === "VIDEO" && p.promoVideo;
          return (
            <article
              key={p.id}
              className="bg-white dark:bg-zinc-900 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm"
            >
              <div className="aspect-[16/10] relative bg-black">
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
                <h3 className="text-lg sm:text-2xl font-black text-charcoal dark:text-white tracking-tight uppercase">{p.title}</h3>
                {p.description?.trim() && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.description.trim()}</p>
                )}
                <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
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
