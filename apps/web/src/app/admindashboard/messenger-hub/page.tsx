"use client";

import Link from "next/link";
import { optimizedImage } from "@/lib/media";
import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Loader, Select, cn } from "@cloudflare/kumo";
import { PaperPlaneRight, Paperclip } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, Person, SearchField } from "@/components/admin/page-kit";
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
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { isOffline } from "@/lib/drafts/online";

const FILTER_TABS = ["All", "Tenant Messages", "Customer Chat Messages", "Unread"] as const;
const FILTER_ITEMS: Record<string, string> = {
  All: "All conversations",
  "Tenant Messages": "Tenant messages",
  "Customer Chat Messages": "Customer messages",
  Unread: "Unread",
};

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

  // One unfinished reply per conversation. Text that failed to send stays in the
  // draft until it goes through.
  const [unsent, setUnsent] = useState<{ thread: string; tempId: string; text: string } | null>(null);
  const draft = useDraft({
    form: "admin.chat",
    scope: [activeChatId],
    enabled: Boolean(activeChatId),
    value: { text: replyText || (unsent?.thread === activeChatId ? unsent.text : "") },
    initial: { text: "" },
    onRestore: (saved) => {
      setUnsent(null);
      setReplyText(saved.text);
    },
  });

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
      // Same rule as the inbox: the non-admin person; in a chat between two
      // admins, whichever one isn't me (it used to show me in that case).
      const userIsAdmin = c.user?.role === "ADMIN";
      const targetIsAdmin = c.target?.role === "ADMIN";
      if (userIsAdmin && !targetIsAdmin) return c.target || c.user;
      if (targetIsAdmin && !userIsAdmin) return c.user || c.target;
      return c.user?.id === user?.id ? c.target || c.user : c.user || c.target;
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
    const interval = setInterval(() => {
      if (!document.hidden) fetchConversations(false);
    }, 15000);


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

  // Which conversation(s) the open chat spans, kept reference-stable so the
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
    setReplyText("");
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
      setUnsent((current) => (current?.tempId === payload.tempId ? null : current));

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
    if (isOffline()) {
      draft.flush();
      toast.error("You're offline. Your reply is kept here. Send it when you're back online.");
      return;
    }

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
    setUnsent({ thread: activeChatId, tempId, text: textToSend });
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

  // Retry a failed bubble, its text and image are preserved.
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

  const unreadChats = conversations.filter((c) => (c.unreadCount || 0) > 0 && c.id !== activeChatId).length;
  const isTenantChat = (chat: any) =>
    !!(
      chat.user?.tenant ||
      chat.user?.role === "TENANT" ||
      chat.target?.tenant ||
      chat.target?.role === "TENANT" ||
      chat.type === "TENANT"
    );
  const activeTenant = activeChat ? activeChat.user?.tenant || activeChat.target?.tenant : null;
  const activeKind = activeChat && isTenantChat(activeChat) ? "Tenant" : "Customer";

  return (
    // Fills the space under the top bar, so only the message lists scroll.
    <div className="flex h-[calc(100dvh-5rem)] flex-col gap-4 p-4 sm:p-6">
      <header className="shrink-0">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Messages and Support</h1>
        <p className="mt-1 text-sm text-kumo-subtle">
          Manage customer inquiries, tenant communications, and operational support channels.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
        {/* Left column: inbox */}
        <div className="flex w-80 shrink-0 flex-col border-r border-kumo-line">
          <div className="space-y-2 border-b border-kumo-line p-3">
            <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search conversations" className="sm:w-full" />
            <Select
              aria-label="Show"
              value={filter}
              items={FILTER_ITEMS}
              onValueChange={(v) => v != null && setFilter(v as string)}
              className="w-full"
            >
              {FILTER_TABS.map((f) => (
                <Select.Option key={f} value={f}>
                  {FILTER_ITEMS[f]}
                </Select.Option>
              ))}
            </Select>
            <p className="px-1 text-xs text-kumo-subtle">
              {filteredChats.length} conversation{filteredChats.length === 1 ? "" : "s"}
              {unreadChats > 0 && `, ${unreadChats} unread`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader />
              </div>
            ) : filteredChats.length === 0 ? (
              <EmptyNote title="No conversations found" />
            ) : (
              <ul className="divide-y divide-kumo-line">
                {filteredChats.map((chat) => {
                  const otherUser = getOtherParticipant(chat);
                  const isTenant = isTenantChat(chat);
                  const tenantData = chat.user?.tenant || chat.target?.tenant;
                  const isBlocked = !!otherUser?.isBlacklisted;
                  const displayName =
                    isTenant && tenantData?.shopName
                      ? tenantData.shopName
                      : otherUser?.name || otherUser?.email || "SR Mall User";
                  const displayUnit = tenantData?.unitId;
                  const unread = activeChat?.id === chat.id ? 0 : chat.unreadCount || 0;

                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectChat(chat)}
                        aria-current={activeChat?.id === chat.id}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 border-l-4 p-3 text-left hover:bg-kumo-tint",
                          activeChat?.id === chat.id ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent",
                        )}
                      >
                        <Avatar name={displayName} src={otherUser?.avatarUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("truncate text-sm text-kumo-default", unread > 0 ? "font-semibold" : "font-medium")}>
                              {displayName}
                            </span>
                            <span className={cn("shrink-0 text-xs", unread > 0 ? "font-semibold text-kumo-brand" : "text-kumo-subtle")}>
                              {formatConversationTime(chat.messages[0]?.createdAt || chat.updatedAt)}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-kumo-subtle">
                            {isTenant ? `Tenant${displayUnit ? `, Unit ${displayUnit}` : ""}` : "Customer"}
                            {isBlocked && <span className="font-semibold text-kumo-danger">, suspended</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={cn("flex-1 truncate text-sm", unread > 0 ? "font-medium text-kumo-default" : "text-kumo-subtle")}>
                              {chat.messages[0]?.imageUrl && !chat.messages[0]?.content
                                ? "Image"
                                : chat.messages[0]?.content || "No messages yet"}
                            </span>
                            {unread > 0 && (
                              <span
                                aria-label={`${unread} unread`}
                                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-kumo-brand px-1.5 text-xs font-semibold text-white"
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Center column: conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeChat ? (
            <>
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-kumo-line px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={activeDisplayName} src={activeOtherUser?.avatarUrl} />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-kumo-default">{activeDisplayName}</h2>
                    <p className="truncate text-sm text-kumo-subtle">{activeOtherUser?.email}</p>
                  </div>
                </div>
                {canBlockActive && portalAdminId && (
                  <BlockToggleButton blocked={block.blockedByMe} onClick={() => setConfirmBlock(true)} />
                )}
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-kumo-recessed p-4 sm:p-6"
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader />
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyNote title="No messages yet">Send a reply below to start the conversation.</EmptyNote>
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
                          className={cn("group group/msg relative flex items-end gap-2", isFromAdmin ? "justify-end" : "justify-start")}
                        >
                          {msg.senderId === user?.id && !isTemporary && <UnsendButton onClick={() => setUnsendTarget(msg)} />}
                          {!isFromAdmin && <ChatAvatar src={optimizedImage(senderAvatar, 96)} name={senderName} />}

                          <div className={cn("flex min-w-0 flex-col", isFromAdmin ? "items-end" : "items-start")}>
                            <div
                              className={cn(
                                "max-w-[280px] rounded-lg sm:max-w-[400px] lg:max-w-[500px]",
                                bubblePadding(msg),
                                isFromAdmin ? "bg-kumo-brand text-white" : "border border-kumo-line bg-kumo-base text-kumo-default",
                              )}
                            >
                              {msg.imageUrl && (
                                <div className={msg.content ? "mb-2" : ""}>
                                  <ChatImage url={msg.imageUrl} onOpen={setLightboxImageUrl} />
                                </div>
                              )}
                              {msg.content && (
                                <p className="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-2 px-1">
                              <span className="text-xs text-kumo-subtle">{formatMessageTime(msg.createdAt)}</span>
                              {isTemporary && msg.failed ? (
                                <button
                                  type="button"
                                  onClick={() => retryMessage(msg)}
                                  className="cursor-pointer text-xs font-semibold text-kumo-danger hover:underline"
                                >
                                  Not sent. Retry
                                </button>
                              ) : isTemporary && msg.sending !== false ? (
                                <span className="text-xs font-medium text-kumo-subtle">Sending...</span>
                              ) : null}
                            </div>
                          </div>

                          {isFromAdmin && <ChatAvatar src={optimizedImage(senderAvatar, 96)} name={senderName} />}
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

              <div className="shrink-0 border-t border-kumo-line p-3">
                {imagePreview && (
                  <div className="mb-3 flex items-end gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="h-20 rounded-lg border border-kumo-line object-cover" />
                    <Button
                      size="sm"
                      variant="secondary-destructive"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                        setFileInputKey((k) => k + 1);
                      }}
                    >
                      Remove image
                    </Button>
                  </div>
                )}
                <DraftNote draft={draft} className="mb-2 text-xs" />
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Attach an image"
                    onChange={handleImageSelect}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    shape="square"
                    icon={<Paperclip />}
                    aria-label="Attach image"
                    title="Attach image"
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label="Reply"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        block.blockedByMe ? "Messaging disabled" : imageFile ? "Add a caption (optional)" : "Type a reply"
                      }
                      disabled={block.blockedByMe}
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<PaperPlaneRight />}
                    loading={isSending}
                    disabled={(!replyText.trim() && !imageFile) || isSending || block.blockedByMe}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyNote title="Select a conversation">Choose someone on the left to read and reply.</EmptyNote>
            </div>
          )}
        </div>

        {/* Right column: who you are talking to */}
        {activeChat && (
          <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-kumo-line p-4 xl:block">
            <h3 className="text-sm font-semibold text-kumo-default">Details</h3>
            <Person name={activeDisplayName} detail={activeKind} image={activeOtherUser?.avatarUrl} />
            <dl className="space-y-3">
              {activeTenant?.unitId && <Fact label="Unit">{activeTenant.unitId}</Fact>}
              <Fact label="Account">
                {activeSuspended ? <span className="font-semibold text-kumo-danger">Suspended</span> : "Active"}
              </Fact>
              <Fact label="Messages loaded">{messages.length}</Fact>
            </dl>

            {activeChat.areaSlot && (
              <section className="space-y-3 rounded-lg border border-kumo-line p-3">
                <h4 className="text-sm font-semibold text-kumo-default">Space asked about</h4>
                <dl className="space-y-3">
                  <Fact label="Unit">{activeChat.areaSlot.unit_id}</Fact>
                  <Fact label="Size">{activeChat.areaSlot.sqm_size} sqm</Fact>
                </dl>
                <Link href="/admindashboard/rent-requests" className="block text-sm font-medium text-kumo-link hover:underline">
                  Go to Rent Requests
                </Link>
              </section>
            )}
          </aside>
        )}
      </div>

      <AdminDialog open={!!lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} size="lg" title="Image">
        {lightboxImageUrl && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={optimizedImage(lightboxImageUrl, 2000)} alt="Full preview" className="max-h-[65vh] w-full rounded-lg object-contain" />
            <a href={lightboxImageUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-kumo-link hover:underline">
              Open original
            </a>
          </div>
        )}
      </AdminDialog>

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

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-recessed text-sm font-semibold text-kumo-default"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={optimizedImage(src, 96)} alt="" className="size-full object-cover" /> : (name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-kumo-subtle">{label}</dt>
      <dd className="text-sm text-kumo-default">{children}</dd>
    </div>
  );
}

export default function MessengerHub() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader />
        </div>
      }
    >
      <MessengerHubContent />
    </Suspense>
  );
}
