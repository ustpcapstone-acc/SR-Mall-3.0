"use client";

import { optimizedImage } from "@/lib/media";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

type Config = {
  aboutTitle?: string | null;
  aboutDescription?: string | null;
  aboutImageUrl?: string | null;
  footerOpeningHours?: string | null;
} | null;

/**
 * "About SR Mall": the mall itself, in plain figures, with the three things
 * people come to the site for. Text and photo come from the Public-View CMS
 * when set.
 */
export function AboutMall({ config, shopCount, spacesForRent }: { config: Config; shopCount: number; spacesForRent: number }) {
  const facts = [
    { value: shopCount ? String(shopCount) : "-", label: shopCount === 1 ? "shop open" : "shops open" },
    { value: String(spacesForRent), label: spacesForRent === 1 ? "space for rent" : "spaces for rent" },
    { value: config?.footerOpeningHours?.trim() || "10 AM to 9 PM", label: "opening hours, daily" },
  ];
  const actions = [
    { href: "#directory", title: "Browse the shops", text: "Find a store, see its products and promos, and message it." },
    { href: "#event-inquiry", title: "Book the venue", text: "Hold your birthday, launch or exhibit at the mall." },
    { href: "/become-a-tenant", title: "Open a store here", text: "Register your business and request a space." },
  ];

  return (
    <section id="about" className="screen-section scroll-mt-20 bg-white py-16 dark:bg-zinc-950 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-charcoal dark:text-white sm:text-4xl lg:text-5xl">
            {config?.aboutTitle?.trim() || "Your mall on the national highway in Jasaan."}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            {config?.aboutDescription?.trim() ||
              "SR Mall brings shops, food and services together in Brgy. Luz Banzon, Jasaan, Misamis Oriental. See what our tenants are selling, catch their latest promos, book the venue for your event, or open a store of your own."}
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-slate-200 py-6 dark:border-white/10">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="sr-only">{f.label}</dt>
                <dd
                  className={`font-display font-semibold text-charcoal dark:text-white ${
                    f.value.length > 4 ? "text-lg leading-snug sm:text-xl" : "text-2xl sm:text-3xl"
                  }`}
                >
                  {f.value}
                </dd>
                <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{f.label}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-6 divide-y divide-slate-200 dark:divide-white/10">
            {actions.map((a, i) => (
              <Reveal as="li" key={a.href} delay={120 * (i + 1)}>
                <Link href={a.href} className="group flex items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block font-semibold text-charcoal dark:text-white">{a.title}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{a.text}</span>
                  </span>
                  <ArrowRight
                    size={18}
                    aria-hidden
                    className="shrink-0 text-primary transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </Reveal>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-slate-100 dark:bg-zinc-900 sm:aspect-4/3 lg:aspect-4/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImage(config?.aboutImageUrl || "/images/mall/facade.webp", 1200)}
              alt="SR Mall"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
