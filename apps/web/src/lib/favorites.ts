"use client";

/**
 * Favourite shops. Signed-in users' favourites live in the database
 * (Favorite table) so they follow the account across devices; localStorage
 * is kept as the instant local copy and for guests. The first sync merges
 * anything saved in this browser before favourites were per-account.
 */
import { getMyFavoritesAction, setFavoriteAction } from "@/app/actions/auth";

const KEY = "sr_mall_favorites";
export const FAVORITES_EVENT = "favorites-updated";

export function readLocalFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

/** Pull the account's favourites (merging this browser's) into the local copy. */
export async function syncFavorites(userId?: string | null): Promise<string[]> {
  const local = readLocalFavorites();
  if (!userId) return local;
  const res = await getMyFavoritesAction(userId, local);
  if (!res.success) return local;
  writeLocal(res.data);
  return res.data;
}

/** Add/remove a favourite locally right away, then on the account. */
export async function setFavorite(tenantId: string, favorite: boolean, userId?: string | null) {
  const local = readLocalFavorites();
  writeLocal(favorite ? [...local, tenantId] : local.filter((id) => id !== tenantId));
  if (!userId) return true;
  const res = await setFavoriteAction(userId, tenantId, favorite);
  if (!res.success) {
    writeLocal(local); // roll back
    return false;
  }
  return true;
}
