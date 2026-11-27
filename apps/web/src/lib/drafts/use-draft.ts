"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { getWorkspacesAction } from "@/app/actions/workspace";
import { fingerprint, readDraft, removeDraft, sanitize, writeDraft, type DraftRecord } from "./store";
import { isOffline, useConnection } from "./online";

const DELAY = 500;

/*
 * Tenant drafts also belong to the shop and unit picked in the Workspace menu.
 * Switching workspace reloads the page, so one read per page load is enough. The
 * last answer is remembered for the moment the connection is already gone.
 */
const workspaces = new Map<string, Promise<string | null>>();

function workspaceOf(userId: string) {
  let found = workspaces.get(userId);
  if (!found) {
    const memo = `sr-draft-workspace:${userId}`;
    found = getWorkspacesAction()
      .then((res) => {
        if (!res.success) throw new Error(res.error);
        const space = res.data.spaces.find((s) => s.id === res.data.current);
        const scope = `${res.data.current}/${space?.shopId ?? "main"}/${space?.unitId ?? "none"}`;
        localStorage.setItem(memo, scope);
        return scope;
      })
      .catch(() => {
        workspaces.delete(userId);
        return localStorage.getItem(memo);
      });
    workspaces.set(userId, found);
  }
  return found;
}

export type DraftOptions<T> = {
  /** Which form this is, e.g. "tenant.complaint". */
  form: string;
  /** What the user has typed. Pass only fields that are safe to keep. */
  value: T;
  /** The untouched form: empty for a new entry, the saved record when editing. */
  initial: T;
  /** Puts a saved draft (or `initial`, after Discard) back into the form. */
  onRestore: (draft: T) => void;
  /** Record, recipient or anything else that separates one draft from another. */
  scope?: (string | number | null | undefined)[];
  /** False while the form is closed or still loading its saved record. */
  enabled?: boolean;
  /** Editing something already saved: ask before restoring over a newer version. */
  editing?: boolean;
  /** Tenant forms: keep a separate draft per shop and unit. */
  workspace?: boolean;
  /** Forms that work signed out. */
  guest?: boolean;
};

export type Draft = ReturnType<typeof useDraft>;

