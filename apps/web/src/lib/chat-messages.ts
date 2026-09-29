/**
 * Pure helpers for SR-Mall chat message state.
 *
 * Every surface (public ChatBox, tenant messenger, admin messenger hub) keeps a
 * flat `messages` array. These helpers make that array safe to touch from four
 * directions at once — initial fetch, older-page pagination, optimistic send
 * and Supabase Realtime — without ever producing a duplicate bubble.
 *
 * Rules:
 *  - The database id is the identity of a message. Two entries with the same id
 *    are impossible by construction.
 *  - Optimistic bubbles carry a `temp-…` id and are always kept last.
 *  - A realtime/persisted row adopts (replaces) at most one matching temp.
 */

export type ChatMessageLike = Record<string, any>;

export const OPTIMISTIC_PREFIX = "temp-";
/** Page size used by the chat (mirrors the server default). */
export const MESSAGE_PAGE_SIZE = 30;
/** Matching window used when pairing an optimistic bubble with its DB row. */
const ADOPT_WINDOW_MS = 2 * 60 * 1000;

export function isOptimistic(message: ChatMessageLike | null | undefined): boolean {
  return Boolean(message && String(message.id ?? "").startsWith(OPTIMISTIC_PREFIX));
}

function timeOf(message: ChatMessageLike): number {
  const value = message?.createdAt;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Chronological order with the id as a deterministic tie-breaker. */
export function compareMessages(a: ChatMessageLike, b: ChatMessageLike): number {
  const delta = timeOf(a) - timeOf(b);
  if (delta !== 0) return delta;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/**
 * Chronological order + uniqueness. The id is the identity of a message, so a
 * list can never contain the same id twice (React would warn about duplicate
 * keys and a bubble could be dropped or doubled by the renderer).
 */
export function sortChatMessages(list: ChatMessageLike[]): ChatMessageLike[] {
  const persisted: ChatMessageLike[] = [];
  const optimistic: ChatMessageLike[] = []; // insertion order, always last
  const seen = new Set<string>();

  for (const message of list) {
    if (isOptimistic(message)) {
      optimistic.push(message);
      continue;
    }
    const id = message?.id == null ? null : String(message.id);
    if (id !== null) {
      if (seen.has(id)) continue; // duplicate row — keep the first occurrence
      seen.add(id);
    }
    persisted.push(message);
  }

  persisted.sort(compareMessages);
  return [...persisted, ...optimistic];
}

/**
 * Normalise a list coming from somewhere other than a helper (a cached array
 * or a hand-built append) so it is sorted and duplicate-free.
 */
export function normalizeMessages(list: ChatMessageLike[]): ChatMessageLike[] {
  return sortChatMessages(Array.isArray(list) ? list : []);
}

function senderMatches(optimistic: ChatMessageLike, persisted: ChatMessageLike): boolean {
  const optimisticId = optimistic.senderId ?? optimistic.sender?.id;
  const persistedId = persisted.senderId ?? persisted.sender?.id;
  if (optimisticId && persistedId) return optimisticId === persistedId;

  const optimisticEmail = optimistic.sender?.email?.toLowerCase?.();
  const persistedEmail = persisted.sender?.email?.toLowerCase?.();
  if (optimisticEmail && persistedEmail) return optimisticEmail === persistedEmail;

  return true; // sender not comparable → rely on content + time window
}

function isImageMessage(message: ChatMessageLike): boolean {
  return Boolean(message.imageUrl) || message.content === "📎 Image";
}

/** Does `persisted` represent the same message as the optimistic `optimistic`? */
function isAdopted(optimistic: ChatMessageLike, persisted: ChatMessageLike): boolean {
  if (optimistic.id === persisted.id) return true;
  if (isOptimistic(persisted)) return false;
  if (!senderMatches(optimistic, persisted)) return false;
  if (Math.abs(timeOf(optimistic) - timeOf(persisted)) > ADOPT_WINDOW_MS) return false;

  const sameContent = optimistic.content === persisted.content;
  const sameImage = isImageMessage(optimistic) && isImageMessage(persisted);
  return sameContent || sameImage;
}

/**
 * Replace state with a freshly fetched page (or full history) from the server.
 * Optimistic bubbles that are not yet in the fetched data are preserved.
 */
export function mergeFetchedMessages(
  existing: ChatMessageLike[],
  history: ChatMessageLike[],
): ChatMessageLike[] {
  const optimisticMessages = existing.filter(isOptimistic);
  const stillPending = optimisticMessages.filter(
    (temp) => !history.some((row) => isAdopted(temp, row)),
  );

  const merged = sortChatMessages([...history, ...stillPending]);

  const unchanged =
    optimisticMessages.length === 0 &&
    existing.length === merged.length &&
    existing[existing.length - 1]?.id === merged[merged.length - 1]?.id;
  return unchanged ? existing : merged;
}

/** Fold one realtime row (INSERT) into state without ever duplicating it. */
export function applyRealtimeMessage(
  existing: ChatMessageLike[],
  row: ChatMessageLike,
): ChatMessageLike[] {
  if (!row?.id) return existing;

  const index = existing.findIndex((m) => m.id === row.id);
  if (index >= 0) {
    // Already displayed (usually the optimistic bubble reconciled by id):
    // update in place instead of appending a second copy.
    const next = [...existing];
    next[index] = {
      ...next[index],
      ...row,
      sender: next[index].sender ?? row.sender,
      sending: false,
      failed: false,
    };
    return sortChatMessages(next);
  }

  const matchedTemp = existing.find((m) => isOptimistic(m) && isAdopted(m, row));
  const withoutMatched = matchedTemp
    ? existing.filter((m) => m !== matchedTemp)
    : existing;

  return sortChatMessages([...withoutMatched, row]);
}

/** Drop a message that was deleted/unsent elsewhere (realtime DELETE). */
export function applyRealtimeDelete(
  existing: ChatMessageLike[],
  messageId: string,
): ChatMessageLike[] {
  if (!messageId) return existing;
  const next = existing.filter((m) => m.id !== messageId);
  return next.length === existing.length ? existing : next;
}

/**
 * Replace an optimistic bubble with the row returned by the server.
 * Returns the list unchanged when the bubble is already gone.
 */
export function replaceOptimistic(
  existing: ChatMessageLike[],
  tempId: string,
  persisted: ChatMessageLike,
): ChatMessageLike[] {
  const index = existing.findIndex((m) => m.id === tempId);
  if (index < 0) {
    if (persisted?.id && existing.some((m) => m.id === persisted.id)) return existing;
    return sortChatMessages([...existing, ...(persisted ? [persisted] : [])]);
  }

  // The temp is still on screen, but the realtime event may already have
  // inserted the very same row (adoption missed it because content, sender or
  // the clock did not line up). Writing it into the temp slot as well would
  // leave two entries with one id — drop the temp instead.
  if (persisted?.id && existing.some((m, i) => i !== index && m.id === persisted.id)) {
    return sortChatMessages(existing.filter((_, i) => i !== index));
  }

  const next = [...existing];
  next[index] = { ...next[index], ...persisted, sending: false, failed: false };
  return sortChatMessages(next);
}

/** Flag a bubble whose insert failed so it can be retried (never lost). */
export function markOptimisticFailed(
  existing: ChatMessageLike[],
  tempId: string,
): ChatMessageLike[] {
  const index = existing.findIndex((m) => m.id === tempId);
  if (index < 0) return existing;
  const next = [...existing];
  next[index] = { ...next[index], failed: true, sending: false };
  return next;
}

export function markOptimisticSending(
  existing: ChatMessageLike[],
  tempId: string,
): ChatMessageLike[] {
  const index = existing.findIndex((m) => m.id === tempId);
  if (index < 0) return existing;
  const next = [...existing];
  next[index] = { ...next[index], failed: false, sending: true };
  return next;
}

/** Merge an older (previously unloaded) page above what we already have. */
export function prependOlderMessages(
  existing: ChatMessageLike[],
  older: ChatMessageLike[],
): ChatMessageLike[] {
  if (!older.length) return existing;

  const byId = new Map<string, ChatMessageLike>();
  existing.filter((m) => !isOptimistic(m)).forEach((m) => byId.set(m.id, m));
  older.forEach((m) => byId.set(m.id, m));

  const optimistic = existing.filter(isOptimistic);
  return sortChatMessages([...byId.values(), ...optimistic]);
}

/** Conversation ids referenced by a message list (for realtime filters). */
export function conversationIdsOf(
  messages: ChatMessageLike[],
  fallback?: string | null,
): string[] {
  const ids = new Set<string>();
  if (fallback) ids.add(fallback);
  messages.forEach((m) => {
    if (m.conversationId) ids.add(String(m.conversationId));
  });
  return Array.from(ids);
}

/** Stable, reference-stable key so effects do not resubscribe on every message. */
export function conversationKey(ids: string[]): string {
  return [...new Set(ids)].sort().join("|");
}
