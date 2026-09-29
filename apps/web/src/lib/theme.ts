/**
 * Public-site theme colour (CMS → General Settings → Branding).
 *
 * The brand colour is exposed as the `--color-primary` / `--crimson-rgb` CSS
 * variables (see tailwind.config.js). Public pages call `applyThemeColor`
 * with the CMS value; the admin and tenant dashboards call it with `null`
 * so a custom public colour never leaks into the back office.
 */
export const DEFAULT_THEME_COLOR = "#BE1E2D";

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.substring(i, i + 2), 16));
}

export function applyThemeColor(hex?: string | null) {
  if (typeof document === "undefined") return;
  const color = hex && HEX_COLOR_RE.test(hex) ? hex : DEFAULT_THEME_COLOR;
  const [r, g, b] = rgb(color);
  const [rh, gh, bh] = [r, g, b].map((c) => Math.max(0, c - 25));
  const root = document.documentElement.style;
  root.setProperty("--color-primary", `${r} ${g} ${b}`);
  root.setProperty("--crimson-rgb", `${r} ${g} ${b}`);
  root.setProperty("--color-primary-hover", `${rh} ${gh} ${bh}`);
  root.setProperty("--crimson-hover-rgb", `${rh} ${gh} ${bh}`);
}

/** Map iframe URL: explicit embed URL, else Maps Embed API, else a keyless search embed. */
export function mapEmbedSrc(config?: {
  googleMapsEmbedUrl?: string | null;
  googleMapsApiKey?: string | null;
  contactAddress?: string | null;
  footerAddress?: string | null;
} | null) {
  if (config?.googleMapsEmbedUrl) return config.googleMapsEmbedUrl;
  const address =
    config?.contactAddress || config?.footerAddress || "Sophie Red Mall Villanueva Misamis Oriental";
  const q = encodeURIComponent(address);
  return config?.googleMapsApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${config.googleMapsApiKey}&q=${q}`
    : `https://maps.google.com/maps?q=${q}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

export const PUBLIC_CONFIG_CACHE_KEY = "sr_public_config";
