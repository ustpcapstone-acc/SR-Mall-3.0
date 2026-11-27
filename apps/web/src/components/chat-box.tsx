"use client";

import { optimizedImage } from "@/lib/media";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button, Input, Loader } from "@cloudflare/kumo";
import { ArrowLeft, Buildings, ChatCircle, MapPin, PaperPlaneRight, Paperclip, X } from "@phosphor-icons/react";
import { useAuth } from "@/app/providers";
import { ChatAvatar, ChatImage, bubblePadding } from "@/components/chat/chat-media";
import { LoginModal } from "./login-modal";
import { markMessageNotificationsAsReadAction } from "@/app/actions/notification";
import { refreshChatUnread, setViewingChats } from "@/lib/chat-unread";
import { loadStorefronts } from "@/lib/shared-request";
import {
  subscribeToConversation,
  subscribeToInbox,
  type ChatRealtimeStatus,
} from "@/lib/chat-realtime";
import {
  MESSAGE_PAGE_SIZE,
  applyRealtimeDelete,
  applyRealtimeMessage,
  conversationIdsOf,
  conversationKey,
  isOptimistic,
  markOptimisticFailed,
  markOptimisticSending,
  mergeFetchedMessages,
  normalizeMessages,
  prependOlderMessages,
  replaceOptimistic,
} from "@/lib/chat-messages";
import { formatMessageTime, startsNewDay } from "@/lib/chat-time";
import { ChatConfirmModal, ChatDaySeparator, UnsendButton } from "@/components/chat/chat-ui";
import { toast } from "sonner";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { isOffline } from "@/lib/drafts/online";
import { timeAgo } from "@/components/notifications/notification-ui";
import type { MyChatRow } from "@/app/actions/chat-queries";

interface ChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  initialRecipient?: "admin" | "shop" | null;
  initialShopName?: string | null;
  inquirySlotId?: string | null;
  initialMessage?: string | null;
}

/** A shop in the public chat; `id` (tenant id) identifies it exactly. */
type ChatShop = { id?: string; name: string; logo: string | null };

