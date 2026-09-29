"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  MoreVertical,
  Send,
  ShieldAlert,
  CheckCircle,
  Ban,
  MessageSquare,
  Loader2,
  Paperclip,
  X,
  ExternalLink,
  Maximize2,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { refreshChatUnread, setViewingChats } from "@/lib/chat-unread";
import clsx from "clsx";
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

export default function CustomerMessenger() {
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
  const [filter, setFilter] = useState("All");
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
      const data = await getTenantConversations(user.id);

      // If Admin is missing, fetch and inject
      const hasAdmin = data.some((c) => c.type === "ADMIN");
      if (!hasAdmin) {
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
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
    // Conversation previews refresh every 15s; live messages arrive through
    // Supabase Realtime instead of hammering this endpoint.
    const interval = setInterval(fetchConversations, 15000);
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

  return (
    <div className="h-screen flex flex-col pt-4 sm:pt-6 lg:pt-10 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 animate-fade-in-up">
      <div className="mb-4 sm:mb-6 flex items-end justify-between shrink-0">
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest mb-1">
            Communication
          </p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-charcoal dark:text-white tracking-tight">
            Customer Messenger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Direct communication with customers and Mall Admin.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 flex overflow-hidden relative">
        {/* Left Column (Inbox) */}
        <div
          className={`${
            activeChat ? "hidden lg:flex" : "flex"
          } w-full lg:w-80 border-r border-slate-100 dark:border-white/5 flex-col bg-slate-50/50 dark:bg-zinc-900`}
        >
          <div className="p-4 lg:p-5 border-b border-slate-100 dark:border-white/5 space-y-3 lg:space-y-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 lg:pl-10 pr-4 py-2 lg:py-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="p-6 lg:p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                {searchQuery ? "No matching conversations" : "No active conversations"}
              </div>
            )}
            {filteredConversations.map((chat) => {
              const isSelected = activeChat?.id === chat.id;
              // The open chat is being read right now: never badge it.
              const unread = isSelected ? 0 : chat.unreadCount || 0;
              const otherPerson = getOtherPerson(chat);
              const isToAdmin = otherPerson?.role === "ADMIN" || chat.type === "ADMIN";
              const lastMsg =
                chat.messages?.[0]?.imageUrl && !chat.messages?.[0]?.content
                  ? "📷 Image"
                  : chat.messages?.[0]?.content || "Started a conversation";

              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChat(chat);
                    setConversations((prev) =>
                      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)),
                    );
                    isNearBottomRef.current = true;
                    if (messagesCacheRef.current[chat.id]) {
                      setMessages(normalizeMessages(messagesCacheRef.current[chat.id]));
                    } else {
                      setMessages([]);
                    }
                  }}
                  className={clsx(
                    "p-4 lg:p-5 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors flex items-center gap-3 border-l-4",
                    isSelected
                      ? "bg-primary/5 dark:bg-primary/10 border-l-primary"
                      : "hover:bg-white dark:hover:bg-zinc-800/50 border-l-transparent"
                  )}
                >
                  <div
                    className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-100 dark:border-white/5",
                      isToAdmin
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-blue-500/10 text-blue-500"
                    )}
                  >
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (otherPerson?.name || otherPerson?.email || "?")
                        .substring(0, 2)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4
                        className={clsx(
                          "text-xs lg:text-sm text-charcoal dark:text-white truncate",
                          unread > 0 ? "font-black" : "font-bold",
                        )}
                      >
                        {otherPerson?.name || otherPerson?.email}
                      </h4>
                      <span
                        className={clsx(
                          "text-[9px] font-bold uppercase shrink-0",
                          unread > 0 ? "text-primary" : "text-slate-400",
                        )}
                      >
                        {formatConversationTime(chat.messages?.[0]?.createdAt || chat.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1 lg:mb-2">
                      <span
                        className={clsx(
                          "text-[8px] lg:text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                          isToAdmin
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20"
                            : "bg-slate-100 text-slate-500 dark:bg-zinc-800"
                        )}
                      >
                        {isToAdmin ? "SR Mall Admin" : "Customer"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p
                        className={clsx(
                          "flex-1 text-xs truncate",
                          unread > 0
                            ? "text-charcoal dark:text-white font-bold"
                            : "text-slate-500 font-medium",
                        )}
                      >
                        {lastMsg}
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
            })}
          </div>
        </div>

        {/* Chat Window/Active Chat */}
        <div
          className={clsx(
            activeChat ? "flex" : "hidden lg:flex",
            "flex-1 flex-col bg-white dark:bg-zinc-950"
          )}
        >
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
              <MessageSquare size={48} className="opacity-20" />
              <p className="font-bold text-sm tracking-widest uppercase">
                Select a chat to begin
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-row overflow-hidden">
              {(() => {
                const otherPerson = getOtherPerson(activeChat);
                const isToAdmin = otherPerson?.role === "ADMIN" || activeChat.type === "ADMIN";
                const myId = user?.id;

                return (
                  <>
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Chat Header */}
                      <div className="h-14 lg:h-16 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 shrink-0 bg-white dark:bg-zinc-900/50 backdrop-blur-md">
                        <div className="flex items-center gap-2 lg:gap-3">
                          <button
                            onClick={() => setActiveChat(null)}
                            className="p-2 -ml-2 text-slate-400 hover:text-charcoal dark:hover:text-white transition-colors lg:hidden"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m15 18-6-6 6-6" />
                            </svg>
                          </button>

                          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                            {otherPerson?.avatarUrl ? (
                              <img
                                src={otherPerson.avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-primary">
                                {(otherPerson?.name || otherPerson?.email || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col leading-tight">
                            <h3 className="font-bold text-charcoal dark:text-white flex items-center gap-2 text-sm lg:text-base">
                              {otherPerson?.name || otherPerson?.email || "SR Mall Member"}
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            </h3>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden xs:block">
                              {isToAdmin ? "Portal Administrator" : "Active Customer"}
                            </span>
                          </div>
                        </div>
                        {canBlockActive && (
                          <BlockToggleButton
                            blocked={block.blockedByMe}
                            onClick={() => setConfirmBlock(true)}
                          />
                        )}
                      </div>

                      {/* Messages Area */}
                      <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6 bg-slate-50/30 dark:bg-black/20 custom-scrollbar"
                      >
                        {messages.map((msg: any, index: number) => {
                          const isMyMsg =
                            (myId && msg.senderId === myId) ||
                            (user?.email && msg.sender?.email?.toLowerCase() === user.email.toLowerCase());
                          const senderAvatar = isMyMsg
                            ? user?.avatarUrl
                            : otherPerson?.avatarUrl;
                          const senderName = isMyMsg
                            ? user?.name
                            : otherPerson?.name || otherPerson?.email;
                          const isTemporary = String(msg.id).startsWith("temp-");

                          return (
                            <React.Fragment key={msg.id}>
                            {startsNewDay(messages[index - 1]?.createdAt, msg.createdAt) && (
                              <ChatDaySeparator date={msg.createdAt} />
                            )}
                            <div
                              className={clsx(
                                "flex gap-3 items-end animate-fade-in group group/msg relative",
                                isMyMsg ? "justify-end" : "justify-start"
                              )}
                            >
                              {isMyMsg && !isTemporary && (
                                <UnsendButton onClick={() => setUnsendTarget(msg)} />
                              )}
                              {!isMyMsg && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                                  {senderAvatar ? (
                                    <img
                                      src={senderAvatar}
                                      alt="Sender"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      {(senderName || "?")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div
                                className={clsx(
                                  "flex flex-col",
                                  isMyMsg ? "items-end" : "items-start"
                                )}
                              >
                                <div className="relative group/bubble">
                                  <div
                                    className={clsx(
                                      "max-w-[280px] sm:max-w-[400px] lg:max-w-[500px] border rounded-2xl px-4 py-2.5 lg:px-5 lg:py-3 shadow-sm",
                                      isMyMsg
                                        ? "bg-primary text-white border-primary rounded-tr-sm"
                                        : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-white/10 rounded-tl-sm text-slate-600 dark:text-slate-300"
                                    )}
                                  >
                                    {msg.imageUrl && (
                                      <div className="mb-2 relative rounded-xl overflow-hidden group/img cursor-pointer">
                                        <img
                                          src={msg.imageUrl}
                                          alt="Attachment"
                                          onClick={() => setLightboxImageUrl(msg.imageUrl)}
                                          className="rounded-xl max-w-full max-h-64 object-cover border border-white/10 hover:opacity-95 transition-opacity"
                                          loading="lazy"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setLightboxImageUrl(msg.imageUrl)}
                                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                                        >
                                          <Maximize2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                    {msg.content && (
                                      <p className="text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">
                                        {msg.content}
                                      </p>
                                    )}
                                    </div>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 lg:mt-2">
                                  {isTemporary && msg.failed ? (
                                    <button
                                      type="button"
                                      onClick={() => retryMessage(msg)}
                                      className="text-red-500 hover:text-red-600 hover:underline"
                                    >
                                      Not sent · Tap to retry
                                    </button>
                                  ) : isTemporary && msg.sending ? (
                                    "Sending…"
                                  ) : (
                                    formatMessageTime(msg.createdAt)
                                  )}
                                </span>
                              </div>
                              {isMyMsg && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                                  {senderAvatar ? (
                                    <img
                                      src={senderAvatar}
                                      alt="Sender"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      {(senderName || "?")
                                        .substring(0, 2)
                                        .toUpperCase()}
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

                      {canBlockActive && block.blockedByMe && (
                        <BlockedBanner text="You blocked this customer. Unblock them to continue the conversation." />
                      )}

                      {/* Message Input */}
                      <div className="p-3 lg:p-5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 shrink-0">
                        {/* Image Preview */}
                        {imagePreview && (
                          <div className="mb-3 relative inline-block animate-fade-in">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="h-20 rounded-xl border border-slate-200 dark:border-white/10 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setImagePreview(null);
                                setImageFile(null);
                                setFileInputKey((k) => k + 1);
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        <form
                          onSubmit={handleSend}
                          className="relative flex items-center bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 p-1.5 pr-2 focus-within:border-primary transition-colors hover:border-slate-300"
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
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={
                              canBlockActive && block.blockedByMe
                                ? "Messaging disabled"
                                : imageFile
                                  ? "Add a caption... (optional)"
                                  : "Reply..."
                            }
                            disabled={canBlockActive && block.blockedByMe}
                            className="flex-1 px-2 lg:px-3 py-1.5 lg:py-2 bg-transparent outline-none text-sm font-medium dark:text-white disabled:opacity-40"
                          />
                          <button
                            type="submit"
                            disabled={(!inputText.trim() && !imageFile) || isUploading || (canBlockActive && block.blockedByMe)}
                            className="p-2 lg:p-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
                          >
                            {isUploading ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} className="lg:w-4 lg:h-4" />
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Right Column (Context Panel) */}
                    <div className="hidden xl:block w-72 border-l border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900 overflow-y-auto">
                      <div className="p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                          <MoreVertical size={14} /> Interaction Context
                        </h3>

                        <div className="space-y-6">
                          {/* Profile Card */}
                          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 font-bold text-2xl flex items-center justify-center mb-3 overflow-hidden border border-slate-100 dark:border-white/5">
                              {otherPerson?.avatarUrl ? (
                                <img
                                  src={otherPerson.avatarUrl}
                                  alt="Avatar"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (otherPerson?.name || otherPerson?.email || "?")
                                  .charAt(0)
                                  .toUpperCase()
                              )}
                            </div>
                            <h4 className="font-bold text-charcoal dark:text-white">
                              {otherPerson?.name || otherPerson?.email || "SR Mall Member"}
                            </h4>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                              {isToAdmin ? "Portal Administrator" : "Chat Participant"}
                            </p>
                          </div>

                          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                              Notice
                            </h4>
                            <p className="text-xs font-medium text-slate-500 mb-4">
                              Please respond to inquiries promptly. Quick replies boost the shop reliability score on the public page.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
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
