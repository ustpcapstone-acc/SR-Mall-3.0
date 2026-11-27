"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Ban, Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatDayLabel } from "@/lib/chat-time";

/**
 * Whether `meId` has blocked `otherId` from messaging them, plus a setter.
 * Backed by the BlockedChatUser table (sendMessage/replyToConversation
 * reject messages from a blocked sender).
 */
export function useChatBlock(meId?: string | null, otherId?: string | null) {
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBlockedByMe(false);
    if (!meId || !otherId) return;
    import("@/app/actions/chat-queries")
      .then(({ checkBlockStatusAction }) => checkBlockStatusAction(meId, otherId))
      .then((blocked) => !cancelled && setBlockedByMe(Boolean(blocked)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meId, otherId]);

  const setBlocked = useCallback(
    async (next: boolean) => {
      if (!meId || !otherId) return false;
      setBusy(true);
      try {
        const { toggleBlockUserAction } = await import("@/app/actions/chat-queries");
        const res: any = await toggleBlockUserAction(meId, otherId, next);
        if (res?.success) {
          setBlockedByMe(next);
          toast.success(next ? "User blocked" : "User unblocked");
          return true;
        }
        toast.error(res?.error || "Couldn't update block status");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [meId, otherId],
  );

  return { blockedByMe, setBlocked, busy };
}

/** Header button: Block / Unblock. */
export function BlockToggleButton({
  blocked,
  onClick,
}: {
  blocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-kumo-line px-3 text-sm font-medium hover:bg-kumo-tint",
        blocked ? "text-kumo-default" : "text-kumo-danger",
      )}
    >
      {blocked ? <ShieldCheck size={14} /> : <Ban size={14} />}
      {blocked ? "Unblock" : "Block"}
    </button>
  );
}

/** Banner above the composer while a conversation is blocked. */
export function BlockedBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-kumo-line bg-kumo-danger-tint px-4 py-2.5 text-sm font-medium text-kumo-danger">
      <Ban size={14} className="shrink-0" /> {text}
    </div>
  );
}

/** "Today" / "Yesterday" / "Monday, Sep 28" divider between message days. */
export function ChatDaySeparator({ date }: { date: string | Date }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator">
      <span className="h-px flex-1 bg-kumo-line" />
      <span className="text-xs font-medium text-kumo-subtle">
        {formatDayLabel(date)}
      </span>
      <span className="h-px flex-1 bg-kumo-line" />
    </div>
  );
}

/** Small hover button on your own bubbles. */
export function UnsendButton({ onClick, align = "left" }: { onClick: () => void; align?: "left" | "right" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Unsend message"
      aria-label="Unsend message"
      className={clsx(
        "self-center shrink-0 cursor-pointer rounded-lg p-2.5 text-kumo-subtle opacity-0 transition-opacity hover:bg-kumo-danger-tint hover:text-kumo-danger focus:opacity-100 group-hover/msg:opacity-100 [@media(hover:none)]:opacity-100",
        align === "right" ? "order-last" : "order-first",
      )}
    >
      <Undo2 size={14} />
    </button>
  );
}

/** Shared confirmation dialog (unsend, block) for the chat screens. */
export function ChatConfirmModal({
  title,
  message,
  confirmLabel,
  tone = "danger",
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "neutral";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => !busy && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-fade-in-up relative w-full max-w-sm space-y-5 rounded-xl border border-kumo-line bg-kumo-base p-6 shadow-2xl"
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-kumo-default">{title}</h2>
          <p className="text-sm text-kumo-subtle">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 cursor-pointer rounded-lg border border-kumo-line px-4 text-sm font-medium text-kumo-default hover:bg-kumo-tint disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={clsx(
              "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-70",
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-hover",
            )}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
