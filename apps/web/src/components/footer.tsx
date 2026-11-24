"use client";

import Link from "next/link";

import { Mail, Phone, MapPin, Instagram, Facebook, Globe, Clock } from "lucide-react";

interface FooterProps {
  config?: {
    logoUrl?: string | null;
    companyName?: string | null;
    contactAddress?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    footerDescription?: string | null;
    footerInstagram?: string | null;
    footerFacebook?: string | null;
    footerWebsite?: string | null;
    footerCopyrightText?: string | null;
    footerAddress?: string | null;
    footerPhone?: string | null;
    footerEmail?: string | null;
    footerOpeningHours?: string | null;
    [key: string]: any;
  } | null;
}

const DEFAULT_HOURS = "Mon–Sun: 10:00 AM – 9:00 PM";

const FIND_YOUR_WAY = [
  { href: "/tenant-directory", label: "Shops" },
  { href: "/products", label: "Products" },
  { href: "/available-spaces", label: "Spaces" },
  { href: "/#events", label: "What's on" },
  { href: "/#location", label: "Visit" },
  { href: "/lost-and-found", label: "Lost & found" },
  { href: "/become-a-tenant", label: "Become a tenant" },
];

const columnLabel = "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400";
const linkHover = "transition-colors hover:text-primary";

export const Footer = ({ config }: FooterProps = {}) => {
  const name = config?.companyName || "SR Mall";
  const address = config?.footerAddress || config?.contactAddress || "Jasaan, Misamis Oriental, 9002, Philippines";
  const phone = config?.footerPhone || config?.contactPhone || "";
  const email = config?.footerEmail || config?.contactEmail || "";
  const hours = (config?.footerOpeningHours || DEFAULT_HOURS)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Only show social icons that actually link somewhere.
  const socials = [
    { href: config?.footerInstagram, label: "Instagram", icon: Instagram },
    { href: config?.footerFacebook, label: "Facebook", icon: Facebook },
    { href: config?.footerWebsite, label: "Website", icon: Globe },
  ].filter((s): s is { href: string; label: string; icon: typeof Globe } => Boolean(s.href));

  const year = new Date().getFullYear();
  // Size the big name so it always fits on one line (capitals run wider).
  const caps = name === name.toUpperCase();
  const watermarkSize = `${Math.min(27, 189 / Math.max(name.length, 1)) * (caps ? 0.78 : 1)}vw`;

  return (
    <footer className="relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-charcoal dark:text-white pt-20 border-t border-slate-200 dark:border-white/5 transition-colors">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        {/* About SR Mall */}
        <div className="space-y-5">
          <Link href="/" className="group flex items-center gap-2.5" aria-label={`${name} home`}>
            <img
              src={config?.logoUrl || "/images/srmall-logo/sr_logo2.jpg"}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-[0.9rem] object-cover shadow-[0_6px_16px_-8px_var(--color-primary)] transition-transform duration-500 group-hover:-rotate-6"
            />
            <span className="font-display text-lg font-semibold leading-none">{name}</span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {config?.footerDescription ||
              "The ultimate destination for shopping, dining, and leisure in Misamis Oriental. We're committed to delivering a superior experience for all visitors."}
          </p>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="grid size-10 place-items-center rounded-full border border-slate-200 dark:border-white/10 transition-colors hover:border-primary hover:bg-primary hover:text-white"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Find your way */}
        <div>
          <p className={columnLabel}>Find your way</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FIND_YOUR_WAY.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkHover}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Visit */}
        <div>
          <p className={columnLabel}>Visit</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <span>{address}</span>
            </li>
            {hours.map((line) => (
              <li key={line} className="flex gap-2.5">
                <Clock size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Talk to us */}
        <div>
          <p className={columnLabel}>Talk to us</p>
          <ul className="mt-4 space-y-3 text-sm">
            {email && (
              <li className="flex gap-2.5">
                <Mail size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <a href={`mailto:${email}`} className={`break-all ${linkHover}`}>
                  {email}
                </a>
              </li>
            )}
            {phone && (
              <li className="flex gap-2.5">
                <Phone size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={linkHover}>
                  {phone}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-[1400px] flex-col gap-2 border-t border-slate-200 dark:border-white/10 px-4 pt-6 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>{config?.footerCopyrightText || `© ${year} ${name}. All rights reserved.`}</p>
        <p>Designed and developed by Jerick Aradilla, Scott Dugang and Nielchi Juarez</p>
      </div>

      {/* Big faint name across the bottom */}
      <p
        aria-hidden
        style={{ fontSize: watermarkSize }}
        className="font-display pointer-events-none mt-6 -mb-[0.22em] select-none whitespace-nowrap text-center font-semibold leading-none text-charcoal/[0.06] dark:text-white/[0.06]"
      >
        {name}
      </p>
    </footer>
  );
};
