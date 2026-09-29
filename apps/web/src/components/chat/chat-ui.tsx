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
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors",
        blocked
          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white"
          : "text-slate-400 hover:text-red-600 hover:bg-red-500/10",
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
    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
      <Ban size={14} className="shrink-0" /> {text}
    </div>
  );
}

/** "Today" / "Yesterday" / "Monday, Sep 28" divider between message days. */
export function ChatDaySeparator({ date }: { date: string | Date }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator">
      <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {formatDayLabel(date)}
      </span>
      <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
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
        "self-center p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover/msg:opacity-100 focus:opacity-100 transition-opacity",
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl p-7 space-y-5 animate-fade-in-up"
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-black uppercase tracking-tight italic text-charcoal dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={clsx(
              "flex-1 py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 disabled:opacity-70",
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-charcoal hover:bg-black",
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
