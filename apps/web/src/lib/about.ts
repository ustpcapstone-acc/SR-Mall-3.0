/**
 * The About Us page. Text it shares with the rest of the site (about text,
 * contact details, opening hours, map) stays in its own PublicViewConfig
 * columns; everything else lives in PublicViewConfig.aboutPage, shaped here.
 * Safe to import from client and server code.
 */
import { mapEmbedSrc } from "@/lib/theme";

export const ABOUT_SECTIONS = [
  { id: "about", label: "About SR Mall" },
  { id: "system", label: "About the System" },
  { id: "mission", label: "Mission and Vision" },
  { id: "services", label: "Our Services" },
  { id: "features", label: "System Features" },
  { id: "contact", label: "Contact Information" },
  { id: "hours", label: "Operating Hours" },
  { id: "location", label: "Location" },
] as const;

export type AboutSectionId = (typeof ABOUT_SECTIONS)[number]["id"];

/** A service or a system feature. */
export type AboutItem = { id: string; title: string; description: string; imageUrl: string };

export type AboutPageContent = {
  /** Sections the office switched off. */
  hidden: AboutSectionId[];
  systemPurpose: string;
  /** One objective per line. */
  systemObjectives: string;
  systemImageUrl: string;
  mission: string;
  vision: string;
  missionImageUrl: string;
  services: AboutItem[];
  features: AboutItem[];
  locationImageUrl: string;
};

export const ABOUT_LIMITS = { items: 30, title: 80, short: 400, long: 4000, url: 1000 };