/** Shop logo, falling back to initials when there is none or it fails to load. */
function ShopAvatar({ name, logo, className = "size-11" }: { name: string; logo: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  return (
    <div className={`${className} rounded-full overflow-hidden bg-kumo-recessed text-kumo-default flex items-center justify-center font-semibold text-sm border border-kumo-line shrink-0`}>
      {logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizedImage(logo, 96)} alt="" onError={() => setBroken(true)} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function AdminAvatar({ className = "size-11" }: { className?: string }) {
  return (
    <div className={`${className} rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0`}>
      <Buildings size={20} aria-hidden />
    </div>
  );
}

export const ChatBox = ({
  isOpen,
  onClose,
  isAuthenticated,
  initialRecipient,
  initialShopName,
  inquirySlotId,
  initialMessage,
}: ChatBoxProps) => {
  const { user } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [recipient, setRecipient] = useState<"admin" | "shop">(
    initialRecipient || "shop",
  );
  const [availableShops, setAvailableShops] = useState<ChatShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<ChatShop>({
    name: initialShopName || "",
    logo: null,
  });
  /** Recent chats for the list view (last message, time, unread). */
  const [chatList, setChatList] = useState<MyChatRow[]>([]);
  /** The open thread's first page has arrived (drives the loading spinner). */
  const [threadLoaded, setThreadLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "chat">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  /** Short send cooldown so double-taps cannot post the same inquiry twice. */
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const sendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [unsendTarget, setUnsendTarget] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  /** Files of still-sending bubbles, so a failed image send can be retried. */
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const loadingOlderRef = useRef(false);

  // Real DB Messages state
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [isRecipientBlocking, setIsRecipientBlocking] = useState(false);
  // Realtime subscription + pagination state
  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] =
    useState<ChatRealtimeStatus>("connecting");
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  // Fetch true shops from DB
  useEffect(() => {
    async function fetchShops() {
      const res = await loadStorefronts();
      if (res.success && res.data) {
        const shops: ChatShop[] = res.data.map((s: any) => ({
          id: s.id,
          name: (s.shop_name || "").trim(),
          logo: s.logo_url,
        }));
        setAvailableShops(shops);

        if (initialShopName) {
          const match = shops.find(
            (s) => s.name.toLowerCase() === initialShopName.trim().toLowerCase(),
          );
          setSelectedShop(match || { name: initialShopName.trim(), logo: null });
        } else if (shops.length > 0) {
          setSelectedShop((prev) => {
            if (!prev || !prev.name) {
              return shops[0];
            }
            const match = shops.find(
              (s) => s.name.toLowerCase() === prev.name.trim().toLowerCase(),
            );
            return match || prev;
          });
        }
      }
    }
    fetchShops();
  }, [initialShopName]);

  // Effect to handle prop changes and opening from notifications
  useEffect(() => {
    if (isOpen) {
      if (initialRecipient === "admin") {
        setRecipient("admin");
        setViewMode("chat");
        setDbMessages([]);
      } else if (initialShopName) {
        setRecipient("shop");
        const match = availableShops.find(
          (s) => s.name.toLowerCase() === initialShopName.trim().toLowerCase(),
        );
        setSelectedShop(match || { name: initialShopName.trim(), logo: null });
        setViewMode("chat");
        setDbMessages([]);
      } else if (initialRecipient === "shop") {
        setRecipient("shop");
        setViewMode("chat");
        setDbMessages([]);
      } else {
        setViewMode("list");
      }
    } else {
      setViewMode("list");
    }
  }, [isOpen, initialRecipient, initialShopName, availableShops]);

  // Listen directly to open-mall-chat events so chat focuses the conversation immediately
  useEffect(() => {
    const handleOpenChatEvent = (e: any) => {
      const targetRecipient = e.detail?.recipient as "admin" | "shop" | null;
      const targetShop = e.detail?.shop as string | null;

      if (targetRecipient === "admin") {
        setRecipient("admin");
        setViewMode("chat");
        setDbMessages([]);
      } else if (targetRecipient === "shop" || targetShop) {
        setRecipient("shop");
        if (targetShop) {
          const match = availableShops.find(
            (s) => s.name.toLowerCase() === targetShop.trim().toLowerCase(),
          );
          setSelectedShop(match || { name: targetShop.trim(), logo: null });
        }
        setViewMode("chat");
        setDbMessages([]);
      } else {
        setViewMode("list");
      }
    };

    window.addEventListener("open-mall-chat", handleOpenChatEvent);
    return () =>
      window.removeEventListener("open-mall-chat", handleOpenChatEvent);
  }, [availableShops]);

  useEffect(() => {
    if (initialMessage && isOpen) {
      setInputText(initialMessage);
    }
  }, [initialMessage, isOpen]);

  // One unfinished message per conversation. Text that failed to send stays in
  // the draft until it goes through.
  const thread = recipient === "admin" ? "admin" : `shop:${selectedShop.name.trim().toLowerCase()}`;
  const [unsent, setUnsent] = useState<{ thread: string; tempId: string; text: string } | null>(null);
  const lastThread = useRef(thread);
  useEffect(() => {
    if (lastThread.current === thread) return;
    lastThread.current = thread;
    setInputText((text) => (text === initialMessage ? text : ""));
  }, [thread, initialMessage]);
  const draft = useDraft({
    form: "customer.chat",
    scope: [recipient === "admin" ? "admin" : selectedShop.id || thread],
    enabled: isOpen && viewMode === "chat" && (recipient === "admin" || availableShops.length > 0),
    value: { text: inputText || (unsent?.thread === thread ? unsent.text : "") },
    initial: { text: "" },
    onRestore: (saved) => {
      setUnsent(null);
      // A message the page just filled in (e.g. a claim request) wins.
      setInputText((text) => (saved.text && text === initialMessage ? text : saved.text));
    },
  });

  // Countdown for the 3-second send lock.
  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeft(0);
      return;
    }
    const tick = () =>
      setCooldownLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isNearBottomRef.current = isAtBottom;

    // Scrolled to the top → ask for the previous page (once, guarded).
    if (!isAtBottom && el.scrollTop < 80) {
      void fetchOlderMessages();
    }
  };

  // Latest page: initial load, refresh after send, and fallback while realtime
  // is unavailable. Never loads more than one page.
  const fetchMessages = useCallback(async () => {
    if (!isOpen || !user?.email || viewMode !== "chat") return;
    if (recipient === "shop" && !selectedShop?.name?.trim()) return;

    try {
      const { getConversationHistory } = await import("@/app/actions/chat-queries");
      const history = await getConversationHistory(
        user.email,
        recipient,
        selectedShop.name?.trim(),
        { limit: MESSAGE_PAGE_SIZE },
        recipient === "shop" ? selectedShop.id : undefined,
      );

      setDbMessages((prev) => mergeFetchedMessages(prev, history));
      setHasOlderMessages(history.length >= MESSAGE_PAGE_SIZE);
      setThreadLoaded(true);

      // Remember which conversations are on screen (reference-stable unless
      // the actual set changes, so realtime does not resubscribe per message).
      const ids = conversationIdsOf(history);
      setConversationIds((prev) =>
        conversationKey(prev) === conversationKey(ids) ? prev : ids,
      );

      if (isNearBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setThreadLoaded(true);
    }
  }, [isOpen, user?.email, recipient, selectedShop.name, selectedShop.id, viewMode]);

  // Older page, requested only when the user scrolls to the top.
  const fetchOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlderMessages) return;
    if (!isOpen || !user?.email || viewMode !== "chat") return;
    if (recipient === "shop" && !selectedShop?.name?.trim()) return;

    const oldest = dbMessages.find((m) => !isOptimistic(m));
    if (!oldest) return;

    loadingOlderRef.current = true;
    try {
      const { getConversationHistory } = await import("@/app/actions/chat-queries");
      const history = await getConversationHistory(
        user.email,
        recipient,
        selectedShop.name?.trim(),
        {
          limit: MESSAGE_PAGE_SIZE,
          before: new Date(oldest.createdAt).toISOString(),
          beforeId: String(oldest.id),
        },
        recipient === "shop" ? selectedShop.id : undefined,
      );

      if (history.length < MESSAGE_PAGE_SIZE) setHasOlderMessages(false);

      const container = messagesContainerRef.current;
      const previousHeight = container?.scrollHeight ?? 0;
      setDbMessages((prev) => prependOlderMessages(prev, history));
      if (container) {
        // Keep the reading position pinned while older messages go in above.
        requestAnimationFrame(() => {
          container.scrollTop += container.scrollHeight - previousHeight;
        });
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      loadingOlderRef.current = false;
    }
  }, [
    dbMessages,
    hasOlderMessages,
    isOpen,
    user?.email,
    recipient,
    selectedShop.name,
    viewMode,
  ]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Switching channel/conversation → clear the previous thread and its
  // subscription state so nothing bleeds across conversations.
  useEffect(() => {
    setDbMessages([]);
    setConversationIds([]);
    setHasOlderMessages(true);
    setRealtimeStatus("connecting");
    setThreadLoaded(false);
  }, [isOpen, recipient, selectedShop.name]);

  // Recent chats for the list: on open, whenever a message arrives, and on return from a thread.
  const loadChatList = useCallback(async () => {
    if (!user?.id) return;
    const { getMyChatListAction } = await import("@/app/actions/chat-queries");
    setChatList(await getMyChatListAction(user.id));
  }, [user?.id]);
  useEffect(() => {
    if (!isOpen || viewMode !== "list" || !isAuthenticated) return;
    void loadChatList();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToInbox(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadChatList(), 500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [isOpen, viewMode, isAuthenticated, loadChatList]);

  // Esc closes the chat box (not while another window is open over it).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxImageUrl && !unsendTarget && !isLoginModalOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, lightboxImageUrl, unsendTarget, isLoginModalOpen, onClose]);

  // Supabase Realtime: exactly one channel per conversation, removed when the
  // conversation changes or the widget unmounts.
  useEffect(() => {
    if (!isOpen || viewMode !== "chat" || conversationIds.length === 0) return;

    const unsubscribe = subscribeToConversation(conversationIds, {
      onMessage: (row) => {
        setDbMessages((prev) => applyRealtimeMessage(prev, row));
        if (isNearBottomRef.current) requestAnimationFrame(scrollToBottom);
      },
      onDelete: (messageId) => {
        setDbMessages((prev) => applyRealtimeDelete(prev, messageId));
      },
      onStatus: setRealtimeStatus,
    });

    return unsubscribe;
  }, [isOpen, viewMode, conversationIds]);

  // No conversation yet (nothing to subscribe to): watch the inbox so a
  // first message from the other side shows up without waiting for the poll.
  useEffect(() => {
    if (!isOpen || viewMode !== "chat" || conversationIds.length > 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToInbox(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void fetchMessages(), 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [isOpen, viewMode, conversationIds.length, fetchMessages]);

  // Fallback only: polls while realtime is not connected (never when it is).
  useEffect(() => {
    if (!isOpen || viewMode !== "chat") return;
    if (realtimeStatus === "subscribed") return;

    const interval = setInterval(() => {
      void fetchMessages();
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, viewMode, realtimeStatus, fetchMessages]);

  useEffect(() => {
    if (isOpen && user?.id) {
      markMessageNotificationsAsReadAction(user.id);
    }
  }, [isOpen, user?.id]);

  // The open thread counts as read, including messages that arrive while open.
  const lastMessageId = dbMessages[dbMessages.length - 1]?.id;
  useEffect(() => {
    if (!isOpen || viewMode !== "chat" || !user?.id || conversationIds.length === 0) return;
    void import("@/app/actions/chat-queries")
      .then(({ markConversationReadAction }) => markConversationReadAction(user.id, conversationIds))
      .then(() => refreshChatUnread());
  }, [isOpen, viewMode, user?.id, conversationIds, lastMessageId]);

  // The thread on screen doesn't count as unread and doesn't pop a toast.
  const viewingKey = isOpen && viewMode === "chat" ? conversationIds.join("|") : "";
  useEffect(() => {
    if (!viewingKey) return;
    return setViewingChats(viewingKey.split("|"));
  }, [viewingKey]);

  const [isUnsending, setIsUnsending] = useState(false);
  const confirmUnsend = async () => {
    if (!unsendTarget || !user?.id) return;
    setIsUnsending(true);
    try {
      const { deleteMessageAction } = await import("@/app/actions/chat-queries");
      const res = await deleteMessageAction(unsendTarget.id, user.id);
      if (res.success) {
        setDbMessages((prev) => applyRealtimeDelete(prev, unsendTarget.id));
        setUnsendTarget(null);
      } else {
        toast.error(res.error || "Couldn't unsend the message");
      }
    } finally {
      setIsUnsending(false);
    }
  };

  // Check if active recipient has blocked messaging for this user
  useEffect(() => {
    async function checkBlock() {
      if (!user?.id || viewMode !== "chat") {
        setIsRecipientBlocking(false);
        return;
      }
      try {
        const { checkBlockStatusAction, getPortalAdminAction } = await import(
          "@/app/actions/chat-queries"
        );
        let targetId: string | null = null;
        if (recipient === "admin") {
          const admin = await getPortalAdminAction();
          targetId = admin?.id || null;
        }
        if (targetId) {
          const blocked = await checkBlockStatusAction(targetId, user.id);
          setIsRecipientBlocking(blocked);
        } else if (recipient === "shop" && selectedShop.id) {
          const { isBlockedByShopAction } = await import("@/app/actions/chat-queries");
          setIsRecipientBlocking(await isBlockedByShopAction(selectedShop.id, user.id));
        } else {
          setIsRecipientBlocking(false);
        }
      } catch (err) {
        setIsRecipientBlocking(false);
      }
    }
    checkBlock();
  }, [user?.id, viewMode, recipient, selectedShop.id]);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      const { uploadImageServerAction } = await import("@/app/actions/upload");
      const formData = new FormData();
      // Shrunk first: the action accepts 1 MB and phone photos are larger.
      const { shrinkImage } = await import("@/lib/shrink-image");
      formData.append("file", await shrinkImage(file));
      return await uploadImageServerAction(formData);
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return null;
    }
  };

  // Persist an optimistic bubble. Never throws: a failure flips the bubble to
  // "failed" so the message stays visible and can be retried.
  const persistMessage = async (payload: {
    tempId: string;
    content: string;
    file?: File | null;
    preview?: string | null;
    slotId?: string;
  }) => {
    if (!user?.email) return;

    setIsUploading(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (payload.file) {
        uploadedImageUrl = await uploadImageToCloudinary(payload.file);
        if (!uploadedImageUrl) throw new Error("Image upload failed");
      } else if (payload.preview && /^https?:\/\//i.test(payload.preview)) {
        // Retry of a message whose image already reached the CDN.
        uploadedImageUrl = payload.preview;
      }

      const { sendMessage } = await import("@/app/actions/chat");
      const res: any = await sendMessage({
        userId: user.email,
        recipientType: recipient,
        content: payload.content,
        imageUrl: uploadedImageUrl || undefined,
        shopName: selectedShop.name,
        tenantId: recipient === "shop" ? selectedShop.id : undefined,
        slotId: payload.slotId,
      });

      if (res && !res.success && res.error) {
        toast.error(res.error);
        setDbMessages((prev) => markOptimisticFailed(prev, payload.tempId));
        return;
      }

      pendingFilesRef.current.delete(payload.tempId);
      setUnsent((current) => (current?.tempId === payload.tempId ? null : current));
      if (res?.message) {
        // Swap temp-… for the real row (same id the realtime event carries).
        setDbMessages((prev) =>
          replaceOptimistic(prev, payload.tempId, res.message),
        );
      }
      if (res?.conversationId) {
        // Brand-new conversation: subscribe right away.
        setConversationIds((prev) =>
          prev.includes(res.conversationId)
            ? prev
            : [...prev, res.conversationId],
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setDbMessages((prev) => markOptimisticFailed(prev, payload.tempId));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e: React.SyntheticEvent, slotId?: string) => {
    e.preventDefault();

    // A double-tap used to post the same inquiry twice. The ref blocks the
    // second click while the first request is still in flight, and the
    // cooldown keeps repeated taps from spamming the thread.
    if (sendingRef.current) return;

    const waitSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (waitSeconds > 0) {
      toast.error(`Please wait ${waitSeconds}s before sending another message.`);
      return;
    }

    let textToSend = inputText;
    const fileToSend = imageFile;
    const previewToSend = imagePreview;

    if (typeof slotId === "string" && slotId) {
      textToSend = inputText.trim()
        ? `${inputText} (Regarding Unit ${slotId})`
        : `Hello, I would like to inquire about leasing Unit ${slotId}.`;
    }

    if (isRecipientBlocking) {
      toast.error("This recipient is currently not accepting messages from you.");
      return;
    }

    if (!textToSend.trim() && !fileToSend) return;
    if (!user?.email) return;

    if (isOffline()) {
      draft.flush();
      toast.error("You're offline. Your message is kept here. Send it when you're back online.");
      return;
    }

    sendingRef.current = true;
    setCooldownUntil(Date.now() + 3000);

    // Reset input immediately
    setInputText("");
    setImageFile(null);
    setImagePreview(null);

    try {
      // Instant optimistic update with local preview
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const contentToSend = textToSend || "📎 Image";
      setUnsent({ thread, tempId, text: inputText });

      setDbMessages((prev) =>
        normalizeMessages([
          ...prev,
          {
            id: tempId,
            content: contentToSend,
            imageUrl: previewToSend,
            senderId: user.id,
            sender: { email: user.email, name: user.name, avatarUrl: user.avatarUrl },
            createdAt: new Date(),
            sending: true,
          },
        ]),
      );

      isNearBottomRef.current = true;
      requestAnimationFrame(scrollToBottom);

      if (fileToSend) pendingFilesRef.current.set(tempId, fileToSend);

      await persistMessage({
        tempId,
        content: contentToSend,
        file: fileToSend,
        preview: previewToSend,
        slotId,
      });
    } finally {
      sendingRef.current = false;
    }
  };

  // Retry a failed bubble, its text and image are preserved.
  const retryMessage = (message: any) => {
    if (!message?.id || message.sending) return;
    const file = pendingFilesRef.current.get(message.id) ?? null;
    setDbMessages((prev) => markOptimisticSending(prev, message.id));
    void persistMessage({
      tempId: message.id,
      content: message.content,
      file,
      preview: message.imageUrl ?? null,
    });
  };



  const isUserBlocked = !!(user as any)?.isBlacklisted;
  const blocked = isUserBlocked || isRecipientBlocking;
  const threadName = recipient === "admin" ? "Mall Administration" : selectedShop.name;
  const ROW = "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left hover:bg-kumo-tint";

  const signInPrompt = (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ChatCircle size={28} aria-hidden />
      </span>
      <p className="text-base font-semibold text-kumo-default">Sign in to chat</p>
      <p className="max-w-60 text-sm text-kumo-subtle">Sign in to message the mall office and the shops.</p>
      <Button variant="primary" size="lg" onClick={() => setIsLoginModalOpen(true)}>
        Sign In
      </Button>
    </div>
  );

  return (
    <>
      {/* The height is capped to the window so the close button always stays on screen. */}
      <div
        role="dialog"
        aria-label="Messages"
        className="animate-slide-up fixed inset-x-0 bottom-0 z-100 flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-kumo-base shadow-2xl sm:inset-auto sm:bottom-32 sm:right-10 sm:h-[min(600px,calc(100dvh-9rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-kumo-line"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-kumo-line bg-kumo-base px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {viewMode === "chat" && (
              <Button variant="ghost" shape="square" icon={<ArrowLeft />} aria-label="Back to chats" onClick={() => setViewMode("list")} />
            )}
            {viewMode === "chat" ? (
              recipient === "admin" ? (
                <AdminAvatar className="size-10" />
              ) : (
                <ShopAvatar name={selectedShop.name || "?"} logo={selectedShop.logo} className="size-10" />
              )
            ) : null}
            <div className={`min-w-0 ${viewMode === "list" ? "pl-1" : ""}`}>
              <h3 className="truncate font-display text-lg font-semibold leading-tight text-kumo-default">
                {viewMode === "chat" ? threadName : "Messages"}
              </h3>
              <p className="truncate text-sm text-kumo-subtle">
                {viewMode === "chat"
                  ? recipient === "admin"
                    ? "Replies within 12 to 24 hours"
                    : "Shop chat"
                  : isUserBlocked
                    ? "Account suspended"
                    : isAuthenticated
                      ? `Signed in as ${user?.name || user?.email || "you"}`
                      : "SR Mall"}
              </p>
            </div>
          </div>
          <Button variant="ghost" shape="square" icon={<X />} aria-label="Close chat" title="Close (Esc)" onClick={onClose} />
        </div>

        {viewMode === "list" ? (
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-kumo-recessed">
            {isAuthenticated ? (
              (() => {
                const q = searchQuery.trim().toLowerCase();
                const recentKeys = new Set(chatList.map((c) => c.key));
                const recent = chatList.filter((c) => !q || c.name.toLowerCase().includes(q));
                const adminMatches = !q || "mall administration admin booking support help space".includes(q);
                const showAdminStarter = !recentKeys.has("admin") && adminMatches;
                const otherShops = availableShops
                  .filter((s) => !(s.id && recentKeys.has(s.id)))
                  .filter((s) => !q || s.name.toLowerCase().includes(q))
                  .sort((a, b) => a.name.localeCompare(b.name));
                const openRow = (row: MyChatRow) => {
                  if (row.kind === "admin") {
                    setRecipient("admin");
                  } else {
                    setRecipient("shop");
                    const match = availableShops.find((s) => s.id === row.key);
                    setSelectedShop(match || { id: row.key, name: row.name, logo: row.logo });
                  }
                  setViewMode("chat");
                };
                return (
                  <div className="space-y-5 p-3 sm:p-4">
                    <Input
                      suppressHydrationWarning
                      type="search"
                      aria-label="Search shops or the mall office"
                      placeholder="Search shops or the mall office"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />

                    {/* Recent chats (Mall Administration is always offered first) */}
                    {(recent.length > 0 || showAdminStarter) && (
                      <section className="space-y-2">
                        <h4 className="px-1 text-sm font-semibold text-kumo-default">Recent chats</h4>
                        {showAdminStarter && (
                          <button
                            type="button"
                            onClick={() => {
                              setRecipient("admin");
                              setViewMode("chat");
                            }}
                            className={`${ROW} border-kumo-line bg-kumo-base`}
                          >
                            <AdminAvatar />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-kumo-default">Mall Administration</span>
                              <span className="block truncate text-sm text-kumo-subtle">Bookings, spaces and help</span>
                            </span>
                          </button>
                        )}
                        {recent.map((row) => {
                          const unread = row.unread > 0;
                          return (
                            <button
                              key={row.key}
                              type="button"
                              onClick={() => openRow(row)}
                              className={`${ROW} ${unread ? "border-primary/40 bg-kumo-base" : "border-kumo-line bg-kumo-base"}`}
                            >
                              {row.kind === "admin" ? <AdminAvatar /> : <ShopAvatar name={row.name} logo={row.logo} />}
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className={`truncate text-sm text-kumo-default ${unread ? "font-semibold" : "font-medium"}`}>
                                    {row.name}
                                  </span>
                                  <span className={`shrink-0 text-xs ${unread ? "font-semibold text-primary" : "text-kumo-subtle"}`}>
                                    {timeAgo(row.lastAt)}
                                  </span>
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                  <span className={`truncate text-sm ${unread ? "font-medium text-kumo-default" : "text-kumo-subtle"}`}>
                                    {row.fromMe ? "You: " : ""}
                                    {row.lastMessage || "Photo"}
                                  </span>
                                  {unread && (
                                    <span
                                      aria-label={`${row.unread} unread`}
                                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
                                    >
                                      {row.unread > 9 ? "9+" : row.unread}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </section>
                    )}

                    {/* Everyone else you can message */}
                    {otherShops.length > 0 && (
                      <section className="space-y-2">
                        <h4 className="px-1 text-sm font-semibold text-kumo-default">All shops</h4>
                        {otherShops.map((shop) => (
                          <button
                            key={shop.id || shop.name}
                            type="button"
                            onClick={() => {
                              setRecipient("shop");
                              setSelectedShop(shop);
                              setViewMode("chat");
                            }}
                            className={`${ROW} border-kumo-line bg-kumo-base`}
                          >
                            <ShopAvatar name={shop.name} logo={shop.logo} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-kumo-default">{shop.name}</span>
                              <span className="block text-sm text-kumo-subtle">Start a conversation</span>
                            </span>
                          </button>
                        ))}
                      </section>
                    )}

                    {recent.length === 0 && !showAdminStarter && otherShops.length === 0 && (
                      <p className="py-10 text-center text-sm text-kumo-subtle">No shops match “{searchQuery}”.</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex min-h-full flex-col justify-center">{signInPrompt}</div>
            )}
          </div>
        ) : (
          <>
            {/* Blocked User Notice */}
            {blocked && (
              <p className="shrink-0 border-b border-kumo-line bg-kumo-danger-tint px-4 py-2.5 text-sm font-medium text-kumo-danger">
                {isUserBlocked
                  ? "Your account is suspended. Messaging is disabled."
                  : "This recipient is currently not accepting incoming messages from you."}
              </p>
            )}

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-kumo-recessed p-3 sm:p-4"
            >
              {!isAuthenticated ? (
                <div className="flex h-full flex-col justify-center">{signInPrompt}</div>
              ) : !threadLoaded && dbMessages.length === 0 ? (
                <div className="flex justify-center py-16">
                  <Loader />
                </div>
              ) : dbMessages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  {recipient === "admin" ? (
                    <AdminAvatar className="size-16" />
                  ) : (
                    <ShopAvatar name={selectedShop.name || "?"} logo={selectedShop.logo} className="size-16" />
                  )}
                  <p className="text-sm font-semibold text-kumo-default">Say hello to {threadName}</p>
                  <p className="max-w-60 text-sm text-kumo-subtle">
                    {recipient === "admin"
                      ? "Ask about space bookings, events, lost and found or anything about the mall."
                      : "Ask about products, prices, stock or opening hours."}
                  </p>
                </div>
              ) : null}

              {dbMessages.map((msg: any, index: number) => {
                const isUserSender =
                  (user?.id && msg.senderId === user.id) ||
                  (user?.email && msg.sender?.email?.toLowerCase() === user.email.toLowerCase());
                // Shop chats show the shop's logo and name (as in the header),
                // not the owner's personal account.
                const isShopChat = recipient !== "admin" && Boolean(selectedShop?.name);
                const senderAvatar = isUserSender
                  ? user?.avatarUrl
                  : isShopChat
                    ? selectedShop.logo || msg.sender?.avatarUrl
                    : msg.sender?.avatarUrl;
                const senderName = isUserSender
                  ? user?.name
                  : isShopChat
                    ? selectedShop.name
                    : msg.sender?.name || msg.sender?.email || "SR Mall Admin";
                const isTemporary = String(msg.id).startsWith("temp-");

                return (
                  <React.Fragment key={msg.id}>
                    {startsNewDay(dbMessages[index - 1]?.createdAt, msg.createdAt) && <ChatDaySeparator date={msg.createdAt} />}
                    <div className={`group group/msg relative flex items-end gap-2 ${isUserSender ? "justify-end" : "justify-start"}`}>
                      {isUserSender && !isTemporary && <UnsendButton onClick={() => setUnsendTarget(msg)} />}
                      {!isUserSender && <ChatAvatar src={senderAvatar} name={senderName} />}
                      <div className={`flex min-w-0 flex-col ${isUserSender ? "items-end" : "items-start"}`}>
                        <div
                          className={`max-w-[230px] rounded-lg text-sm leading-relaxed sm:max-w-[260px] ${
                            msg.imageUrl && !msg.content?.trim() ? "p-1" : "px-3 py-2"
                          } ${isUserSender ? "bg-primary text-white" : "border border-kumo-line bg-kumo-base text-kumo-default"}`}
                        >
                          {msg.imageUrl && (
                            <div className={msg.content ? "mb-2" : ""}>
                              <ChatImage url={msg.imageUrl} onOpen={setLightboxImageUrl} />
                            </div>
                          )}
                          {/* Keeps typed line breaks and wraps long links. */}
                          {msg.content && <p className="wrap-anywhere whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                        <div className="mt-1 px-1 text-xs text-kumo-subtle">
                          {isTemporary && msg.failed ? (
                            <button
                              type="button"
                              onClick={() => retryMessage(msg)}
                              className="cursor-pointer font-semibold text-kumo-danger hover:underline"
                            >
                              Not sent. Tap to retry
                            </button>
                          ) : isTemporary && msg.sending ? (
                            <span>Sending...</span>
                          ) : (
                            formatMessageTime(msg.createdAt)
                          )}
                        </div>
                      </div>
                      {isUserSender && <ChatAvatar src={senderAvatar} name={senderName || "Me"} />}
                    </div>
                  </React.Fragment>
                );
              })}
              {isAuthenticated && <div ref={messagesEndRef} />}
            </div>

            {isAuthenticated && (
              <div className="shrink-0 space-y-2 border-t border-kumo-line bg-kumo-base p-3">
                {imagePreview && (
                  <div className="flex items-end gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="h-16 rounded-lg border border-kumo-line object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary-destructive"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                    >
                      Remove photo
                    </Button>
                  </div>
                )}
                {recipient === "admin" && inquirySlotId && (
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<MapPin />}
                    className="w-full justify-center"
                    onClick={(e) => handleSend(e, inquirySlotId)}
                    disabled={cooldownLeft > 0 || isUploading || blocked}
                    title={
                      cooldownLeft > 0
                        ? `Please wait ${cooldownLeft}s before sending another message`
                        : "Send a leasing inquiry to the mall admin"
                    }
                  >
                    {cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : `Share Inquiry For Unit ${inquirySlotId}`}
                  </Button>
                )}
                <DraftNote draft={draft} className="text-xs" />
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Attach a photo"
                    onChange={handleImageSelect}
                  />
                  <Button
                    suppressHydrationWarning
                    type="button"
                    variant="secondary"
                    shape="square"
                    size="lg"
                    icon={<Paperclip />}
                    aria-label="Attach a photo"
                    title="Attach a photo"
                    disabled={blocked}
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      suppressHydrationWarning
                      size="lg"
                      aria-label="Message"
                      value={inputText}
                      disabled={blocked}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={blocked ? "Messaging disabled" : imageFile ? "Add a caption" : "Message"}
                      className="w-full"
                    />
                  </div>
                  <Button
                    suppressHydrationWarning
                    type="submit"
                    variant="primary"
                    shape="square"
                    size="lg"
                    icon={<PaperPlaneRight />}
                    aria-label="Send message"
                    loading={isUploading}
                    disabled={(!inputText.trim() && !imageFile) || isUploading || cooldownLeft > 0 || blocked}
                    title={cooldownLeft > 0 ? `Please wait ${cooldownLeft}s before sending another message` : "Send message"}
                  />
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: IMAGE LIGHTBOX ── */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="animate-fade-in fixed inset-0 z-150 flex items-center justify-center bg-black/85 p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-[90vh] max-w-4xl flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImage(lightboxImageUrl, 2000)}
              alt="Full preview"
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
            <div className="mt-4 flex items-center gap-3">
              <a
                href={lightboxImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-white underline"
              >
                Open original
              </a>
              <Button variant="secondary" onClick={() => setLightboxImageUrl(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {unsendTarget && (
        <ChatConfirmModal
          title="Unsend message?"
          message="It will be removed for everyone in this conversation."
          confirmLabel="Unsend"
          busy={isUnsending}
          onCancel={() => setUnsendTarget(null)}
          onConfirm={confirmUnsend}
        />
      )}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
