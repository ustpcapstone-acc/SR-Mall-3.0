"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Paperclip,
  MapPin,
  ArrowLeft,
  Search,
  Loader2,
  Ban,
  ExternalLink,
  Building2,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { LoginModal } from "./login-modal";
import { markMessageNotificationsAsReadAction } from "@/app/actions/notification";
import { refreshChatUnread, setViewingChats } from "@/lib/chat-unread";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
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
function ShopAvatar({ name, logo, className = "w-12 h-12" }: { name: string; logo: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  return (
    <div className={`${className} rounded-full overflow-hidden bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm border border-slate-100 dark:border-white/5 shrink-0`}>
      {logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" onError={() => setBroken(true)} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function AdminAvatar({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`${className} rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0`}>
      <Building2 size={20} />
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

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
      const res = await getAllStorefrontsAction();
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

  // Older page — requested only when the user scrolls to the top.
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

  // Esc closes the chat box (not while the image viewer is open).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxImageUrl) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, lightboxImageUrl, onClose]);

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

  // The open thread counts as read — including messages that arrive while open.
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

  const [unsendTarget, setUnsendTarget] = useState<any | null>(null);
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
      formData.append("file", file);
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

  const handleSend = async (e: React.FormEvent, slotId?: string) => {
    e.preventDefault();

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

    // Reset input immediately
    setInputText("");
    setImageFile(null);
    setImagePreview(null);

    if (user?.email) {
      // Instant optimistic update with local preview
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const contentToSend = textToSend || "📎 Image";

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
    }
  };

  // Retry a failed bubble — its text and image are preserved.
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

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-32 sm:right-10 z-[100] w-full h-[85vh] sm:w-[400px] sm:h-[600px] bg-white dark:bg-zinc-900 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl border-0 sm:border border-slate-100 dark:border-white/5 flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-primary flex items-center justify-between text-white shadow-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            {viewMode === "chat" && (
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="Back to chats"
                className="p-1.5 -ml-1 hover:bg-white/20 rounded-full transition-colors active:scale-95"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden font-black text-lg shrink-0">
              {viewMode === "chat" ? (
                recipient === "admin" ? (
                  <Building2 size={20} />
                ) : selectedShop.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedShop.logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  (selectedShop.name || "?").charAt(0).toUpperCase()
                )
              ) : isAuthenticated && user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : isAuthenticated ? (
                (user?.name || user?.email || "?").charAt(0).toUpperCase()
              ) : (
                <MessageCircle size={20} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-bold text-sm tracking-tight truncate max-w-[220px]">
                {viewMode === "chat"
                  ? recipient === "admin"
                    ? "Mall Administration"
                    : selectedShop.name
                  : isAuthenticated
                    ? `Hi, ${(user?.name || "there").split(" ")[0]} 👋`
                    : "SR Mall Messages"}
              </h3>
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest truncate">
                {viewMode === "chat"
                  ? recipient === "admin"
                    ? "Replies within 12–24 hours"
                    : "Shop chat"
                  : isUserBlocked
                    ? "Account suspended"
                    : "Messages"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            title="Close (Esc)"
            className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {viewMode === "list" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-black/20 custom-scrollbar">
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
                  <div className="p-3 sm:p-4 space-y-5">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        suppressHydrationWarning
                        type="text"
                        placeholder="Search shops or admin…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs font-medium text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Recent chats (Mall Administration is always offered first) */}
                    {(recent.length > 0 || showAdminStarter) && (
                      <section className="space-y-2">
                        <h4 className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recent chats</h4>
                        {showAdminStarter && (
                          <button
                            type="button"
                            onClick={() => {
                              setRecipient("admin");
                              setViewMode("chat");
                            }}
                            className="w-full text-left flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-2xl hover:shadow-md transition-all border border-slate-100 dark:border-white/5"
                          >
                            <AdminAvatar />
                            <span className="flex-1 min-w-0">
                              <span className="block font-bold text-sm text-charcoal dark:text-white">Mall Administration</span>
                              <span className="block text-xs text-slate-500 truncate">Bookings, spaces & help</span>
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
                              className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl hover:shadow-md transition-all border ${
                                unread
                                  ? "bg-primary/[0.05] border-primary/20"
                                  : "bg-white dark:bg-zinc-800 border-slate-100 dark:border-white/5"
                              }`}
                            >
                              {row.kind === "admin" ? <AdminAvatar /> : <ShopAvatar name={row.name} logo={row.logo} />}
                              <span className="flex-1 min-w-0">
                                <span className="flex items-center justify-between gap-2">
                                  <span className={`text-sm text-charcoal dark:text-white truncate ${unread ? "font-black" : "font-bold"}`}>
                                    {row.name}
                                  </span>
                                  <span className={`text-[10px] font-bold shrink-0 ${unread ? "text-primary" : "text-slate-400"}`}>
                                    {timeAgo(row.lastAt)}
                                  </span>
                                </span>
                                <span className="flex items-center justify-between gap-2 mt-0.5">
                                  <span className={`text-xs truncate ${unread ? "text-charcoal dark:text-white font-semibold" : "text-slate-500"}`}>
                                    {row.fromMe ? "You: " : ""}
                                    {row.lastMessage || "Photo"}
                                  </span>
                                  {unread && (
                                    <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shrink-0">
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
                        <h4 className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">All shops</h4>
                        {otherShops.map((shop) => (
                          <button
                            key={shop.id || shop.name}
                            type="button"
                            onClick={() => {
                              setRecipient("shop");
                              setSelectedShop(shop);
                              setViewMode("chat");
                            }}
                            className="w-full text-left flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-2xl hover:shadow-md transition-all border border-slate-100 dark:border-white/5"
                          >
                            <ShopAvatar name={shop.name} logo={shop.logo} />
                            <span className="flex-1 min-w-0">
                              <span className="block font-bold text-sm text-charcoal dark:text-white truncate">{shop.name}</span>
                              <span className="block text-xs text-slate-400">Start a conversation</span>
                            </span>
                          </button>
                        ))}
                      </section>
                    )}

                    {recent.length === 0 && !showAdminStarter && otherShops.length === 0 && (
                      <p className="py-10 text-center text-sm text-slate-400">No shops match “{searchQuery}”.</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center top-0 left-0 right-0 bottom-0 absolute bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10 w-full">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <MapPin size={32} className="text-primary" />
                </div>
                <h4 className="font-bold text-lg text-charcoal dark:text-white mb-2">
                  Member Chat
                </h4>
                <p className="text-sm font-medium text-slate-500 mb-6 max-w-[200px] leading-relaxed">
                  Connect securely with mall administration and individual stores.
                </p>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-8 py-3 bg-primary text-white font-bold tracking-widest text-xs uppercase rounded-xl shadow-lg hover:bg-primary-hover hover:scale-105 transition-all"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Blocked User Notice */}
            {(isUserBlocked || isRecipientBlocking) && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                <Ban size={14} />
                <span>
                  {isUserBlocked
                    ? "Your account is suspended. Messaging is disabled."
                    : "This recipient is currently not accepting incoming messages from you."}
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20"
            >
              {isAuthenticated && !threadLoaded && dbMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-primary" />
                </div>
              ) : dbMessages.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 px-6 gap-3 animate-fade-in">
                  {recipient === "admin" ? (
                    <AdminAvatar className="w-16 h-16" />
                  ) : (
                    <ShopAvatar name={selectedShop.name || "?"} logo={selectedShop.logo} className="w-16 h-16" />
                  )}
                  <p className="text-sm font-bold text-charcoal dark:text-white">
                    {isAuthenticated
                      ? `Say hi to ${recipient === "admin" ? "Mall Administration" : selectedShop.name} 👋`
                      : "Sign in to start chatting"}
                  </p>
                  <p className="text-xs text-slate-400 max-w-[240px]">
                    {recipient === "admin"
                      ? "Ask about space bookings, events, lost & found or anything about the mall."
                      : "Ask about products, prices, stock or opening hours."}
                  </p>
                </div>
              ) : null}

              {dbMessages.map((msg: any, index: number) => {
                const isUserSender =
                  (user?.id && msg.senderId === user.id) ||
                  (user?.email && msg.sender?.email?.toLowerCase() === user.email.toLowerCase());
                const senderAvatar = isUserSender ? user?.avatarUrl : msg.sender?.avatarUrl;
                const senderName = isUserSender
                  ? user?.name
                  : msg.sender?.name || msg.sender?.email;
                const isTemporary = String(msg.id).startsWith("temp-");

                return (
                  <React.Fragment key={msg.id}>
                  {startsNewDay(dbMessages[index - 1]?.createdAt, msg.createdAt) && (
                    <ChatDaySeparator date={msg.createdAt} />
                  )}
                  <div
                    className={`flex gap-2.5 ${
                      isUserSender ? "justify-end" : "justify-start"
                    } items-end animate-fade-in group group/msg relative`}
                  >
                    {isUserSender && !isTemporary && (
                      <UnsendButton onClick={() => setUnsendTarget(msg)} />
                    )}
                    {!isUserSender && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                        {senderAvatar ? (
                          <img
                            src={senderAvatar}
                            alt="Sender"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {(
                              senderName ||
                              (recipient === "admin" ? "AD" : selectedShop.name)
                            ).substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${isUserSender ? "items-end" : "items-start"}`}>
                      <div className="relative group/bubble">
                        <div
                          className={`max-w-[240px] sm:max-w-[280px] rounded-3xl px-4 py-2.5 shadow-sm text-sm font-medium leading-relaxed ${
                            isUserSender
                              ? "bg-primary text-white rounded-tr-sm"
                              : "bg-white dark:bg-zinc-800 text-charcoal dark:text-slate-300 rounded-tl-sm border border-slate-100 dark:border-white/5"
                          }`}
                        >
                          {msg.imageUrl && (
                            <div className="mb-2 relative rounded-xl overflow-hidden cursor-pointer group/img">
                              <img
                                src={msg.imageUrl}
                                alt="Attachment"
                                onClick={() => setLightboxImageUrl(msg.imageUrl)}
                                className="rounded-xl max-w-full max-h-48 object-cover border border-white/10 hover:opacity-95 transition-opacity"
                                loading="lazy"
                              />
                            </div>
                          )}
                          {msg.content && <span>{msg.content}</span>}
                        </div>
                      </div>
                      <div className="mt-1 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        {isTemporary && msg.failed ? (
                          <button
                            type="button"
                            onClick={() => retryMessage(msg)}
                            className="text-red-500 hover:text-red-600 hover:underline"
                          >
                            Not sent · Tap to retry
                          </button>
                        ) : isTemporary && msg.sending ? (
                          <span>Sending…</span>
                        ) : (
                          formatMessageTime(msg.createdAt)
                        )}
                      </div>
                    </div>
                    {isUserSender && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                        {senderAvatar ? (
                          <img
                            src={senderAvatar}
                            alt="Sender"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {(senderName || "ME").substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {isAuthenticated && (
              <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 relative">
                {imagePreview && (
                  <div className="mb-3 relative inline-block animate-fade-in">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 rounded-xl border border-slate-200 dark:border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                {recipient === "admin" && inquirySlotId && (
                  <div className="mb-3 px-1">
                    <button
                      onClick={(e) => handleSend(e, inquirySlotId)}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-900/50 hover:bg-green-100 transition-colors"
                    >
                      <MapPin size={12} /> Share Inquiry For Unit {inquirySlotId}
                    </button>
                  </div>
                )}
                <form
                  onSubmit={handleSend}
                  className="relative flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-1.5 focus-within:ring-2 ring-primary/20 focus-within:border-primary transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10"
                    onChange={handleImageSelect}
                  />
                  <button
                    suppressHydrationWarning
                    type="button"
                    disabled={isUserBlocked || isRecipientBlocking}
                    onClick={(e) => {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }}
                    className="p-2 sm:p-2.5 text-slate-400 hover:text-primary transition-colors rounded-xl hover:bg-white dark:hover:bg-zinc-700 shrink-0 relative z-10 cursor-pointer disabled:opacity-40"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    suppressHydrationWarning
                    type="text"
                    value={inputText}
                    disabled={isUserBlocked || isRecipientBlocking}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isUserBlocked || isRecipientBlocking
                        ? "Messaging disabled"
                        : imageFile
                          ? "Add a caption..."
                          : "Message..."
                    }
                    className="flex-1 px-1 sm:px-2 py-2 bg-transparent outline-none text-sm font-medium dark:text-white placeholder:text-slate-400 min-w-0 disabled:opacity-40"
                  />
                  <button
                    suppressHydrationWarning
                    type="submit"
                    disabled={(!inputText.trim() && !imageFile) || isUploading || isUserBlocked || isRecipientBlocking}
                    className="p-2.5 sm:p-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-md shrink-0 flex items-center justify-center"
                  >
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
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
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center animate-scale-up"
          >
            <img
              src={lightboxImageUrl}
              alt="Full Preview"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            <div className="flex items-center gap-3 mt-4">
              <a
                href={lightboxImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors backdrop-blur-md"
              >
                <ExternalLink size={14} /> Open Original
              </a>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="px-4 py-2 bg-white text-charcoal rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 shadow-lg"
              >
                Close
              </button>
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