/** The shared columns the page also reads. */
export type AboutConfig = {
  companyName?: string | null;
  aboutTitle?: string | null;
  aboutDescription?: string | null;
  aboutImageUrl?: string | null;
  contactAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  footerAddress?: string | null;
  footerPhone?: string | null;
  footerEmail?: string | null;
  footerFacebook?: string | null;
  footerInstagram?: string | null;
  footerWebsite?: string | null;
  footerOpeningHours?: string | null;
  googleMapsEmbedUrl?: string | null;
  googleMapsApiKey?: string | null;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/** Uploaded pictures only: https, or a file this site serves. */
const picture = (value: unknown) => {
  const url = text(value, ABOUT_LIMITS.url).trim();
  return /^(https:\/\/|\/uploads\/|\/images\/)\S+$/.test(url) ? url : "";
};

const items = (value: unknown): AboutItem[] =>
  (Array.isArray(value) ? value : []).slice(0, ABOUT_LIMITS.items).map((raw, i) => ({
    id: text(raw?.id, 60) || `item-${i}`,
    title: text(raw?.title, ABOUT_LIMITS.title),
    description: text(raw?.description, ABOUT_LIMITS.short),
    imageUrl: picture(raw?.imageUrl),
  }));

/** Whatever is stored or sent, in the right shape. Keeps spaces, so it suits typing. */
export function readAbout(value: unknown): AboutPageContent {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const hidden = Array.isArray(raw.hidden) ? raw.hidden : [];
  return {
    hidden: ABOUT_SECTIONS.map((s) => s.id).filter((id) => hidden.includes(id)),
    systemPurpose: text(raw.systemPurpose, ABOUT_LIMITS.long),
    systemObjectives: text(raw.systemObjectives, ABOUT_LIMITS.long),
    systemImageUrl: picture(raw.systemImageUrl),
    mission: text(raw.mission, ABOUT_LIMITS.long),
    vision: text(raw.vision, ABOUT_LIMITS.long),
    missionImageUrl: picture(raw.missionImageUrl),
    services: items(raw.services),
    features: items(raw.features),
    locationImageUrl: picture(raw.locationImageUrl),
  };
}

const isBlank = (item: AboutItem) => !item.title.trim() && !item.description.trim() && !item.imageUrl;

/** A service or feature that has details but no name. */
export const unnamedItem = (content: AboutPageContent) =>
  [...content.services, ...content.features].some((item) => !item.title.trim() && !isBlank(item));

/** Ready to save: trimmed, with empty rows left out. */
export function cleanAbout(value: unknown): AboutPageContent {
  const content = readAbout(value);
  const tidy = (list: AboutItem[]) =>
    list.filter((i) => !isBlank(i)).map((i) => ({ ...i, title: i.title.trim(), description: i.description.trim() }));
  return {
    ...content,
    systemPurpose: content.systemPurpose.trim(),
    systemObjectives: content.systemObjectives.trim(),
    mission: content.mission.trim(),
    vision: content.vision.trim(),
    services: tidy(content.services),
    features: tidy(content.features),
  };
}

const filled = (value?: string | null) => value?.trim() ?? "";

export const textLines = (value?: string | null) =>
  filled(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Contact details as published: the Contact information value, else the footer one. */
export function contactDetails(config: AboutConfig) {
  const socials = [
    { label: "Facebook", href: filled(config.footerFacebook) },
    { label: "Instagram", href: filled(config.footerInstagram) },
    { label: "Website", href: filled(config.footerWebsite) },
  ].filter((s) => /^https?:\/\/\S+$/i.test(s.href));
  return {
    address: filled(config.contactAddress) || filled(config.footerAddress),
    phone: filled(config.contactPhone) || filled(config.footerPhone),
    email: filled(config.contactEmail) || filled(config.footerEmail),
    socials,
  };
}

/** Whether a section has anything to show. Empty sections are left off the page. */
export function sectionFilled(id: AboutSectionId, config: AboutConfig, about: AboutPageContent) {
  const contact = contactDetails(config);
  switch (id) {
    case "about":
      return Boolean(filled(config.aboutDescription) || filled(config.aboutImageUrl));
    case "system":
      return Boolean(filled(about.systemPurpose) || filled(about.systemObjectives));
    case "mission":
      return Boolean(filled(about.mission) || filled(about.vision));
    case "services":
      return about.services.some((i) => filled(i.title));
    case "features":
      return about.features.some((i) => filled(i.title));
    case "contact":
      return Boolean(contact.address || contact.phone || contact.email || contact.socials.length);
    case "hours":
      return textLines(config.footerOpeningHours).length > 0;
    case "location":
      return Boolean(contact.address || filled(config.googleMapsEmbedUrl));
  }
}

/** What the public page shows: only sections that are switched on and filled in. */
export function aboutSections(config: AboutConfig, about: AboutPageContent) {
  const on = (id: AboutSectionId) => !about.hidden.includes(id) && sectionFilled(id, config, about);
  const contact = contactDetails(config);
  const named = (list: AboutItem[]) => list.filter((i) => filled(i.title));
  return {
    about: on("about")
      ? {
          title: filled(config.aboutTitle) || "About SR Mall",
          text: filled(config.aboutDescription),
          imageUrl: filled(config.aboutImageUrl),
        }
      : null,
    system: on("system")
      ? { purpose: filled(about.systemPurpose), objectives: textLines(about.systemObjectives), imageUrl: about.systemImageUrl }
      : null,
    mission: on("mission") ? { mission: filled(about.mission), vision: filled(about.vision), imageUrl: about.missionImageUrl } : null,
    services: on("services") ? named(about.services) : null,
    features: on("features") ? named(about.features) : null,
    contact: on("contact") ? contact : null,
    hours: on("hours") ? textLines(config.footerOpeningHours) : null,
    location: on("location")
      ? {
          address: contact.address,
          mapSrc: mapEmbedSrc({ ...config, contactAddress: contact.address }),
          imageUrl: about.locationImageUrl,
        }
      : null,
  };
}

export type AboutSections = ReturnType<typeof aboutSections>;

/**
 * A starting point the office can add, then edit: only things this system
 * actually does. Nothing is published until it is saved.
 */
export const SYSTEM_STARTER = {
  purpose:
    "The SR Mall Management System is the online home of the mall. Visitors browse shops, find spaces to rent and contact the mall, while tenants and the mall office manage leases, payments and requests in one place.",
  objectives: [
    "Help visitors find shops, products and promos online",
    "Let people reserve rental spaces and request event bookings online",
    "Keep tenant leases, bills and payment records in one place",
    "Make it easy for customers and tenants to reach the mall office",
  ].join("\n"),
  features: [
    ["Shop directory", "Browse the mall's shops and open each shop's own page."],
    ["Products and promos", "See what shops are selling and their current promos."],
    ["Space rental", "View units for rent on a list or floor map, and reserve one by sending a business permit."],
    ["Events and venue booking", "See upcoming events and send a request to hold your own."],
    ["Messages", "Chat with the mall office and with shops."],
    ["Ratings and reviews", "Rate the mall and its shops, and read what others say."],
    ["Lost and found", "Browse found items, report a lost item or claim your own."],
    ["Tenant dashboard", "Tenants manage their storefront and promos, view bills and payment history, send receipts and file complaints."],
  ].map(([title, description], i) => ({ id: `starter-${i}`, title, description, imageUrl: "" })),
};