/** Auto-saves a form on this device and brings it back after a reload. */
export function useDraft<T>({
  form,
  value,
  initial,
  onRestore,
  scope = [],
  enabled = true,
  editing = false,
  workspace = false,
  guest = false,
}: DraftOptions<T>) {
  const { user } = useAuth();
  const { online, backOnline } = useConnection();
  const owner = user?.id ?? (guest ? "guest" : null);

  const [space, setSpace] = useState<{ owner: string; scope: string } | null>(null);
  useEffect(() => {
    if (!workspace || !owner || !enabled) return;
    let alive = true;
    void workspaceOf(owner).then((found) => alive && found && setSpace({ owner, scope: found }));
    return () => {
      alive = false;
    };
  }, [workspace, owner, enabled]);

  const spaceKey = !workspace ? "" : space && space.owner === owner ? space.scope : null;
  const key =
    enabled && owner && spaceKey !== null
      ? [owner, form, spaceKey, ...scope.map((part) => String(part ?? ""))].join("|")
      : null;

  const safe = sanitize(value);
  const current = fingerprint(safe);
  const pristine = fingerprint(sanitize(initial));

  // Latest values for callbacks that outlive a render.
  const latest = useRef({ safe, initial, pristine, onRestore });
  latest.current = { safe, initial, pristine, onRestore };

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<DraftRecord | null>(null);
  const [broken, setBroken] = useState(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; write: () => void } | null>(null);
  // After a submit, the form's own reset must not be saved as a new draft.
  const quiet = useRef(false);

  const flush = useCallback(() => {
    const job = pending.current;
    if (!job) return;
    clearTimeout(job.timer);
    pending.current = null;
    job.write();
  }, []);

  const cancel = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);

  // Bring back what was saved before anything new is written.
  useEffect(() => {
    setLoadedKey(null);
    setState("idle");
    setRestoredAt(null);
    setConflict(null);
    quiet.current = false;
    if (!key) return;
    let alive = true;
    readDraft(key)
      .then((record) => {
        if (!alive) return;
        const now = latest.current;
        if (record && fingerprint(record.data) !== now.pristine) {
          if (editing && record.base !== now.pristine) {
            setConflict(record);
          } else {
            now.onRestore({ ...(now.initial as object), ...(record.data as object) } as T);
            setRestoredAt(record.updatedAt);
            setState("saved");
          }
        }
        setLoadedKey(key);
      })
      .catch(() => alive && setBroken(true));
    return () => {
      alive = false;
      flush();
    };
  }, [key, editing, flush]);

  // Save a moment after the last change.
  useEffect(() => {
    if (!key || loadedKey !== key || conflict) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    cancel();
    const untouched = current === latest.current.pristine;
    if (!untouched) setState("saving");
    const record: DraftRecord = { key, data: latest.current.safe, base: latest.current.pristine, updatedAt: Date.now() };
    const write = () => {
      (untouched ? removeDraft(key) : writeDraft(record))
        .then(() => {
          setBroken(false);
          setState(untouched ? "idle" : "saved");
          if (untouched) setRestoredAt(null);
        })
        .catch(() => setBroken(true));
    };
    pending.current = { write, timer: setTimeout(flush, DELAY) };
  }, [key, loadedKey, conflict, current, pristine, cancel, flush]);

  // A closing tab or a reconnect shouldn't wait for the timer.
  useEffect(() => {
    const hidden = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", flush);
    window.addEventListener("offline", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", flush);
      window.removeEventListener("offline", flush);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [flush]);

  /** Call after a successful submit. */
  const clear = useCallback(() => {
    cancel();
    quiet.current = true;
    setState("idle");
    setRestoredAt(null);
    setConflict(null);
    if (key) void removeDraft(key).catch(() => {});
  }, [key, cancel]);

  /** The user threw the draft away: forget it and reset the form. */
  const discard = useCallback(() => {
    clear();
    quiet.current = false;
    latest.current.onRestore(latest.current.initial);
  }, [clear]);

  /** Apply a draft that was held back because the saved record changed. */
  const applyConflict = useCallback(() => {
    if (!conflict) return;
    const now = latest.current;
    now.onRestore({ ...(now.initial as object), ...(conflict.data as object) } as T);
    setRestoredAt(conflict.updatedAt);
    setConflict(null);
    setState("saved");
  }, [conflict]);

  const sending = useRef(false);
  /**
   * Run a submit. Does nothing while offline (the draft stays) or while the same
   * form is already being sent. Returns null when nothing was sent or the
   * connection dropped; other errors are thrown as before.
   */
  const send = useCallback(
    async <R,>(action: () => Promise<R>): Promise<R | null> => {
      if (isOffline()) {
        flush();
        toast.error("You're offline. Your draft is saved on this device. Submit it when you're back online.");
        return null;
      }
      if (sending.current) return null;
      sending.current = true;
      try {
        return await action();
      } catch (error) {
        const lost = isOffline() || /failed to fetch|fetch failed|network|load failed/i.test(String((error as Error)?.message));
        if (!lost) throw error;
        flush();
        toast.error("The connection dropped while sending. Your draft is kept. Check whether it arrived before sending again.");
        return null;
      } finally {
        sending.current = false;
      }
    },
    [flush],
  );

  return useMemo(
    () => ({
      status: state,
      online,
      backOnline,
      broken,
      restoredAt,
      conflictAt: conflict?.updatedAt ?? null,
      clear,
      discard,
      applyConflict,
      send,
      flush,
    }),
    [state, online, backOnline, broken, restoredAt, conflict, clear, discard, applyConflict, send, flush],
  );
}
