"use client";

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

export const Footer = ({ config }: FooterProps = {}) => {
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

  return (
    <footer className="bg-zinc-50 dark:bg-zinc-950 text-charcoal dark:text-white pt-20 pb-10 border-t border-slate-200 dark:border-white/5 transition-colors">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* About SR Mall */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-white rounded-lg overflow-hidden shadow-lg border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <img
                src={config?.logoUrl || "/images/srmall-logo/sr_logo2.jpg"}
                alt={config?.companyName || "SR Mall logo"}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-black tracking-tighter text-charcoal dark:text-white">
              {config?.companyName || "SR MALL"}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            {config?.footerDescription ||
              "The ultimate destination for shopping, dining, and leisure in Misamis Oriental. We're committed to delivering a superior experience for all visitors."}
          </p>
          {socials.length > 0 && (
            <div className="flex items-center gap-4">
              {socials.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="hover:text-primary transition-colors text-slate-400"
                >
                  <Icon size={20} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Opening hours */}
        <div>
          <h3 className="text-lg font-bold mb-6">Opening Hours</h3>
          <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
            {hours.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <Clock size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Find us */}
        <div>
          <h3 className="text-lg font-bold mb-6">Find Us</h3>
          <div className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-primary mt-0.5 shrink-0" />
              <span>{address}</span>
            </div>
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                <Phone size={18} className="text-primary shrink-0" />
                <span>{phone}</span>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-3 hover:text-primary transition-colors break-all">
                <Mail size={18} className="text-primary shrink-0" />
                <span>{email}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-20 pt-8 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 space-y-2 px-4">
        <p>{config?.footerCopyrightText || `© ${year} ${config?.companyName || "SR Mall"}. All rights reserved.`}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Designed &amp; developed by{" "}
          <span className="font-bold text-charcoal dark:text-slate-200">Jerick Aradilla</span>,{" "}
          <span className="font-bold text-charcoal dark:text-slate-200">Scott Dugang</span> and{" "}
          <span className="font-bold text-charcoal dark:text-slate-200">Nielchi Juarez</span>
        </p>
      </div>
    </footer>
  );
};
