"use client";

import { getAllStorefrontsAction } from "@/app/actions/tenant";

/*
 * One request, many callers.
 *
 * Next.js runs a page's server actions one after another, so every duplicate
 * call queues behind the others and delays the whole page. The home page used
 * to ask for the full shop list four times (page, navbar, chat box, feedback
 * form). Callers that share a key here share one request: an in-flight call is
 * reused, and its result is reused for `ttlMs` afterwards. Failures are not
 * kept, so the next caller tries again.
 */
const entries = new Map<string, { at: number; promise: Promise<unknown> }>();

export function sharedRequest<T>(key: string, load: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = load().then(
    (value) => {
      if ((value as { success?: boolean } | null)?.success === false) entries.delete(key);
      return value;
    },
    (err) => {
      entries.delete(key);
      throw err;
    },
  );
  entries.set(key, { at: Date.now(), promise });
  return promise;
}

/** Store a result fetched some other way (e.g. a page's combined first load). */
export function primeSharedRequest<T>(key: string, value: T) {
  if ((value as { success?: boolean } | null)?.success === false) return;
  if (entries.has(key)) return;
  entries.set(key, { at: Date.now(), promise: Promise.resolve(value) });
}

/** Forget a cached result (after a change the caller knows about). */
export function invalidateSharedRequest(key: string) {
  entries.delete(key);
}

/** All active storefronts for public pages, shared across components. */
export function loadStorefronts() {
  return sharedRequest("storefronts", () => getAllStorefrontsAction());
}
