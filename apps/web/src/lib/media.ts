/*
 * Cloudinary image delivery.
 *
 * Uploaded images are stored at their original size (some banners are 2 MB
 * PNGs) and pages used those URLs as-is. Cloudinary can resize and re-encode
 * on delivery: f_auto picks WebP/AVIF for the browser, q_auto picks a quality
 * the eye can't tell apart, and c_limit,w_N only ever shrinks (never upscales).
 * The original file is untouched; only the delivered copy changes.
 *
 * Anything that isn't a plain Cloudinary image URL (local files, data: URLs,
 * videos, URLs that already carry a transformation) is returned unchanged.
 */
const UPLOAD = "/image/upload/";

export function optimizedImage(url: string | null | undefined, width = 1200): string {
  if (!url) return url ?? "";
  if (!url.startsWith("https://res.cloudinary.com/")) return url;
  const at = url.indexOf(UPLOAD);
  if (at === -1) return url;
  const rest = url.slice(at + UPLOAD.length);
  // Already transformed (e.g. "w_400,c_fill/..."): leave it alone.
  const first = rest.split("/")[0];
  if (/^(a|ar|b|bo|c|co|dpr|e|f|fl|g|h|l|o|q|r|t|u|w|x|y|z)_/.test(first)) return url;
  const w = Math.max(64, Math.round(width));
  return `${url.slice(0, at + UPLOAD.length)}f_auto,q_auto,c_limit,w_${w}/${rest}`;
}
