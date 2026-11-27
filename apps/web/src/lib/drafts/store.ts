/**
 * Unfinished forms, kept on this device in IndexedDB.
 *
 * Drafts never leave the browser. Passwords, codes, tokens, keys and card data
 * are stripped before anything is written (see `sanitize`).
 */

export type DraftRecord = {
  key: string;
  data: unknown;
  /** What the form held before editing, to spot a newer saved version. */
  base: string;
  updatedAt: number;
};

const DB = "sr-mall-drafts";
const STORE = "drafts";
const SECRET = /pass(word|code)?|pwd|secret|token|api_?key|otp|cvv|cvc|card_?(number|no)|^pin$/i;

let opened: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    opened = null;
    throw error;
  });
  return opened;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const readDraft = (key: string) => run<DraftRecord | undefined>("readonly", (s) => s.get(key));
export const writeDraft = (record: DraftRecord) => run("readwrite", (s) => s.put(record));
export const removeDraft = (key: string) => run("readwrite", (s) => s.delete(key));

/** A copy that is safe to keep: no secret fields. Picked files (Blobs) are kept. */
export function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (!value || typeof value !== "object" || value instanceof Blob || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([name]) => !SECRET.test(name))
      .map(([name, entry]) => [name, sanitize(entry)]),
  ) as T;
}

/** Key order and files don't change the result, so two equal forms compare equal. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_, entry) => {
    if (typeof Blob !== "undefined" && entry instanceof Blob) {
      return { file: (entry as File).name ?? "", size: entry.size, type: entry.type };
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)));
    }
    return entry;
  });
}
