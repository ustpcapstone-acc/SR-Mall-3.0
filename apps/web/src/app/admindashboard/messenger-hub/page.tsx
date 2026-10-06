"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MoreVertical,
  Send,
  ShieldAlert,
  Ban,
  MapPin,
  CalendarPlus,
  Loader2,
  Paperclip,
  X,
  Maximize2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  getAdminConversations,
  getMessagesByConversation,
  replyToConversation,
} from "@/app/actions/chat-queries";
import { refreshChatUnread, setViewingChats } from "@/lib/chat-unread";
import { useAuth } from "@/app/providers";
import { ChatAvatar, ChatImage, bubblePadding } from "@/components/chat/chat-media";
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
import { formatConversationTime, formatMessageTime, startsNewDay } from "@/lib/chat-time";
import {
  BlockToggleButton,
  BlockedBanner,
  ChatConfirmModal,
  ChatDaySeparator,
  UnsendButton,
  useChatBlock,
} from "@/components/chat/chat-ui";
import { toast } from "sonner";

const FILTER_TABS = ["All", "Tenant Messages", "Customer Chat Messages", "Unread"] as const;

function MessengerHubContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversationId");
  const queryTenantId = searchParams.get("tenantId");

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Modals state
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const activeChatIdRef = useRef<string | null>(null);
  const messagesCacheRef = useRef<Record<string, any[]>>({});
  const conversationsRef = useRef<any[]>([]);
  /** Files of still-sending bubbles, so a failed image send can be retried. */
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const loadingOlderRef = useRef(false);

  // Realtime + pagination state
  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] =
    useState<ChatRealtimeStatus>("connecting");
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  activeChatIdRef.current = activeChatId;
  conversationsRef.current = conversations;

  // Helper to extract the other party (non-admin participant or the target)
  const getOtherParticipant = useCallback(
    (c: any) => {
      if (!c) return null;
      if (c.user?.id === user?.id || c.user?.role === "ADMIN") {
        return c.target || c.user;
      }
      return c.user;
    },
    [user?.id]
  );

  // Derived active chat object ensures data is always current from the conversations list
  const activeChat = conversations.find((c) => c.id === activeChatId) || null;
  const activeOtherUser = getOtherParticipant(activeChat);

  // The open conversation counts as read (also as new messages arrive).
  const activeReadKey = activeChat
    ? (activeChat.allConversationIds || [activeChat.id]).join("|")
    : "";
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!user?.id || !activeReadKey) return;
    void import("@/app/actions/chat-queries")
      .then(({ markConversationReadAction }) => markConversationReadAction(user.id, activeReadKey.split("|")))
      .then(() => refreshChatUnread());
  }, [user?.id, activeReadKey, lastMessageId]);

  // The chat on screen doesn't count as unread and doesn't pop a toast.
  useEffect(() => {
    if (!activeReadKey) return;
    return setViewingChats(activeReadKey.split("|"));
  }, [activeReadKey]);

  // Blocks are recorded against the portal admin: the account public chats
  // are routed to, so every admin sees and enforces the same block.
  const [portalAdminId, setPortalAdminId] = useState<string | null>(null);
  useEffect(() => {
    void import("@/app/actions/chat-queries")
      .then(({ getPortalAdminAction }) => getPortalAdminAction())
      .then((admin) => setPortalAdminId(admin?.id || null))
      .catch(() => {});
  }, []);
  const canBlockActive = Boolean(activeOtherUser && activeOtherUser.role !== "ADMIN");
  const block = useChatBlock(portalAdminId, canBlockActive ? activeOtherUser?.id : null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const activeSuspended = Boolean(activeOtherUser?.isBlacklisted);

  const [unsendTarget, setUnsendTarget] = useState<any | null>(null);
  const [isUnsending, setIsUnsending] = useState(false);
  const confirmUnsend = async () => {
    if (!unsendTarget || !user?.id) return;
    setIsUnsending(true);
    try {
      const { deleteMessageAction } = await import("@/app/actions/chat-queries");
      const res = await deleteMessageAction(unsendTarget.id, user.id);
      if (res.success) {
        setMessages((prev) => applyRealtimeDelete(prev, unsendTarget.id));
        setUnsendTarget(null);
      } else {
        toast.error(res.error || "Couldn't unsend the message");
      }
    } finally {
      setIsUnsending(false);
    }
  };
  const activeTenantData = activeChat?.user?.tenant || activeChat?.target?.tenant;
  const isCurrentTenant = !!(
    activeChat?.user?.tenant ||
    activeChat?.user?.role === "TENANT" ||
    activeChat?.target?.tenant ||
    activeChat?.target?.role === "TENANT" ||
    activeChat?.type === "TENANT"
  );
  const activeDisplayName =
    isCurrentTenant && activeTenantData?.shopName
      ? `${activeTenantData.shopName} (${activeTenantData.unitId || "UNIT"})`
      : activeOtherUser?.name || activeOtherUser?.email || "SR Mall Member";

  const fetchConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getAdminConversations(user?.id);
      setConversations(data);

      setActiveChatId((currentId) => {
        if (queryConversationId) {
          // Links point at one conversation; the list merges them per contact.
          const match = data.find(
            (c: any) => c.id === queryConversationId || c.allConversationIds?.includes(queryConversationId),
          );
          if (match) return match.id;
        }
        if (queryTenantId) {
          const matchingChat = data.find(
            (c) =>
              c.user?.tenant?.id === queryTenantId ||
              c.target?.tenant?.id === queryTenantId
          );
          if (matchingChat) return matchingChat.id;
        }
        if (!currentId && data.length > 0) {
          return data[0].id;
        }
        return currentId;
      });
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [queryConversationId, queryTenantId]);

  useEffect(() => {
    fetchConversations(true);
    // Conversation previews refresh every 15s; live messages arrive through
    // Supabase Realtime instead of hammering this endpoint.
    const interval = setInterval(() => fetchConversations(false), 15000);


    return () => clearInterval(interval);
  }, [user, fetchConversations]);

  // A message in any conversation (including ones not in the list yet) pushes
  // a debounced list refresh, so new chats appear without waiting for the poll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToInbox(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void fetchConversations(false), 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [fetchConversations]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  // Latest page of the active chat (and older pages on scroll-up).
  const fetchMessages = useCallback(
    async (
      idToFetch: string,
      shouldScroll = false,
      page?: { before: string; beforeId: string },
    ) => {
      try {
        const activeObj = conversationsRef.current.find((c) => c.id === idToFetch);

        if (page) {
          // Older page → merge above what is already on screen.
          const container = messagesContainerRef.current;
          const previousHeight = container?.scrollHeight ?? 0;
          const history = await getMessagesByConversation(
            idToFetch,
            activeObj?.allConversationIds,
            {
              limit: MESSAGE_PAGE_SIZE,
              before: page.before,
              beforeId: page.beforeId,
            },
          );

          if (activeChatIdRef.current !== idToFetch) return;
          if (history.length < MESSAGE_PAGE_SIZE) setHasOlderMessages(false);

          setMessages((prev) => prependOlderMessages(prev, history));
          if (container) {
            requestAnimationFrame(() => {
              container.scrollTop += container.scrollHeight - previousHeight;
            });
          }
          return;
        }

        const msgs = await getMessagesByConversation(
          idToFetch,
          activeObj?.allConversationIds,
          { limit: MESSAGE_PAGE_SIZE },
        );
        messagesCacheRef.current[idToFetch] = msgs;
        setHasOlderMessages(msgs.length >= MESSAGE_PAGE_SIZE);

        const ids = conversationIdsOf(msgs, idToFetch);
        setConversationIds((prev) =>
          conversationKey(prev) === conversationKey(ids) ? prev : ids,
        );

        if (activeChatIdRef.current === idToFetch) {
          setMessages((prev) => mergeFetchedMessages(prev, msgs));

          if (shouldScroll || isNearBottomRef.current) {
            scrollToEnd();
          }
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    },
    [],
  );

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlderMessages || !activeChatId) return;

    const oldest = messages.find((m) => !isOptimistic(m));
    if (!oldest) return;

    loadingOlderRef.current = true;
    try {
      await fetchMessages(activeChatId, false, {
        before: new Date(oldest.createdAt).toISOString(),
        beforeId: String(oldest.id),
      });
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      loadingOlderRef.current = false;
    }
  }, [activeChatId, fetchMessages, hasOlderMessages, messages]);

  // Which conversation(s) the open chat spans — kept reference-stable so the
  // realtime effect does not resubscribe on every conversation refresh.
  useEffect(() => {
    if (!activeChatId) {
      setConversationIds([]);
      return;
    }
    const activeObj = conversationsRef.current.find((c) => c.id === activeChatId);
    const base =
      activeObj?.allConversationIds?.length
        ? activeObj.allConversationIds
        : [activeChatId];
    setConversationIds((prev) =>
      conversationKey(prev) === conversationKey(base) ? prev : base,
    );
  }, [activeChatId, conversations]);

  useEffect(() => {
    if (activeChatId) {
      const currentId = activeChatId;
      setHasOlderMessages(true);
      if (!messagesCacheRef.current[currentId]) {
        setLoadingMessages(true);
      }
      fetchMessages(currentId, true).finally(() => setLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [activeChatId, fetchMessages]);

  // Supabase Realtime: exactly one channel for the open chat, disposed when the
  // chat changes or the page unmounts.
  useEffect(() => {
    if (conversationIds.length === 0) return;

    const unsubscribe = subscribeToConversation(conversationIds, {
      onMessage: (row) => {
        setMessages((prev) => applyRealtimeMessage(prev, row));
        if (isNearBottomRef.current) scrollToEnd();
      },
      onDelete: (messageId) => {
        setMessages((prev) => applyRealtimeDelete(prev, messageId));
      },
      onStatus: setRealtimeStatus,
    });

    return unsubscribe;
  }, [conversationIds]);

  // Fallback only: polls while realtime is not connected (never when it is).
  useEffect(() => {
    if (!activeChatId || realtimeStatus === "subscribed") return;
    const interval = setInterval(() => {
      void fetchMessages(activeChatId, false);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeChatId, realtimeStatus, fetchMessages]);

  const handleSelectChat = (chat: any) => {
    if (chat.id === activeChatId) return;
    setActiveChatId(chat.id);
    setConversations((prev: any[]) =>
      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)),
    );
    isNearBottomRef.current = true;

    // Messenger-like instantaneous switch: display cached messages immediately with 0 delay!
    if (messagesCacheRef.current[chat.id]) {
      setMessages(normalizeMessages(messagesCacheRef.current[chat.id]));
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = isAtBottom;
    // Scrolled to the top → load the previous page of history.
    if (!isAtBottom && el.scrollTop < 80) {
      void loadOlderMessages();
    }
  };

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
  }) => {
    if (!activeChatId) return;

    setIsSending(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (payload.file) {
        uploadedImageUrl = await uploadImageToCloudinary(payload.file);
        if (!uploadedImageUrl) throw new Error("Image upload failed");
      } else if (payload.preview && /^https?:\/\//i.test(payload.preview)) {
        // Retry of a message whose image already reached the CDN.
        uploadedImageUrl = payload.preview;
      }

      const res: any = await replyToConversation(
        activeChatId,
        true,
        payload.content,
        uploadedImageUrl || undefined,
        user?.id,
      );

      if (!res?.success) {
        if (res?.error) toast.error(res.error);
        setMessages((prev) => markOptimisticFailed(prev, payload.tempId));
        return;
      }

      pendingFilesRef.current.delete(payload.tempId);

      if (res.conversationId && res.conversationId !== activeChatId) {
        // Message was routed into another conversation → follow it.
        setActiveChatId(res.conversationId);
        fetchMessages(res.conversationId, false);
      } else if (res.message) {
        // Swap temp-… for the real row (same id the realtime event carries).
        setMessages((prev) =>
          replaceOptimistic(prev, payload.tempId, res.message),
        );
      }
      fetchConversations(false);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => markOptimisticFailed(prev, payload.tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !imageFile) || !activeChatId || isSending) return;

    const textToSend = replyText;
    const fileToSend = imageFile;
    const previewToSend = imagePreview;

    // Reset input fields immediately (zero latency)
    setReplyText("");
    setImageFile(null);
    setImagePreview(null);
    setFileInputKey((k) => k + 1);

    // Instant optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage = {
      id: tempId,
      content: textToSend,
      imageUrl: previewToSend,
      senderId: user?.id,
      conversationId: activeChatId,
      sender: {
        id: user?.id,
        name: user?.name || "System Admin",
        email: user?.email,
        avatarUrl: user?.avatarUrl,
        role: "ADMIN",
      },
      createdAt: new Date(),
      sending: true,
    };

    setMessages((prev) => normalizeMessages([...prev, optimisticMessage]));
    isNearBottomRef.current = true;
    scrollToEnd();

    if (fileToSend) pendingFilesRef.current.set(tempId, fileToSend);

    await persistMessage({
      tempId,
      content: textToSend,
      file: fileToSend,
      preview: previewToSend,
    });
  };

  // Retry a failed bubble — its text and image are preserved.
  const retryMessage = (message: any) => {
    if (!message?.id || message.sending) return;
    const file = pendingFilesRef.current.get(message.id) ?? null;
    setMessages((prev) => markOptimisticSending(prev, message.id));
    void persistMessage({
      tempId: message.id,
      content: message.content,
      file,
      preview: message.imageUrl ?? null,
    });
  };



  // Filter conversations
  const filteredChats = conversations
    .filter((c) => {
      const searchStr = searchQuery.toLowerCase();
      const p1 = c.user;
      const p2 = c.target;
      const matchesSearch =
        (p1?.name || "").toLowerCase().includes(searchStr) ||
        (p1?.email || "").toLowerCase().includes(searchStr) ||
        (p1?.tenant?.shopName || "").toLowerCase().includes(searchStr) ||
        (p1?.tenant?.unitId || "").toLowerCase().includes(searchStr) ||
        (p2?.name || "").toLowerCase().includes(searchStr) ||
        (p2?.email || "").toLowerCase().includes(searchStr) ||
        (p2?.tenant?.shopName || "").toLowerCase().includes(searchStr) ||
        (p2?.tenant?.unitId || "").toLowerCase().includes(searchStr) ||
        (c.messages[0]?.content || "").toLowerCase().includes(searchStr);

      if (!matchesSearch) return false;

      const isTenant = !!(
        p1?.tenant ||
        p1?.role === "TENANT" ||
        p2?.tenant ||
        p2?.role === "TENANT" ||
        c.type === "TENANT"
      );

      if (filter === "Tenant Messages") return isTenant;
      if (filter === "Customer Chat Messages") return !isTenant;
      if (filter === "Unread") return (c.unreadCount || 0) > 0 && c.id !== activeChatId;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return (
    <div className="h-screen flex flex-col pt-10 px-8 pb-8 animate-fade-in-up">
      <div className="mb-6 flex items-end justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-charcoal dark:text-white tracking-tight">
              Messages & Support
            </h1>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage customer inquiries, tenant communications, and operational support channels.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 flex overflow-hidden">
        {/* Left Column (Inbox) */}
        <div className="w-80 border-r border-slate-100 dark:border-white/5 flex flex-col bg-slate-50/50 dark:bg-zinc-900">
          <div className="p-5 border-b border-slate-100 dark:border-white/5 space-y-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium focus:border-primary outline-none"
              />
            </div>
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {FILTER_TABS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    filter === f
                      ? "bg-charcoal text-white dark:bg-white dark:text-black shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-white/10 hover:border-slate-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Loading Chats
                </span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 p-6 text-center text-slate-400">
                <p className="text-xs font-bold uppercase tracking-widest">No conversations found</p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const otherUser = getOtherParticipant(chat);
                const isTenant = !!(
                  chat.user?.tenant ||
                  chat.user?.role === "TENANT" ||
                  chat.target?.tenant ||
                  chat.target?.role === "TENANT" ||
                  chat.type === "TENANT"
                );
                const tenantData = chat.user?.tenant || chat.target?.tenant;
                const isBlocked = !!otherUser?.isBlacklisted;
                const displayName =
                  isTenant && tenantData?.shopName
                    ? tenantData.shopName
                    : otherUser?.name || otherUser?.email || "SR Mall User";
                const displayUnit = tenantData?.unitId;
                const unread = activeChat?.id === chat.id ? 0 : chat.unreadCount || 0;

                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`p-5 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors flex items-center gap-3 ${
                      activeChat?.id === chat.id
                        ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary"
                        : "hover:bg-white dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-100 dark:border-white/5 relative">
                      {otherUser?.avatarUrl ? (
                        <img
                          src={otherUser.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        displayName.substring(0, 2).toUpperCase()
                      )}
                      {isBlocked && (
                        <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white" title="Account suspended">
                          <Ban size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4
                          className={`text-sm text-charcoal dark:text-white truncate ${
                            unread > 0 ? "font-black" : "font-bold"
                          }`}
                        >
                          {displayName}
                        </h4>
                        <span
                          className={`text-[9px] font-bold uppercase shrink-0 ml-1 ${
                            unread > 0 ? "text-primary" : "text-slate-400"
                          }`}
                        >
                          {formatConversationTime(chat.messages[0]?.createdAt || chat.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-zinc-800">
                          {isTenant
                            ? `TENANT • ${displayUnit || "UNIT"}`
                            : "CUSTOMER"}
                        </span>
                        {isBlocked && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            SUSPENDED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`flex-1 text-xs truncate ${
                            unread > 0 ? "text-charcoal dark:text-white font-bold" : "text-slate-500 font-medium"
                          }`}
                        >
                          {chat.messages[0]?.imageUrl && !chat.messages[0]?.content
                            ? "📷 Image"
                            : chat.messages[0]?.content || "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column (Chat Window) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-6 shadow-sm z-10 transition-all bg-white dark:bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-200 dark:border-white/10">
                      {activeOtherUser?.avatarUrl ? (
                        <img
                          src={activeOtherUser.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        activeDisplayName.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-charcoal dark:text-white flex items-center gap-2 leading-tight">
                      {activeDisplayName}
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 truncate max-w-xs">
                      {activeOtherUser?.email}
                    </p>
                  </div>
                </div>
                {canBlockActive && portalAdminId && (
                  <BlockToggleButton blocked={block.blockedByMe} onClick={() => setConfirmBlock(true)} />
                )}
              </div>

              {/* Messages Container */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 dark:bg-black/20 custom-scrollbar"
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Loading conversation...
                    </span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
                    <p className="text-xs text-slate-500 font-medium">
                      Start the transmission by sending a response below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isFromAdmin =
                      msg.senderId === user?.id ||
                      msg.sender?.role === "ADMIN";

                    const senderAvatar = isFromAdmin
                      ? msg.sender?.avatarUrl || user?.avatarUrl
                      : msg.sender?.avatarUrl || activeOtherUser?.avatarUrl;

                    const senderName = isFromAdmin
                      ? msg.sender?.name || user?.name || "System Admin"
                      : msg.sender?.name || activeOtherUser?.name || activeOtherUser?.email || "Member";

                    const isTemporary = String(msg.id).startsWith("temp-");

                    return (
                      <React.Fragment key={msg.id}>
                      {startsNewDay(messages[index - 1]?.createdAt, msg.createdAt) && (
                        <ChatDaySeparator date={msg.createdAt} />
                      )}
                      <div
                        className={`flex gap-3 ${
                          isFromAdmin ? "justify-end" : "justify-start"
                        } items-end animate-fade-in group group/msg relative`}
                      >
                        {msg.senderId === user?.id && !isTemporary && (
                          <UnsendButton onClick={() => setUnsendTarget(msg)} />
                        )}
                        {!isFromAdmin && <ChatAvatar src={senderAvatar} name={senderName} />}

                        <div className={`flex flex-col ${isFromAdmin ? "items-end" : "items-start"}`}>
                          <div className="relative group/bubble">
                            <div
                              className={`max-w-[280px] sm:max-w-[400px] lg:max-w-[500px] ${bubblePadding(msg)} shadow-sm rounded-2xl relative ${
                                isFromAdmin
                                  ? "bg-primary text-white rounded-tr-sm"
                                  : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-tl-sm"
                              }`}
                            >
                              {msg.imageUrl && (
                                <div className={msg.content ? "mb-2" : ""}>
                                  <ChatImage url={msg.imageUrl} onOpen={setLightboxImageUrl} />
                                </div>
                              )}

                              {msg.content && (
                                <p className="text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 px-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isTemporary && msg.failed ? (
                              <button
                                type="button"
                                onClick={() => retryMessage(msg)}
                                className="text-[8px] font-bold text-red-500 hover:text-red-600 hover:underline uppercase"
                              >
                                Not sent · Retry
                              </button>
                            ) : isTemporary && msg.sending !== false ? (
                              <span className="text-[8px] font-bold text-primary animate-pulse">
                                Sending...
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {isFromAdmin && (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                            {senderAvatar ? (
                              <img
                                src={senderAvatar}
                                alt="Sender"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                {(senderName || "?").substring(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {(block.blockedByMe || activeSuspended) && (
                <BlockedBanner
                  text={
                    block.blockedByMe
                      ? "This user is blocked from messaging the mall. Unblock them to reply."
                      : "This account is suspended. They can't send messages until it's restored in User Management."
                  }
                />
              )}

              {/* Message Input Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900">
                {imagePreview && (
                  <div className="mb-3 relative inline-block animate-fade-in">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-20 rounded-xl border border-slate-200 dark:border-white/10 object-cover shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                        setFileInputKey((k) => k + 1);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={handleSendReply}
                  className="relative flex items-center bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 p-1.5 pr-2 focus-within:ring-2 ring-primary/20 transition-all"
                >
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10"
                    onChange={handleImageSelect}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }}
                    className="p-2 text-slate-400 hover:text-primary transition-colors shrink-0 relative z-10 cursor-pointer"
                    title="Attach image"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      block.blockedByMe
                        ? "Messaging disabled"
                        : imageFile
                          ? "Add a caption... (optional)"
                          : "Type a reply..."
                    }
                    disabled={block.blockedByMe}
                    className="flex-1 px-3 py-2 bg-transparent outline-none text-sm font-medium disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={(!replyText.trim() && !imageFile) || isSending || block.blockedByMe}
                    className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center"
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40">
              <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-6">
                <Send size={40} className="text-slate-400" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                Pick a transmission to begin
              </p>
            </div>
          )}
        </div>

        {/* Right Column (Context Panel) */}
        {activeChat && (
          <div className="w-80 border-l border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900 overflow-y-auto hidden xl:block">
            <div className="p-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                <MoreVertical size={14} /> Context Panel
              </h3>

              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl uppercase overflow-hidden border border-slate-100 dark:border-white/5 shrink-0">
                      {activeOtherUser?.avatarUrl ? (
                        <img
                          src={activeOtherUser.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        activeDisplayName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-charcoal dark:text-white truncate">
                        {activeDisplayName}
                      </h4>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        Verified Member
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center pt-4 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <p className="text-lg font-black text-charcoal dark:text-white">
                        {messages.length}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        Messages
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-black uppercase text-charcoal dark:text-white">
                        Active
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        Status
                      </p>
                    </div>
                  </div>
                </div>

                {/* Space Interest Module */}
                {activeChat.areaSlot && (
                  <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                      Linked Inventory
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Unit ID
                        </span>
                        <span className="text-sm font-black text-charcoal dark:text-white">
                          {activeChat.areaSlot.unit_id}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Size
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                          {activeChat.areaSlot.sqm_size} SQM
                        </span>
                      </div>

                      <button className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-charcoal dark:bg-white text-white dark:text-black font-bold text-xs rounded-xl hover:scale-[1.02] transition-transform shadow-lg">
                        <CalendarPlus size={16} /> Fast-Track Lease
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ── MODAL: IMAGE LIGHTBOX ── */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
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
      {confirmBlock && (
        <ChatConfirmModal
          title={block.blockedByMe ? "Unblock this user?" : "Block this user?"}
          message={
            block.blockedByMe
              ? "They will be able to message the mall administration again."
              : "They won't be able to message the mall administration until you unblock them."
          }
          confirmLabel={block.blockedByMe ? "Unblock" : "Block"}
          tone={block.blockedByMe ? "neutral" : "danger"}
          busy={block.busy}
          onCancel={() => setConfirmBlock(false)}
          onConfirm={async () => {
            if (await block.setBlocked(!block.blockedByMe)) setConfirmBlock(false);
          }}
        />
      )}
    </div>
  );
}

export default function MessengerHub() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Loading Messenger...
            </span>
          </div>
        </div>
      }
    >
      <MessengerHubContent />
    </Suspense>
  );
}
