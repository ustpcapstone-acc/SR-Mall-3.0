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
    <section id="about" className="screen-section scroll-mt-20 bg-kumo-base py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-kumo-default sm:text-4xl lg:text-5xl">
            {config?.aboutTitle?.trim() || "Your mall on the national highway in Jasaan."}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-kumo-subtle sm:text-lg">
            {config?.aboutDescription?.trim() ||
              "SR Mall brings shops, food and services together in Brgy. Luz Banzon, Jasaan, Misamis Oriental. See what our tenants are selling, catch their latest promos, book the venue for your event, or open a store of your own."}
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-kumo-line py-6">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="sr-only">{f.label}</dt>
                <dd
                  className={`font-display font-semibold text-kumo-default ${
                    f.value.length > 4 ? "text-lg leading-snug sm:text-xl" : "text-2xl sm:text-3xl"
                  }`}
                >
                  {f.value}
                </dd>
                <dd className="mt-1 text-xs text-kumo-subtle sm:text-sm">{f.label}</dd>
              </div>
            ))}
          </dl>

          <Link href="/about" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            More about SR Mall
            <ArrowRight size={16} aria-hidden />
          </Link>

          <ul className="mt-6 divide-y divide-kumo-line">
            {actions.map((a, i) => (
              <Reveal as="li" key={a.href} delay={120 * (i + 1)}>
                <Link href={a.href} className="group flex items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block font-semibold text-kumo-default">{a.title}</span>
                    <span className="block text-sm text-kumo-subtle">{a.text}</span>
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
          <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-kumo-recessed sm:aspect-4/3 lg:aspect-4/5">
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
