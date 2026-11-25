"use client";

/*
 * Shrink a photo in the browser before it is uploaded.
 *
 * Phone photos are often 2-8 MB. Chat uploads go through a server action,
 * which accepts at most 1 MB by default, so large photos failed outright and
 * the rest crawled over mobile data. A 1600px JPEG at 0.82 quality looks the
 * same in a chat bubble and is usually 150-400 KB.
 *
 * GIFs (may be animated) and files already small enough are sent untouched,
 * and if the browser can't decode the image the original is returned, so this
 * never blocks an upload that would have worked before.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;
const SMALL_ENOUGH = 300 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH) {
      bitmap.close();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no transparency: paint white behind PNG cut-outs.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
