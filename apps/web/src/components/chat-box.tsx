"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Paperclip,
  Smile,
  Minimize2,
  MapPin,
  ArrowLeft,
  Search,
  Loader2,
  Ban,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { LoginModal } from "./login-modal";
import { markMessageNotificationsAsReadAction } from "@/app/actions/notification";
import { getAllStorefrontsAction } from "@/app/actions/tenant";

interface ChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  initialRecipient?: "admin" | "shop" | null;
  initialShopName?: string | null;
  inquirySlotId?: string | null;
  initialMessage?: string | null;
}

const DEFAULT_SHOPS = [
  "Velvet & Vine",
  "Coffee Culture",
  "Gadget Sphere",
  "Prism Fitness",
  "Modern Home",
];

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
  const [availableShops, setAvailableShops] = useState<{ name: string; logo: string | null }[]>([]);
  const [selectedShop, setSelectedShop] = useState<{ name: string; logo: string | null }>({
    name: initialShopName || DEFAULT_SHOPS[0],
    logo: null,
  });
  const [viewMode, setViewMode] = useState<"list" | "chat">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Real DB Messages state
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [isRecipientBlocking, setIsRecipientBlocking] = useState(false);

  // Fetch true shops from DB
  useEffect(() => {
    async function fetchShops() {
      const res = await getAllStorefrontsAction();
      if (res.success && res.data) {
        const shops = res.data.map((s: any) => ({
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
            if (!prev || !prev.name || DEFAULT_SHOPS.includes(prev.name)) {
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
  };

  // Poll for messages
  const fetchMessages = useCallback(async () => {
    if (!isOpen || !user?.email || viewMode !== "chat") return;
    if (recipient === "shop" && !selectedShop?.name?.trim()) return;

    try {
      const { getConversationHistory } = await import("@/app/actions/chat-queries");
      const history = await getConversationHistory(
        user.email,
        recipient,
        selectedShop.name?.trim(),
      );

      setDbMessages((prev) => {
        const hasOptimistic = prev.some((p) => String(p.id).startsWith("temp-"));
        if (
          !hasOptimistic &&
          prev.length === history.length &&
          prev[prev.length - 1]?.id === history[history.length - 1]?.id
        ) {
          return prev;
        }

        const pendingOptimistic = prev.filter(
          (p) =>
            String(p.id).startsWith("temp-") &&
            !history.some(
              (h: any) =>
                (h.content === p.content && h.sender?.email === p.sender?.email) ||
                h.id === p.id,
            ),
        );
        return [...history, ...pendingOptimistic];
      });

      if (isNearBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [isOpen, user?.email, recipient, selectedShop.name, viewMode]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (isOpen && user?.id) {
      markMessageNotificationsAsReadAction(user.id);
    }
  }, [isOpen, user?.id]);

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
        } else {
          setIsRecipientBlocking(false);
        }
      } catch (err) {
        setIsRecipientBlocking(false);
      }
    }
    checkBlock();
  }, [user?.id, viewMode, recipient]);

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
      alert("This recipient is currently not accepting incoming messages from you.");
      return;
    }

    if (!textToSend.trim() && !fileToSend) return;

    // Reset input immediately
    setInputText("");
    setImageFile(null);
    setImagePreview(null);

    if (user?.email) {
      // Instant Optimistic update with local preview
      const tempId = `temp-${Date.now()}`;
      setDbMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content: textToSend,
          imageUrl: previewToSend,
          sender: { email: user.email, name: user.name, avatarUrl: user.avatarUrl },
          createdAt: new Date(),
        },
      ]);

      isNearBottomRef.current = true;
      requestAnimationFrame(scrollToBottom);

      setIsUploading(true);

      try {
        let uploadedImageUrl: string | null = null;
        if (fileToSend) {
          uploadedImageUrl = await uploadImageToCloudinary(fileToSend);
        }

        const { sendMessage } = await import("@/app/actions/chat");
        const res = await sendMessage({
          userId: user.email,
          recipientType: recipient,
          content: textToSend || "📎 Image",
          imageUrl: uploadedImageUrl || undefined,
          shopName: selectedShop.name,
          slotId: slotId,
        });

        if (res && !res.success && res.error) {
          alert(res.error);
          setDbMessages((prev) => prev.filter((m) => m.id !== tempId));
        } else {
          fetchMessages();
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      } finally {
        setIsUploading(false);
      }
    }
  };



  const isUserBlocked = !!(user as any)?.isBlacklisted;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-32 sm:right-10 z-[100] w-full h-[85vh] sm:w-[400px] sm:h-[600px] bg-white dark:bg-zinc-900 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl border-0 sm:border border-slate-100 dark:border-white/5 flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 bg-primary flex items-center justify-between text-white shadow-md z-10 transition-all">
          <div className="flex items-center gap-3 sm:gap-4">
            {viewMode === "chat" && (
              <button
                onClick={() => setViewMode("list")}
                className="p-1 hover:bg-white/20 rounded-full transition-colors active:scale-95 mr-1"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden font-black text-lg sm:text-xl shadow-inner">
                {viewMode === "list" && isAuthenticated && user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : viewMode === "chat" && recipient === "shop" ? (
                  selectedShop.logo ? (
                    <img
                      src={selectedShop.logo}
                      alt="Shop"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedShop.name.substring(0, 1).toUpperCase()
                  )
                ) : (
                  "S"
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full border-2 border-primary animate-pulse"></div>
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-xs sm:text-sm tracking-tight truncate max-w-[150px]">
                {viewMode === "chat" && recipient === "shop"
                  ? selectedShop.name
                  : viewMode === "list" && isAuthenticated
                    ? `Hi, ${user?.name?.split(" ")[0]}`
                    : "Mall Messenger"}
              </h3>
              <span className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-widest">
                {viewMode === "chat" ? "Active Conversation" : "Live Connect"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
            >
              <Minimize2 size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-black/20 custom-scrollbar">
            {isAuthenticated ? (
              <div className="p-3 sm:p-4 space-y-2">
                <div className="mx-2 mb-6 p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-black text-primary">
                        {user?.name?.substring(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal dark:text-white truncate">
                      {user?.name}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 truncate uppercase tracking-tight">
                      {isUserBlocked ? (
                        <span className="text-red-500 font-bold">Suspended Account</span>
                      ) : (
                        "Authenticated Customer"
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-2 mb-4 mt-1 flex flex-col gap-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Active Channels
                  </h4>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      suppressHydrationWarning
                      type="text"
                      placeholder="Search stores or admin..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs font-medium text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Admin Channel */}
                {(!searchQuery ||
                  "mall administration booking support admin".includes(
                    searchQuery.toLowerCase(),
                  )) && (
                  <div
                    onClick={() => {
                      setRecipient("admin");
                      setViewMode("chat");
                    }}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl hover:shadow-md cursor-pointer transition-all border border-slate-100 dark:border-white/5"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      MA
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-charcoal dark:text-white">
                        Mall Administration
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Booking & Support Inquiries
                      </p>
                    </div>
                  </div>
                )}

                {/* Tenant Channels */}
                {availableShops
                  .filter((shop) =>
                    shop.name.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((shop) => (
                    <div
                      key={shop.name}
                      onClick={() => {
                        setRecipient("shop");
                        setSelectedShop(shop);
                        setViewMode("chat");
                      }}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl hover:shadow-md cursor-pointer transition-all border border-slate-100 dark:border-white/5"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold border border-slate-100 dark:border-white/5">
                        {shop.logo ? (
                          <img
                            src={shop.logo}
                            alt="Logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          shop.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-sm text-charcoal dark:text-white truncate">
                          {shop.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Tenant Support
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
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
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20"
            >
              <div className="flex flex-col items-start animate-fade-in">
                <div className="max-w-[85%] rounded-3xl px-5 py-3.5 shadow-sm text-sm font-medium leading-relaxed bg-white dark:bg-zinc-800 text-charcoal dark:text-slate-300 rounded-tl-sm border border-slate-100 dark:border-white/5">
                  {isAuthenticated
                    ? `Welcome back ${user?.name || ""}! How can we help you access ${
                        recipient === "admin" ? "Mall Administration" : selectedShop.name
                      }?`
                    : `Welcome to SR Mall. Login to start a conversation with Mall Admin or Tenants.`}
                </div>
              </div>

              {dbMessages.map((msg: any) => {
                const isUserSender =
                  (user?.id && msg.senderId === user.id) ||
                  (user?.email && msg.sender?.email?.toLowerCase() === user.email.toLowerCase());
                const senderAvatar = isUserSender ? user?.avatarUrl : msg.sender?.avatarUrl;
                const senderName = isUserSender
                  ? user?.name
                  : msg.sender?.name || msg.sender?.email;
                const isTemporary = String(msg.id).startsWith("temp-");

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${
                      isUserSender ? "justify-end" : "justify-start"
                    } items-end animate-fade-in group relative`}
                  >
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
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
