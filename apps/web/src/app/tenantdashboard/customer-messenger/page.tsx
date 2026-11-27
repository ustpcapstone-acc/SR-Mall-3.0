"use client";

import { optimizedImage } from "@/lib/media";
import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, cn } from "@cloudflare/kumo";
import { ArrowLeft, PaperPlaneRight, Paperclip } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, SearchField } from "@/components/admin/page-kit";
import { useAuth } from "@/app/providers";
import { ChatAvatar, ChatImage, bubblePadding } from "@/components/chat/chat-media";
import { refreshChatUnread, setViewingChats } from "@/lib/chat-unread";
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

/**
 * ?inbox=mall    -> chats with the mall office (Home workspace)
 * ?inbox=customers -> chats with shoppers (space workspace)
 * no parameter   -> everything (links from notifications)
 */
type Inbox = "mall" | "customers" | "all";

export default function CustomerMessengerPage() {
  return (
    <Suspense fallback={null}>
      <InboxRoute />
    </Suspense>
  );
}

function InboxRoute() {
  const param = useSearchParams().get("inbox");
  const inbox: Inbox = param === "mall" || param === "customers" ? param : "all";
  return <CustomerMessenger key={inbox} inbox={inbox} />;
}

function CustomerMessenger({ inbox }: { inbox: Inbox }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const activeChatIdRef = useRef<string | null>(null);
  const pendingConversationRef = useRef<string | null>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversationId") : null,
  );
  const messagesCacheRef = useRef<Record<string, any[]>>({});
  const activeChatRef = useRef<any>(null);
  /** Files of still-sending bubbles, so a failed image send can be retried. */
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const loadingOlderRef = useRef(false);

  // Realtime + pagination state
  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] =
    useState<ChatRealtimeStatus>("connecting");
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  // One unfinished reply per conversation. Text that failed to send stays in the
  // draft until it goes through.
  const thread: string | null = activeChat ? (activeChat.type === "ADMIN" ? "mall" : activeChat.id) : null;
  const [unsent, setUnsent] = useState<{ thread: string | null; tempId: string; text: string } | null>(null);
  const lastThread = useRef<string | null>(null);
  useEffect(() => {
    if (!thread || lastThread.current === thread) return;
    if (lastThread.current) setInputText("");
    lastThread.current = thread;
  }, [thread]);
  const draft = useDraft({
    form: "tenant.chat",
    workspace: true,
    scope: [thread],
    enabled: Boolean(thread),
    value: { text: inputText || (unsent?.thread === thread ? unsent.text : "") },
    initial: { text: "" },
    onRestore: (saved) => {
      setUnsent(null);
      setInputText(saved.text);
    },
  });

  activeChatIdRef.current = activeChat?.id || null;
  activeChatRef.current = activeChat;

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
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

  // Poll for tenant conversations
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { getTenantConversations, getPortalAdminAction } =
        await import("@/app/actions/chat-queries");
      const all = await getTenantConversations(user.id);
      const data =
        inbox === "all" ? all : all.filter((c) => (c.type === "ADMIN") === (inbox === "mall"));

      // If Admin is missing, fetch and inject
      const hasAdmin = data.some((c) => c.type === "ADMIN");
      if (!hasAdmin && inbox !== "customers") {
        const admin = await getPortalAdminAction();
        if (admin) {
          data.unshift({
            id: `new-admin-${admin.id}`,
            type: "ADMIN",
            userId: user.id,
            targetId: admin.id,
            target: admin as any,
            updatedAt: new Date(),
            messages: [],
            isVirtual: true,
          } as any);
        }
      }

      setConversations(data);

      // Opened from a notification / toast: ?conversationId=… selects that chat once.
      const wanted = pendingConversationRef.current;
      if (wanted) {
        const match = data.find((c: any) => c.id === wanted || c.allConversationIds?.includes(wanted));
        if (match) {
          pendingConversationRef.current = null;
          setActiveChat(match);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tenant conversations:", err);
    }
  }, [user?.id, inbox]);

  useEffect(() => {
    fetchConversations();
    // Conversation previews refresh every 15s; live messages arrive through
    // Supabase Realtime instead of hammering this endpoint.
    const interval = setInterval(() => {
      if (!document.hidden) fetchConversations();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // A message in any conversation (including ones not in the list yet) pushes
  // a debounced list refresh, so new chats appear without waiting for the poll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToInbox(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void fetchConversations(), 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [fetchConversations]);

  // A toast / bell click while this page is open → switch to that chat.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent).detail?.conversationId;
      if (!id) return;
      pendingConversationRef.current = id;
      void fetchConversations();
    };
    window.addEventListener("open-chat-conversation", onOpen);
    return () => window.removeEventListener("open-chat-conversation", onOpen);
  }, [fetchConversations]);

  // Latest page of the active chat (and older pages on scroll-up).
  const fetchMessages = useCallback(
    async (
      currentChatId: string,
      shouldScroll = false,
      page?: { before: string; beforeId: string },
    ) => {
      try {
        const { getMessagesByConversation } =
          await import("@/app/actions/chat-queries");
        const allIds = activeChatRef.current?.allConversationIds;

        if (page) {
          // Older page → merge above what is already on screen.
          const container = messagesContainerRef.current;
          const previousHeight = container?.scrollHeight ?? 0;
          const history = await getMessagesByConversation(currentChatId, allIds, {
            limit: MESSAGE_PAGE_SIZE,
            before: page.before,
            beforeId: page.beforeId,
          });

          if (activeChatIdRef.current !== currentChatId) return;
          if (history.length < MESSAGE_PAGE_SIZE) setHasOlderMessages(false);

          setMessages((prev) => prependOlderMessages(prev, history));
          if (container) {
            requestAnimationFrame(() => {
              container.scrollTop += container.scrollHeight - previousHeight;
            });
          }
          return;
        }

        const history = await getMessagesByConversation(currentChatId, allIds, {
          limit: MESSAGE_PAGE_SIZE,
        });
        messagesCacheRef.current[currentChatId] = history;
        setHasOlderMessages(history.length >= MESSAGE_PAGE_SIZE);

        const ids = conversationIdsOf(history, currentChatId);
        setConversationIds((prev) =>
          conversationKey(prev) === conversationKey(ids) ? prev : ids,
        );

        if (activeChatIdRef.current === currentChatId) {
          setMessages((prev) => mergeFetchedMessages(prev, history));

          if (shouldScroll || isNearBottomRef.current) scrollToEnd();
        }
      } catch (err) {
        console.error("Failed to fetch active chat messages:", err);
      }
    },
    [],
  );

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlderMessages) return;
    const chatId = activeChatIdRef.current;
    if (!chatId) return;

    const oldest = messages.find((m) => !isOptimistic(m));
    if (!oldest) return;

    loadingOlderRef.current = true;
    try {
      await fetchMessages(chatId, false, {
        before: new Date(oldest.createdAt).toISOString(),
        beforeId: String(oldest.id),
      });
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      loadingOlderRef.current = false;
    }
  }, [fetchMessages, hasOlderMessages, messages]);

  useEffect(() => {
    if (!activeChat?.id) {
      setMessages([]);
      setConversationIds([]);
      return;
    }

    const currentChatId = activeChat.id;
    const chat = activeChatRef.current;
    setHasOlderMessages(true);
    const baseIds =
      chat?.allConversationIds?.length ? chat.allConversationIds : [currentChatId];
    setConversationIds((prev) =>
      conversationKey(prev) === conversationKey(baseIds) ? prev : baseIds,
    );

    if (messagesCacheRef.current[currentChatId]) {
      setMessages(normalizeMessages(messagesCacheRef.current[currentChatId]));
    }
    fetchMessages(currentChatId, true);
  }, [activeChat?.id, fetchMessages]);

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
    if (!activeChat?.id || realtimeStatus === "subscribed") return;
    const interval = setInterval(() => {
      void fetchMessages(activeChat.id, false);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeChat?.id, realtimeStatus, fetchMessages]);

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
    if (!activeChat || !user?.email) return;

    const isToAdmin = activeChat.type === "ADMIN";

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

      const { replyToConversation } = await import("@/app/actions/chat-queries");
      const { sendMessage } = await import("@/app/actions/chat");

      if (activeChat.isVirtual) {
        const res: any = await sendMessage({
          userId: user.email,
          recipientType: "admin",
          content: payload.content,
          imageUrl: uploadedImageUrl || undefined,
        });
        if (res && !res.success && res.error) {
          toast.error(res.error);
          setMessages((prev) => markOptimisticFailed(prev, payload.tempId));
          return;
        }
        pendingFilesRef.current.delete(payload.tempId);
        setUnsent((current) => (current?.tempId === payload.tempId ? null : current));
        if (res?.message) {
          setMessages((prev) => replaceOptimistic(prev, payload.tempId, res.message));
        }

        // Brand-new conversation → load the list and switch to the real chat.
        const { getTenantConversations } = await import("@/app/actions/chat-queries");
        const data = await getTenantConversations(user.id);
        setConversations(data);
        const newRealChat = data.find((c: any) => c.type === "ADMIN");
        if (newRealChat) setActiveChat(newRealChat);
        return;
      }

      const res: any = await replyToConversation(
        activeChat.id,
        !isToAdmin,
        payload.content,
        uploadedImageUrl || undefined,
        user.id,
      );
      if (res && !res.success && res.error) {
        toast.error(res.error);
        setMessages((prev) => markOptimisticFailed(prev, payload.tempId));
        return;
      }

      pendingFilesRef.current.delete(payload.tempId);
      setUnsent((current) => (current?.tempId === payload.tempId ? null : current));
      // Swap temp-… for the real row (same id the realtime event carries).
      if (res?.message) {
        setMessages((prev) => replaceOptimistic(prev, payload.tempId, res.message));
      }
    } catch (err) {
      console.error("Failed to send:", err);
      setMessages((prev) => markOptimisticFailed(prev, payload.tempId));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !imageFile) || !activeChat) return;
    if (isOffline()) {
      draft.flush();
      toast.error("You're offline. Your message is kept here. Send it when you're back online.");
      return;
    }

    const textToSend = inputText;
    const fileToSend = imageFile;
    const previewToSend = imagePreview;

    // Reset input fields immediately
    setInputText("");
    setImageFile(null);
    setImagePreview(null);
    setFileInputKey((k) => k + 1);

    const isToAdmin = activeChat.type === "ADMIN";
    const myId = user?.id || (isToAdmin ? activeChat.userId : activeChat.targetId);

    // Instant Optimistic Update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const contentToSend = textToSend || "📎 Image";
    setUnsent({ thread, tempId, text: textToSend });
    setMessages((prev) =>
      normalizeMessages([
        ...prev,
        {
          id: tempId,
          content: contentToSend,
          imageUrl: previewToSend,
          senderId: myId,
          conversationId: activeChat.id,
          sender: {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            avatarUrl: user?.avatarUrl,
          },
          createdAt: new Date(),
          sending: true,
        },
      ]),
    );

    isNearBottomRef.current = true;
    scrollToEnd();

    if (fileToSend) pendingFilesRef.current.set(tempId, fileToSend);

    await persistMessage({
      tempId,
      content: contentToSend,
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



  // The open conversation counts as read (also when new messages arrive).
  const activeChatReadIds: string[] = activeChat
    ? activeChat.allConversationIds || [activeChat.id]
    : [];
  const activeReadKey = activeChatReadIds.join("|");
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

  const activeOther =
    activeChat && (activeChat.userId === user?.id ? activeChat.target : activeChat.user);
  const canBlockActive = Boolean(activeOther && activeOther.role !== "ADMIN" && activeChat?.type !== "ADMIN");
  const block = useChatBlock(user?.id, canBlockActive ? activeOther?.id : null);
  const [confirmBlock, setConfirmBlock] = useState(false);

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

  const getOtherPerson = (chat: any) => {
    if (!chat) return null;
    if (chat.userId === user?.id) return chat.target;
    if (chat.targetId === user?.id) return chat.user;
    return chat.user?.role === "TENANT" ? chat.target : chat.user;
  };

  const filteredConversations = conversations.filter((chat) => {
    const otherPerson = getOtherPerson(chat);
    if (!otherPerson) return false;
    const name = (otherPerson.name || "").toLowerCase();
    const email = (otherPerson.email || "").toLowerCase();
    const lastMsg = (chat.messages?.[0]?.content || "Started a conversation").toLowerCase();
    const query = searchQuery.toLowerCase();

    return name.includes(query) || email.includes(query) || lastMsg.includes(query);
  });

  const openChat = (chat: any) => {
    setActiveChat(chat);
    setConversations((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));
    isNearBottomRef.current = true;
    if (messagesCacheRef.current[chat.id]) {
      setMessages(normalizeMessages(messagesCacheRef.current[chat.id]));
    } else {
      setMessages([]);
    }
  };

  const otherPerson = getOtherPerson(activeChat);
  const toAdmin = otherPerson?.role === "ADMIN" || activeChat?.type === "ADMIN";
  const activeName = otherPerson?.name || otherPerson?.email || "SR Mall member";
  const activeKind = toAdmin ? "SR Mall office" : "Shopper";
  const blocked = canBlockActive && block.blockedByMe;
  const avatarOf = (url?: string | null) => (url ? optimizedImage(url, 96) : null);

  return (
    // Fills the space under the top bar, so only the message lists scroll.
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-3 p-3 sm:h-[calc(100dvh-5rem)] sm:gap-4 sm:p-6">
      <header className={cn("shrink-0", activeChat && "hidden lg:block")}>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kumo-default sm:text-3xl">
          {inbox === "mall" ? "Mall Office Messages" : inbox === "customers" ? "Customer Messages" : "Messages"}
        </h1>
        <p className="mt-1 text-sm text-kumo-subtle">
          {inbox === "mall"
            ? "Your conversation with the SR Mall management office."
            : inbox === "customers"
              ? "Chats with shoppers about your store."
              : "Chats with shoppers and the mall office."}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
        {/* Left column: inbox */}
        <div className={cn("w-full min-w-0 flex-col border-kumo-line lg:flex lg:w-80 lg:shrink-0 lg:border-r", activeChat ? "hidden" : "flex")}>
          <div className="border-b border-kumo-line p-3">
            <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search conversations" className="sm:w-full" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <EmptyNote title={searchQuery ? "No matching conversations" : "No conversations yet"}>
                {!searchQuery && inbox === "customers" ? "Messages from shoppers appear here." : undefined}
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-kumo-line">
                {filteredConversations.map((chat) => {
                  const selected = activeChat?.id === chat.id;
                  // The open chat is being read right now: never badge it.
                  const unread = selected ? 0 : chat.unreadCount || 0;
                  const person = getOtherPerson(chat);
                  const isOffice = person?.role === "ADMIN" || chat.type === "ADMIN";
                  const name = person?.name || person?.email || "SR Mall member";
                  const lastMsg =
                    chat.messages?.[0]?.imageUrl && !chat.messages?.[0]?.content
                      ? "Image"
                      : chat.messages?.[0]?.content || "No messages yet";

                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => openChat(chat)}
                        aria-current={selected}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 border-l-4 p-3 text-left hover:bg-kumo-tint",
                          selected ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent",
                        )}
                      >
                        <Avatar name={name} src={avatarOf(person?.avatarUrl)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("truncate text-sm text-kumo-default", unread > 0 ? "font-semibold" : "font-medium")}>
                              {name}
                            </span>
                            <span className={cn("shrink-0 text-xs", unread > 0 ? "font-semibold text-kumo-brand" : "text-kumo-subtle")}>
                              {formatConversationTime(chat.messages?.[0]?.createdAt || chat.updatedAt)}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-kumo-subtle">{isOffice ? "SR Mall office" : "Shopper"}</span>
                          <span className="flex items-center gap-2">
                            <span className={cn("flex-1 truncate text-sm", unread > 0 ? "font-medium text-kumo-default" : "text-kumo-subtle")}>
                              {lastMsg}
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

        {/* Conversation */}
        <div className={cn("min-w-0 flex-1 flex-col lg:flex", activeChat ? "flex" : "hidden")}>
          {!activeChat ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyNote title="Select a conversation">Choose someone on the left to read and reply.</EmptyNote>
            </div>
          ) : (
            <>
              <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-kumo-line px-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="lg:hidden">
                    <Button variant="ghost" shape="square" icon={<ArrowLeft />} aria-label="All conversations" onClick={() => setActiveChat(null)} />
                  </div>
                  <Avatar name={activeName} src={avatarOf(otherPerson?.avatarUrl)} />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-kumo-default">{activeName}</h2>
                    <p className="truncate text-sm text-kumo-subtle">{activeKind}</p>
                  </div>
                </div>
                {canBlockActive && <BlockToggleButton blocked={block.blockedByMe} onClick={() => setConfirmBlock(true)} />}
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-kumo-recessed p-3 sm:p-6"
              >
                {messages.length === 0 && <EmptyNote title="No messages yet">Send a message below to start the conversation.</EmptyNote>}
                {messages.map((msg: any, index: number) => {
                  const isMine =
                    (user?.id && msg.senderId === user.id) ||
                    (user?.email && msg.sender?.email?.toLowerCase() === user.email.toLowerCase());
                  const senderAvatar = isMine ? user?.avatarUrl : otherPerson?.avatarUrl;
                  const senderName = isMine ? user?.name : otherPerson?.name || otherPerson?.email;
                  const isTemporary = String(msg.id).startsWith("temp-");

                  return (
                    <React.Fragment key={msg.id}>
                      {startsNewDay(messages[index - 1]?.createdAt, msg.createdAt) && <ChatDaySeparator date={msg.createdAt} />}
                      <div className={cn("group group/msg relative flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                        {isMine && !isTemporary && <UnsendButton onClick={() => setUnsendTarget(msg)} />}
                        {!isMine && <ChatAvatar src={optimizedImage(senderAvatar ?? undefined, 96)} name={senderName} />}
                        <div className={cn("flex min-w-0 flex-col", isMine ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "max-w-[240px] rounded-lg sm:max-w-[400px] lg:max-w-[500px]",
                              bubblePadding(msg),
                              isMine ? "bg-kumo-brand text-white" : "border border-kumo-line bg-kumo-base text-kumo-default",
                            )}
                          >
                            {msg.imageUrl && (
                              <div className={msg.content ? "mb-2" : ""}>
                                <ChatImage url={msg.imageUrl} onOpen={setLightboxImageUrl} />
                              </div>
                            )}
                            {msg.content && <p className="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>}
                          </div>
                          <div className="mt-1 px-1">
                            {isTemporary && msg.failed ? (
                              <button
                                type="button"
                                onClick={() => retryMessage(msg)}
                                className="cursor-pointer text-xs font-semibold text-kumo-danger hover:underline"
                              >
                                Not sent. Tap to retry
                              </button>
                            ) : (
                              <span className="text-xs text-kumo-subtle">
                                {isTemporary && msg.sending ? "Sending..." : formatMessageTime(msg.createdAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isMine && <ChatAvatar src={optimizedImage(senderAvatar ?? undefined, 96)} name={senderName} />}
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {blocked && <BlockedBanner text="You blocked this customer. Unblock them to continue the conversation." />}

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
                <form onSubmit={handleSend} className="flex items-center gap-2">
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
                    disabled={blocked}
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label="Message"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={blocked ? "Messaging disabled" : imageFile ? "Add a caption (optional)" : "Type a reply"}
                      disabled={blocked}
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<PaperPlaneRight />}
                    loading={isUploading}
                    aria-label="Send"
                    disabled={(!inputText.trim() && !imageFile) || isUploading || blocked}
                  >
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
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
          title={block.blockedByMe ? "Unblock this customer?" : "Block this customer?"}
          message={
            block.blockedByMe
              ? "They will be able to message your shop again."
              : "They won't be able to send your shop messages until you unblock them."
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
      {src ? <img src={src} alt="" className="size-full object-cover" /> : name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
