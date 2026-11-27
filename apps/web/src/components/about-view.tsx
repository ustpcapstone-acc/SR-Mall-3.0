"use client";

import { Clock, Facebook, Globe, Instagram, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicHeader } from "@/components/public-header";
import { ABOUT_SECTIONS, type AboutSections } from "@/lib/about";
import { optimizedImage } from "@/lib/media";

const CARD = "rounded-2xl border border-kumo-line bg-kumo-base";
const SOCIAL_ICONS: Record<string, typeof Globe> = { Facebook, Instagram, Website: Globe };

function Picture({ url, alt, className = "aspect-4/3" }: { url: string; alt: string; className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-kumo-recessed ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={optimizedImage(url, 1200)} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display text-2xl font-semibold tracking-tight text-kumo-default sm:text-3xl">{children}</h2>
);

const Body = ({ children }: { children: React.ReactNode }) => (
  <p className="whitespace-pre-line text-base leading-relaxed text-kumo-default wrap-anywhere">{children}</p>
);

/** Text on the left and its picture on the right, when there is one. */
function WithPicture({ url, alt, children }: { url: string; alt: string; children: React.ReactNode }) {
  return (
    <div className={url ? "grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10" : "max-w-3xl"}>
      <div className="min-w-0 space-y-4">{children}</div>
      {url && <Picture url={url} alt={alt} />}
    </div>
  );
}

function Items({ items }: { items: NonNullable<AboutSections["services"]> }) {
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className={`${CARD} overflow-hidden`}>
          {item.imageUrl && <Picture url={item.imageUrl} alt={item.title} className="aspect-16/10 rounded-none" />}
          <div className="p-5">
            <h3 className="text-lg font-semibold text-kumo-default wrap-anywhere">{item.title}</h3>
            {item.description && (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-kumo-subtle wrap-anywhere">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The public About Us page. It only receives the sections visitors may see. */
export function AboutView({ config, sections }: { config: Record<string, any> | null; sections: AboutSections }) {
  const { about, system, mission, services, features, contact, hours, location } = sections;
  const shown = ABOUT_SECTIONS.filter((s) => sections[s.id]);

  return (
    <div className="min-h-screen bg-kumo-recessed font-sans selection:bg-primary selection:text-white">
      <Navbar config={config as any} />

      <PublicHeader title="About Us" description="The mall, this website and how to reach us." />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-16 text-center text-base text-kumo-subtle">
            This page is still being prepared. Please check back soon.
          </p>
        ) : (
          <>
            {shown.length > 1 && (
              <nav aria-label="On this page" className="mb-10">
                <ul className="flex flex-wrap gap-2">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="inline-flex h-9 items-center rounded-lg border border-kumo-line bg-kumo-base px-3.5 text-sm font-medium text-kumo-default hover:border-primary hover:text-primary"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="space-y-14">
              {about && (
                <section id="about" className="scroll-mt-24">
                  <WithPicture url={about.imageUrl} alt={about.title}>
                    <Heading>{about.title}</Heading>
                    {about.text && <Body>{about.text}</Body>}
                  </WithPicture>
                </section>
              )}

              {system && (
                <section id="system" className="scroll-mt-24">
                  <WithPicture url={system.imageUrl} alt="The SR Mall Management System">
                    <Heading>About the System</Heading>
                    {system.purpose && <Body>{system.purpose}</Body>}
                    {system.objectives.length > 0 && (
                      <>
                        <h3 className="text-lg font-semibold text-kumo-default">Objectives</h3>
                        <ul className="list-disc space-y-1.5 pl-5 text-base leading-relaxed text-kumo-default marker:text-primary">
                          {system.objectives.map((line, i) => (
                            <li key={i} className="wrap-anywhere">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </WithPicture>
                </section>
              )}

              {mission && (
                <section id="mission" className="scroll-mt-24 space-y-5">
                  <Heading>{mission.mission && mission.vision ? "Mission and Vision" : mission.mission ? "Mission" : "Vision"}</Heading>
                  {mission.imageUrl && <Picture url={mission.imageUrl} alt="SR Mall" className="aspect-21/9" />}
                  <div className={mission.mission && mission.vision ? "grid gap-4 md:grid-cols-2" : "max-w-3xl"}>
                    {(
                      [
                        ["Mission", mission.mission],
                        ["Vision", mission.vision],
                      ] as const
                    ).map(
                      ([label, value]) =>
                        value && (
                          <div key={label} className={`${CARD} space-y-2 p-5 sm:p-8`}>
                            <h3 className="font-display text-xl font-semibold text-primary">{label}</h3>
                            <Body>{value}</Body>
                          </div>
                        ),
                    )}
                  </div>
                </section>
              )}

              {services && (
                <section id="services" className="scroll-mt-24">
                  <Heading>Our Services</Heading>
                  <Items items={services} />
                </section>
              )}

              {features && (
                <section id="features" className="scroll-mt-24">
                  <Heading>System Features</Heading>
                  <Items items={features} />
                </section>
              )}

              {(contact || hours) && (
                <div className={contact && hours ? "grid gap-10 lg:grid-cols-2" : "max-w-3xl"}>
                  {contact && (
                    <section id="contact" className="scroll-mt-24 space-y-5">
                      <Heading>Contact Information</Heading>
                      <ul className={`${CARD} divide-y divide-kumo-line`}>
                        {contact.address && (
                          <li className="flex items-start gap-3 p-4">
                            <MapPin size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                            <span className="text-base text-kumo-default wrap-anywhere">{contact.address}</span>
                          </li>
                        )}
                        {contact.phone && (
                          <li className="flex items-start gap-3 p-4">
                            <Phone size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                            <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="text-base text-kumo-default hover:text-primary wrap-anywhere">
                              {contact.phone}
                            </a>
                          </li>
                        )}
                        {contact.email && (
                          <li className="flex items-start gap-3 p-4">
                            <Mail size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                            <a href={`mailto:${contact.email}`} className="text-base text-kumo-default hover:text-primary wrap-anywhere">
                              {contact.email}
                            </a>
                          </li>
                        )}
                        {contact.socials.map((social) => {
                          const Icon = SOCIAL_ICONS[social.label] ?? Globe;
                          return (
                            <li key={social.label} className="flex items-start gap-3 p-4">
                              <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                              <a href={social.href} target="_blank" rel="noopener noreferrer" className="min-w-0 text-base text-kumo-default hover:text-primary">
                                {social.label}
                                <span className="block text-sm text-kumo-subtle wrap-anywhere">{social.href}</span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {hours && (
                    <section id="hours" className="scroll-mt-24 space-y-5">
                      <Heading>Operating Hours</Heading>
                      <ul className={`${CARD} divide-y divide-kumo-line`}>
                        {hours.map((line, i) => (
                          <li key={i} className="flex items-start gap-3 p-4">
                            <Clock size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                            <span className="text-base text-kumo-default wrap-anywhere">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              {location && (
                <section id="location" className="scroll-mt-24 space-y-5">
                  <Heading>Location</Heading>
                  <div className={location.imageUrl ? "grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}>
                    <div className={`${CARD} relative min-h-88 overflow-hidden sm:min-h-104`}>
                      <iframe
                        title="Map to SR Mall"
                        src={location.mapSrc}
                        className="absolute inset-0 size-full border-0"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    {location.imageUrl && <Picture url={location.imageUrl} alt="SR Mall" className="aspect-4/3 lg:aspect-auto lg:min-h-full" />}
                  </div>
                  {location.address && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base text-kumo-default wrap-anywhere">{location.address}</p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
                      >
                        <Navigation size={16} aria-hidden />
                        Get directions
                      </a>
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </main>

      <Footer config={config} />
    </div>
  );
}
