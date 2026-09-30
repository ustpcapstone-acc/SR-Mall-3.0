"use client";

import { useState } from "react";
import clsx from "clsx";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "@/app/providers";
import { ChatBox } from "@/components/chat-box";
import { useChatUnread } from "@/lib/chat-unread";

/**
 * Floating chat button for public pages, with the live unread count on it
 * (same source as the bell). Opens the chat box on its list of chats.
 *
 * Pages that open their own chat box (e.g. "Chat with this shop") pass
 * `hidden` while it is open so two boxes never stack.
 */
export function ChatLauncher({ hidden = false, className }: { hidden?: boolean; className?: string }) {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const unread = useChatUnread(user?.id).total;

  if (hidden) return null;

  return (
    <>
      <button
        suppressHydrationWarning
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close messages" : unread > 0 ? `Messages, ${unread} unread` : "Messages"}
        className={clsx(
          "fixed right-4 sm:right-10 w-14 h-14 sm:w-16 sm:h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all z-50",
          className ?? "bottom-4 sm:bottom-10",
        )}
      >
        {isOpen ? <X size={26} /> : <MessageCircle size={26} />}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.5rem] h-6 px-1.5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white dark:border-black animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <ChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} isAuthenticated={isAuthenticated} initialRecipient={null} />
    </>
  );
}
