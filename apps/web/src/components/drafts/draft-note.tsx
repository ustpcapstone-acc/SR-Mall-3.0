"use client";

import { useState } from "react";
import { cn } from "@cloudflare/kumo";
import type { Draft } from "@/lib/drafts/use-draft";

const LINK = "cursor-pointer font-semibold underline-offset-2 hover:underline";

const when = (at: number) =>
  new Date(at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The line under a form that says what happened to the user's draft. */
export function DraftNote({ draft, className }: { draft: Draft; className?: string }) {
  const [asking, setAsking] = useState(false);

  if (draft.broken) {
    return (
      <p role="status" className={cn("text-sm text-kumo-warning", className)}>
        This browser couldn&apos;t save a draft. Keep this page open until you submit.
      </p>
    );
  }

  if (draft.conflictAt) {
    return (
      <div role="status" className={cn("rounded-lg bg-kumo-warning-tint p-3 text-sm text-kumo-default", className)}>
        <p>You have an unsaved draft from {when(draft.conflictAt)}, but this was changed after it. Which do you want?</p>
        <p className="mt-2 flex flex-wrap gap-4">
          <button type="button" className={cn(LINK, "text-primary")} onClick={draft.applyConflict}>
            Restore my draft
          </button>
          <button type="button" className={cn(LINK, "text-kumo-default")} onClick={draft.discard}>
            Keep the saved version
          </button>
        </p>
      </div>
    );
  }

  if (draft.status === "idle") return null;

  const text = !draft.online
    ? "Offline – Draft saved locally"
    : draft.status === "saving"
      ? "Saving..."
      : draft.backOnline
        ? "Back online"
        : draft.restoredAt
          ? `Draft restored from ${when(draft.restoredAt)}`
          : "Draft saved";

  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", className)}>
      <span role="status" className={draft.online ? "text-kumo-subtle" : "font-medium text-kumo-warning"}>
        {text}
      </span>
      {asking ? (
        <>
          <span className="text-kumo-default">Discard what you typed?</span>
          <button
            type="button"
            className={cn(LINK, "text-kumo-danger")}
            onClick={() => {
              setAsking(false);
              draft.discard();
            }}
          >
            Yes, discard
          </button>
          <button type="button" className={cn(LINK, "text-kumo-default")} onClick={() => setAsking(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" className={cn(LINK, "text-kumo-subtle")} onClick={() => setAsking(true)}>
          Discard draft
        </button>
      )}
    </p>
  );
}
