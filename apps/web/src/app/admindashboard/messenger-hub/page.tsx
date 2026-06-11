"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  MoreVertical,
  Send,
  ShieldAlert,
  Ban,
  MapPin,
  CalendarPlus,
  Loader2,
} from "lucide-react";
import {
  getAdminConversations,
  getMessagesByConversation,
  replyToConversation,
} from "@/app/actions/chat-queries";
import { markMessageNotificationsAsReadAction } from "@/app/actions/notification";
import { useAuth } from "@/app/providers";

export default function MessengerHub() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived active chat object ensures data is always current from the conversations list
  const activeChat = conversations.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    
    // Clear message notifications badge when viewing the messenger
    if (user) {
      markMessageNotificationsAsReadAction(user.id);
    }
    
    return () => clearInterval(interval);
  }, [user]);

  const fetchConversations = async () => {
    setIsRefreshing(true);
    try {
      const data = await getAdminConversations();
      setConversations(data);

      // We use a functional update (currentId => ...) to ensure we always have the 
      // latest state value even inside a setInterval closure.
      setActiveChatId((currentId) => {
        // Only auto-select the first chat if none is currently selected.
        if (!currentId && data.length > 0) {
          return data[0].id;
        }
        return currentId;
      });
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeChatId) {
      const currentId = activeChatId;
      fetchMessages(currentId);
      const interval = setInterval(() => fetchMessages(currentId), 15000);
      return () => clearInterval(interval);
    }
  }, [activeChatId]);

  const fetchMessages = async (idToFetch: string) => {
    const msgs = await getMessagesByConversation(idToFetch);
    setActiveChatId((currentId) => {
      if (currentId === idToFetch) {
        setMessages(msgs);
      }
      return currentId;
    });
  };

  const handleSelectChat = (chat: any) => {
    if (chat.id === activeChatId) return;
    setMessages([]); // Immediately clear messages to prevent misalignment
    setActiveChatId(chat.id);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeChatId || isSending) return;

    setIsSending(true);
    const res = await replyToConversation(activeChatId, true, replyText);
    if (res.success) {
      setReplyText("");
      fetchMessages(activeChatId);
      fetchConversations();
    }
    setIsSending(false);
  };

  const filteredChats = conversations.filter((c) => {
    const searchStr = searchQuery.toLowerCase();
    const matchesSearch =
      (c.user.name || "").toLowerCase().includes(searchStr) ||
      (c.user.email || "").toLowerCase().includes(searchStr) ||
      (c.messages[0]?.content || "").toLowerCase().includes(searchStr);

    if (!matchesSearch) return false;
    if (filter === "All") return true;
    if (filter === "Unread") return c.messages[0]?.senderId !== c.targetId;
    return true;
  });

  return (
    <div className="h-screen flex flex-col pt-10 px-8 pb-8 animate-fade-in-up">
      <div className="mb-6 flex items-end justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-charcoal dark:text-white tracking-tight">
              Messenger Command Hub
            </h1>
            {isRefreshing && <Loader2 size={16} className="animate-spin text-slate-400" />}
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Centralized management for bookings, inquiries, and tenant support.
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
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {["All", "Unread"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filter === f
                    ? "bg-charcoal text-white dark:bg-white dark:text-black"
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
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`p-5 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors flex items-center gap-3 ${activeChat?.id === chat.id
                    ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary"
                    : "hover:bg-white dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                    {chat.user.avatarUrl ? (
                      <img src={chat.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (chat.user.name || chat.user.email).substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-charcoal dark:text-white truncate">
                        {chat.user.name || chat.user.email}
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">
                        {new Date(chat.updatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-zinc-800">
                        {chat.user?.role || "USER"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      {chat.messages[0]?.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Column (Chat Window) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950">
          {activeChat ? (
            <>
              <div className="h-16 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-6 shadow-sm z-10 transition-all">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-charcoal dark:text-white">
                    {activeChat.user.name || activeChat.user.email}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-error dark:text-red-400 hover:bg-error dark:hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition-all border border-red-100 dark:border-red-900/50 shadow-sm active:scale-95">
                    <ShieldAlert size={14} /> Blacklist User
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 dark:bg-black/20">
                {messages.map((msg) => {
                  const isFromAdmin = msg.senderId !== activeChat.userId;
                  const senderAvatar = isFromAdmin ? msg.sender?.avatarUrl || user?.avatarUrl : activeChat.user.avatarUrl;
                  const senderName = isFromAdmin ? msg.sender?.name || "System Admin" : activeChat.user.name || activeChat.user.email;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isFromAdmin ? "justify-end" : "justify-start"} items-end animate-fade-in`}
                    >
                      {!isFromAdmin && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="Sender" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {(senderName || "?").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`flex flex-col ${isFromAdmin ? "items-end" : "items-start"}`}>
                        <div
                          className={`max-w-[280px] sm:max-w-[400px] lg:max-w-[500px] px-5 py-3 shadow-sm rounded-2xl ${isFromAdmin
                            ? "bg-primary text-white rounded-tr-sm"
                            : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-tl-sm"
                            }`}
                        >
                          <p className="text-sm font-medium">{msg.content}</p>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-2 px-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {isFromAdmin && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="Sender" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {(senderName || "?").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900">
                <form
                  onSubmit={handleSendReply}
                  className="relative flex items-center bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 p-1.5 pr-2 focus-within:ring-2 ring-primary/20 transition-all"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a reply..."
                    className="flex-1 px-3 py-2 bg-transparent outline-none text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm"
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
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl uppercase overflow-hidden border border-slate-100 dark:border-white/5">
                      {activeChat.user.avatarUrl ? (
                        <img src={activeChat.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (activeChat.user.name || activeChat.user.email).charAt(0)
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-charcoal dark:text-white truncate max-w-[140px]">
                        {activeChat.user.name || activeChat.user.email}
                      </h4>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">
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
                        Interactions
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-charcoal dark:text-white">
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
    </div>
  );
}
