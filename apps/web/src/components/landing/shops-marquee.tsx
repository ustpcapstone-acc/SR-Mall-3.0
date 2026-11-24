"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { DigitalStorefront } from "@/types/storefront";

type Promo = { id: string; title: string; tenantId?: string; tenant?: { id?: string; shopName?: string | null; user?: { name?: string | null } | null } | null };

const LOGO = "/images/srmall-logo/sr_logo2.jpg";

/**
 * Drifts a row of items sideways forever. Scrolling the page speeds it up
 * (and flips it while scrolling back up). Pauses on hover; stands still for
 * people who prefer less motion.
 */
function useMarquee(direction: 1 | -1, itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    if (!row || !itemCount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = 0;
    let boost = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let hovered = false;
    let raf = 0;

    const onScroll = () => {
      const y = window.scrollY;
      boost += (y - lastY) * 0.15;
      boost = Math.max(-40, Math.min(40, boost));
      lastY = y;
    };
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);

    const tick = (t: number) => {
      const dt = Math.min(64, t - lastT) / 16.67;
      lastT = t;
      const half = row.scrollWidth / 2;
      if (half > 0) {
        const base = hovered ? 0 : 0.6;
        const flip = boost < -1 ? -1 : 1;
        x -= direction * flip * (base + Math.abs(boost) * 0.25) * dt;
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        row.style.transform = `translate3d(${x}px,0,0)`;
      }
      boost *= 0.92;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    row.addEventListener("mouseenter", enter);
    row.addEventListener("mouseleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      row.removeEventListener("mouseenter", enter);
      row.removeEventListener("mouseleave", leave);
    };
  }, [direction, itemCount]);
  return ref;
}

/** Repeat a list until it is long enough to fill a wide screen, then double it for a seamless loop. */
function loopItems<T>(items: T[], minCount: number) {
  if (!items.length) return [];
  const base: T[] = [];
  while (base.length < minCount) base.push(...items);
  return [...base, ...base];
}

export function ShopsMarquee({ shops, promos }: { shops: DigitalStorefront[]; promos: Promo[] }) {
  const shopNames = shops.filter((s) => s.shop_name?.trim());
  const shopById = new Map(shops.map((s) => [s.id, s]));

  const band = [
    ...promos.map((p) => {
      const tid = p.tenantId || p.tenant?.id;
      const shop = tid ? shopById.get(tid) : undefined;
      return {
        key: `p-${p.id}`,
        label: p.title,
        at: shop?.shop_name || p.tenant?.shopName || p.tenant?.user?.name || "",
        href: shop ? `/shop/${shop.id}` : "/tenant-directory",
      };
    }),
    ...Array.from(new Set(shops.map((s) => s.category?.trim()).filter(Boolean) as string[])).map((c) => ({
      key: `c-${c}`,
      label: c,
      at: "",
      href: "/#directory",
    })),
  ];

  const shopRow = useMarquee(1, shopNames.length);
  const bandRow = useMarquee(-1, band.length);

  if (!shopNames.length) return null;

  const shopLoop = loopItems(shopNames, 6);
  const bandLoop = loopItems(band, 8);
  const half = (i: number, len: number) => i >= len / 2;

  return (
    <section aria-label="Shops at SR Mall" className="relative overflow-hidden border-b border-slate-200 dark:border-white/5 pt-12 sm:pt-16">
      <div className="mx-auto mb-4 flex max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">In the mall today</p>
        <Link
          href="/tenant-directory"
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
        >
          All {shopNames.length} {shopNames.length === 1 ? "shop" : "shops"}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="pb-4">
        <div ref={shopRow} className="flex w-max items-center will-change-transform">
          {shopLoop.map((s, i) => {
            const copy = half(i, shopLoop.length) || i >= shopNames.length;
            return (
              <Link
                key={`${s.id}-${i}`}
                href={`/shop/${s.id}`}
                tabIndex={copy ? -1 : undefined}
                aria-hidden={copy || undefined}
                className="group flex items-center gap-[0.3em] px-[0.3em] text-[clamp(3rem,10vw,9rem)] leading-[1.1]"
              >
                <span className="font-display font-semibold whitespace-nowrap text-white dark:text-zinc-950 transition-colors duration-300 [paint-order:stroke_fill] [-webkit-text-stroke:3px_var(--color-charcoal)] dark:[-webkit-text-stroke:3px_#ffffff] group-hover:text-primary group-hover:[-webkit-text-stroke-color:var(--color-primary)]">
                  {s.shop_name}
                </span>
                <img
                  src={LOGO}
                  alt=""
                  className="size-[0.4em] rounded-full object-cover transition-transform duration-700 group-hover:rotate-[360deg]"
                />
              </Link>
            );
          })}
        </div>
      </div>

      {bandLoop.length > 0 && (
        <div className="bg-primary py-3 text-white">
          <div ref={bandRow} className="flex w-max items-center will-change-transform">
            {bandLoop.map((b, i) => {
              const copy = half(i, bandLoop.length) || i >= band.length;
              return (
                <Link
                  key={`${b.key}-${i}`}
                  href={b.href}
                  tabIndex={copy ? -1 : undefined}
                  aria-hidden={copy || undefined}
                  className="flex items-center gap-3 px-6 whitespace-nowrap"
                >
                  <Sparkles className="size-4 text-amber-200" aria-hidden />
                  <span className="font-display text-[clamp(1.25rem,2.6vw,2rem)] italic">{b.label}</span>
                  {b.at && <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/70">at {b.at}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
