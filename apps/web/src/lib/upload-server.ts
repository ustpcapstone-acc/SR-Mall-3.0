/**
 * Server-only file storage: saves and removes uploads on Cloudinary (or in
 * public/uploads for local development). Nothing here checks who is asking, so
 * callers must do that first. Server actions call these directly; browsers go
 * through /api/upload.
 */
import { createHash, randomBytes } from "crypto";
import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join, resolve, sep } from "path";

export type StoredFile = { url: string; key: string; mediaType: string };

/** The extension comes from the file type, never from the uploaded file name. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

function cloudinaryCredentials() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

function uploadsRoot() {
  const nested = join(process.cwd(), "apps/web/public");
  return join(existsSync(nested) ? nested : join(process.cwd(), "public"), "uploads");
}

/** Saves an already-validated file into a folder. */
export async function storeFile(file: File, folder: string): Promise<StoredFile> {
  const provider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || "local";

  // ─── CLOUDINARY SERVER-SIDE UPLOAD ────────────────────────────────────────
  if (provider === "cloudinary") {
    const creds = cloudinaryCredentials();
    if (!creds) throw new Error("Cloudinary credentials missing in server environment");

    // PDFs go up as "raw" files: Cloudinary blocks PDF delivery as images by default.
    const resourceType = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "raw" : "image";
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Lexicographically sort params: folder, timestamp
    const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${creds.apiSecret}`).digest("hex");

    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    body.append("timestamp", timestamp.toString());
    body.append("api_key", creds.apiKey);
    body.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${resourceType}/upload`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("[CLOUDINARY_API_ERROR]:", errorData);
      throw new Error(errorData.error?.message || "Cloudinary upload failed");
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      key: `cloudinary:${resourceType}:${result.public_id}`,
      mediaType: resourceType.toUpperCase(),
    };
  }

  // ─── LOCAL STORAGE FALLBACK ───────────────────────────────────────────────
  const uploadsDir = join(uploadsRoot(), folder);
  await mkdir(uploadsDir, { recursive: true, mode: 0o777 });

  const fileName = `${Date.now()}_${randomBytes(4).toString("hex")}.${EXTENSIONS[file.type] ?? "bin"}`;
  await writeFile(join(uploadsDir, fileName), Buffer.from(await file.arrayBuffer()));

  return {
    url: `/uploads/${folder}/${fileName}`,
    key: `local:${folder}/${fileName}`,
    mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
  };
}

/**
 * Removes a stored file by its key. Pass `onlyFolders` when the key was saved
 * from something the browser sent, so it can't point at an unrelated asset.
 */
export async function destroyFile(key: string, onlyFolders?: string[]): Promise<boolean> {
  const [provider, ...rest] = key.split(":");
  const path = provider === "cloudinary" ? rest.slice(1).join(":") : rest.join(":");
  if (!path || path.split(/[\\/]/).includes("..")) return false;
  if (onlyFolders && !onlyFolders.some((folder) => path.startsWith(`${folder}/`))) return false;

  if (provider === "cloudinary") {
    const resourceType = rest[0];
    if (resourceType !== "image" && resourceType !== "video" && resourceType !== "raw") return false;
    const creds = cloudinaryCredentials();
    if (!creds) return false;

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = createHash("sha1").update(`public_id=${path}&timestamp=${timestamp}${creds.apiSecret}`).digest("hex");

    const body = new URLSearchParams();
    body.append("public_id", path);
    body.append("timestamp", timestamp.toString());
    body.append("api_key", creds.apiKey);
    body.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${resourceType}/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) console.error("[CLOUDINARY_DESTROY_ERROR]:", await response.json());
    return response.ok;
  }

  const root = resolve(uploadsRoot());
  const filePath = resolve(root, path);
  if (!filePath.startsWith(root + sep)) return false;
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
