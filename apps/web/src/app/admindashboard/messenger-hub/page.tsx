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
import { markMessageNotificationsAsReadAction } from "@/app/actions/notification";
import { useAuth } from "@/app/providers";

const FILTER_TABS = ["All", "Tenant Messages", "Customer Chat Messages", "Unread"] as const;

function formatTimestamp(dateInput: string | Date | undefined) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

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
        if (queryConversationId && data.some((c) => c.id === queryConversationId)) {
          return queryConversationId;
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
    const interval = setInterval(() => fetchConversations(false), 4000);

    if (user) {
      markMessageNotificationsAsReadAction(user.id);
    }

    return () => clearInterval(interval);
  }, [user, fetchConversations]);

  const fetchMessages = useCallback(async (idToFetch: string, shouldScroll = false) => {
    try {
      const activeObj = conversationsRef.current.find((c) => c.id === idToFetch);
      const msgs = await getMessagesByConversation(idToFetch, activeObj?.allConversationIds);
      messagesCacheRef.current[idToFetch] = msgs;

      if (activeChatIdRef.current === idToFetch) {
        setMessages((prev) => {
          const hasOptimistic = prev.some((p) => String(p.id).startsWith("temp-"));
          if (
            !hasOptimistic &&
            prev.length === msgs.length &&
            prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id
          ) {
            return prev;
          }
          const pendingOptimistic = prev.filter(
            (p) =>
              String(p.id).startsWith("temp-") &&
              !msgs.some(
                (m: any) =>
                  (m.content === p.content && m.senderId === p.senderId) ||
                  m.id === p.id
              )
          );
          return [...msgs, ...pendingOptimistic];
        });

        if (shouldScroll || isNearBottomRef.current) {
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, []);

  useEffect(() => {
    if (activeChatId) {
      const currentId = activeChatId;
      if (!messagesCacheRef.current[currentId]) {
        setLoadingMessages(true);
      }
      fetchMessages(currentId, true).finally(() => setLoadingMessages(false));
      const interval = setInterval(() => fetchMessages(currentId, false), 3000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [activeChatId, fetchMessages]);

  const handleSelectChat = (chat: any) => {
    if (chat.id === activeChatId) return;
    setActiveChatId(chat.id);
    isNearBottomRef.current = true;

    // Messenger-like instantaneous switch: display cached messages immediately with 0 delay!
    if (messagesCacheRef.current[chat.id]) {
      setMessages(messagesCacheRef.current[chat.id]);
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
    const tempId = `temp-${Date.now()}`;
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
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    setIsSending(true);

    try {
      let uploadedImageUrl: string | null = null;
      if (fileToSend) {
        uploadedImageUrl = await uploadImageToCloudinary(fileToSend);
      }

      const res = await replyToConversation(
        activeChatId,
        true,
        textToSend,
        uploadedImageUrl || undefined,
        user?.id
      );

      if (res.success) {
        if (res.conversationId && res.conversationId !== activeChatId) {
          setActiveChatId(res.conversationId);
          fetchMessages(res.conversationId, false);
        } else {
          fetchMessages(activeChatId, false);
        }
        fetchConversations(false);
      } else if (res.error) {
        alert(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
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
      if (filter === "Unread") return c.messages[0]?.senderId !== user?.id;
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
                        <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white" title="User Blocked">
                          <Ban size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-charcoal dark:text-white truncate">
                          {displayName}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 ml-1">
                          {formatTimestamp(chat.updatedAt)}
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
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {chat.messages[0]?.imageUrl && !chat.messages[0]?.content
                          ? "📷 Attached Image"
                          : chat.messages[0]?.content || "Started a transmission"}
                      </p>
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
                  messages.map((msg) => {
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
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          isFromAdmin ? "justify-end" : "justify-start"
                        } items-end animate-fade-in group relative`}
                      >
                        {!isFromAdmin && (
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

                        <div className={`flex flex-col ${isFromAdmin ? "items-end" : "items-start"}`}>
                          {/* Unsend Action Button for Admin Messages */}
                          <div className="relative group/bubble">
                            <div
                              className={`max-w-[280px] sm:max-w-[400px] lg:max-w-[500px] px-5 py-3 shadow-sm rounded-2xl relative ${
                                isFromAdmin
                                  ? "bg-primary text-white rounded-tr-sm"
                                  : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-tl-sm"
                              }`}
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
                                    title="View Full Size"
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

                          <div className="flex items-center gap-1.5 mt-1 px-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {formatTimestamp(msg.createdAt)}
                            </span>
                            {isTemporary && (
                              <span className="text-[8px] font-bold text-primary animate-pulse">
                                Sending...
                              </span>
                            )}
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
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

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
                      imageFile ? "Add a caption... (optional)" : "Type a reply..."
                    }
                    className="flex-1 px-3 py-2 bg-transparent outline-none text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={(!replyText.trim() && !imageFile) || isSending}
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
