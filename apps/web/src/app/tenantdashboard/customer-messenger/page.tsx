"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useAuth } from "@/app/providers";
import clsx from "clsx";

export default function CustomerMessenger() {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for tenant conversations
  useEffect(() => {
    if (!user?.id) return;

    const fetchConversations = async () => {
      const { getTenantConversations, getPortalAdminAction } =
        await import("@/app/actions/chat-queries");
      const data = await getTenantConversations(user.id);

      // If Admin is missing, fetch and inject
      const hasAdmin = data.some(c => c.type === "ADMIN");
      if (!hasAdmin) {
        const admin = await getPortalAdminAction();
        if (admin) {
          // Add a "virtual" conversation for the Admin
          data.unshift({
            id: `new-admin-${admin.id}`,
            type: "ADMIN",
            userId: user.id,
            targetId: admin.id,
            target: admin as any,
            updatedAt: new Date(),
            messages: [],
            isVirtual: true // Mark as virtual so we can handle initial message
          } as any);
        }
      }

      setConversations(data);
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [user?.id, activeChat]);

  // Poll for active chat messages
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      const { getMessagesByConversation } =
        await import("@/app/actions/chat-queries");
      const history = await getMessagesByConversation(activeChat.id);
      setMessages(history);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const textToSend = inputText;
    setInputText("");

    const isToAdmin = activeChat.type === "ADMIN";
    const myId = isToAdmin ? activeChat.userId : activeChat.targetId;

    // Optimistic Update
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: textToSend,
        senderId: myId,
        createdAt: new Date(),
      },
    ]);

    const { replyToConversation } = await import("@/app/actions/chat-queries");
    const { sendMessage } = await import("@/app/actions/chat");

    if (activeChat.isVirtual) {
      await sendMessage({
        userId: user!.email!,
        recipientType: "admin",
        content: textToSend,
      });
      // Force refresh conversations immediately
      const { getTenantConversations } = await import("@/app/actions/chat-queries");
      const data = await getTenantConversations(user!.id);
      setConversations(data);
      // Find the real conversation and select it
      const newRealChat = data.find(c => c.type === "ADMIN");
      if (newRealChat) setActiveChat(newRealChat);
    } else {
      await replyToConversation(activeChat.id, true, textToSend);
    }
  };

  const filteredConversations = conversations.filter((chat) => {
    const isToAdmin = chat.type === "ADMIN";
    const otherPerson = isToAdmin ? chat.target : chat.user;
    if (!otherPerson) return false;
    const name = (otherPerson.name || "").toLowerCase();
    const email = (otherPerson.email || "").toLowerCase();
    const lastMsg = (chat.messages?.[0]?.content || "Started a conversation").toLowerCase();
    const query = searchQuery.toLowerCase();

    return name.includes(query) || email.includes(query) || lastMsg.includes(query);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-20 lg:pb-0">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-10 h-[calc(100vh-5rem)] flex flex-col">
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
            className={`${activeChat ? "hidden lg:flex" : "flex"} w-full lg:w-80 border-r border-slate-100 dark:border-white/5 flex-col bg-slate-50/50 dark:bg-zinc-900`}
          >
            <div className="p-4 lg:p-5 border-b border-slate-100 dark:border-white/5 space-y-3 lg:space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 text-slate-400" />
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
                const isToAdmin = chat.type === "ADMIN";
                const otherPerson = isToAdmin ? chat.target : chat.user;
                const lastMsg = chat.messages?.[0]?.content || "Started a conversation";

                return (
                  <div
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
                    className={clsx(
                      "p-4 lg:p-5 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors flex items-center gap-3 border-l-4",
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10 border-l-primary"
                        : "hover:bg-white dark:hover:bg-zinc-800/50 border-l-transparent"
                    )}
                  >
                    <div className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-100 dark:border-white/5",
                      isToAdmin ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {otherPerson.avatarUrl ? (
                        <img src={otherPerson.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (otherPerson.name || otherPerson.email || "?").substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-xs lg:text-sm font-bold text-charcoal dark:text-white truncate">
                          {otherPerson.name || otherPerson.email}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">
                          {new Date(chat.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1 lg:mb-2">
                        <span className={clsx(
                          "text-[8px] lg:text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                          isToAdmin ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20" : "bg-slate-100 text-slate-500 dark:bg-zinc-800"
                        )}>
                          {isToAdmin ? "SR Mall Admin" : "Customer"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate">{lastMsg}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Window/Active Chat */}
          <div className={clsx(activeChat ? "flex" : "hidden lg:flex", "flex-1 flex-col bg-white dark:bg-zinc-950")}>
            {!activeChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <MessageSquare size={48} className="opacity-20" />
                <p className="font-bold text-sm tracking-widest uppercase">Select a chat to begin</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-row overflow-hidden">
                {(() => {
                  const isToAdmin = activeChat.type === "ADMIN";
                  const otherPerson = isToAdmin ? activeChat.target : activeChat.user;
                  const myId = isToAdmin ? activeChat.userId : activeChat.targetId;

                  return (
                    <>
                      <div className="flex-1 flex flex-col min-w-0">
                        {/* Chat Header */}
                        <div className="h-14 lg:h-16 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 shrink-0 bg-white dark:bg-zinc-900/50 backdrop-blur-md">
                          <div className="flex items-center gap-2 lg:gap-3">
                            <button onClick={() => setActiveChat(null)} className="p-2 -ml-2 text-slate-400 hover:text-charcoal dark:hover:text-white transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            </button>

                            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                              {otherPerson?.avatarUrl ? (
                                <img src={otherPerson.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-primary">
                                  {(otherPerson?.name || otherPerson?.email || "?").charAt(0).toUpperCase()}
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
                          <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 bg-red-50 text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] lg:text-xs font-bold transition-all border border-red-100 dark:bg-red-900/10 dark:hover:bg-primary shadow-sm">
                              <Ban size={12} className="lg:w-[14px] lg:h-[14px]" /> <span className="hidden sm:inline">Report</span>
                            </button>
                          </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6 bg-slate-50/30 dark:bg-black/20">
                          {messages.map((msg: any) => {
                            const isMyMsg = msg.senderId === myId;
                            const senderAvatar = isMyMsg ? user?.avatarUrl : otherPerson?.avatarUrl;
                            const senderName = isMyMsg ? user?.name : (otherPerson?.name || otherPerson?.email);

                            return (
                              <div key={msg.id} className={clsx("flex gap-3 items-end animate-fade-in", isMyMsg ? "justify-end" : "justify-start")}>
                                {!isMyMsg && (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                                    {senderAvatar ? <img src={senderAvatar} alt="Sender" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500 uppercase">{(senderName || "?").substring(0, 2).toUpperCase()}</span>}
                                  </div>
                                )}
                                <div className={clsx("flex flex-col", isMyMsg ? "items-end" : "items-start")}>
                                  <div className={clsx("max-w-[280px] sm:max-w-[400px] lg:max-w-[500px] border rounded-2xl px-4 py-2.5 lg:px-5 lg:py-3 shadow-sm", isMyMsg ? "bg-primary text-white border-primary rounded-tr-sm" : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-white/10 rounded-tl-sm text-slate-600 dark:text-slate-300")}>
                                    <p className="text-sm font-medium">{msg.content}</p>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 lg:mt-2">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                {isMyMsg && (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                                    {senderAvatar ? <img src={senderAvatar} alt="Sender" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500 uppercase">{(senderName || "?").substring(0, 2).toUpperCase()}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-3 lg:p-5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 shrink-0">
                          <form onSubmit={handleSend} className="relative flex items-center bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/10 p-1.5 pr-2 focus-within:border-primary transition-colors hover:border-slate-300">
                            <input
                              type="text"
                              value={inputText}
                              onChange={(e) => setInputText(e.target.value)}
                              placeholder="Reply..."
                              className="flex-1 px-2 lg:px-3 py-1.5 lg:py-2 bg-transparent outline-none text-sm font-medium dark:text-white"
                            />
                            <button type="submit" disabled={!inputText.trim()} className="p-2 lg:p-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50">
                              <Send size={14} className="lg:w-4 lg:h-4" />
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
                                  <img src={otherPerson.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  (otherPerson?.name || otherPerson?.email || "?").charAt(0).toUpperCase()
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
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notice</h4>
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
      </div>
    </div>
  );
}
