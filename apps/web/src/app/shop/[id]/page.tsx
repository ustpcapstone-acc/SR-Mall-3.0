"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Store,
  Tag,
  Search,
  X,
  ShoppingBag,
} from "lucide-react";
import { DigitalStorefront } from "@/types/storefront";
import { getStorefrontByIdAction } from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import { ChatBox } from "@/components/chat-box";
import { FeedbackSection } from "@/components/feedback-section";
import { LoginModal } from "@/components/login-modal";
import { ProductDetailModal } from "@/components/product-detail-modal";
import clsx from "clsx";

// Premium Placeholders for Broken/Blob URLs
const PLACEHOLDERS = [
  "/images/logo/gudget.jpg",
  "/images/logo/gudget2.jpg",
  "/images/logo/gudget3.webp",
  "/images/logo/logoshop.jpg",
];

const getSafeUrl = (url: string | null | undefined, index: number) => {
  if (!url || url.startsWith("blob:") || url.includes("placeholder")) {
    return PLACEHOLDERS[index % PLACEHOLDERS.length];
  }
  return url;
};

// Helper function to return gallery_urls (now native array)
const getGalleryUrls = (galleryUrls: string[] | null | undefined): string[] => {
  return Array.isArray(galleryUrls) ? galleryUrls : [];
};

export default function ShopProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [shop, setShop] = useState<DigitalStorefront | null>(() => {
    return params?.id ? spaCache.get("shop_profile_" + params.id) : null;
  });
  const [loading, setLoading] = useState(() => {
    return params?.id ? !spaCache.has("shop_profile_" + params.id) : true;
  });
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  useEffect(() => {
    async function loadShop() {
      if (params?.id) {
        const hasCache = spaCache.has("shop_profile_" + params.id);
        if (!hasCache) setLoading(true);
        const res = await getStorefrontByIdAction(params.id as string);
        if (res.success && res.data) {
          setShop(res.data);
          spaCache.set("shop_profile_" + params.id, res.data);
        } else {
          // If we have cached data but API failed, let's keep showing cached data but log error
          if (!hasCache) {
            setError(res.error || "Shop not found");
          }
        }
        setLoading(false);
      }
    }
    loadShop();
  }, [params?.id]);

  if (loading) {
    return (
      <div
        className={clsx(
          "min-h-screen",
          "bg-white",
          "dark:bg-zinc-950",
          "flex",
          "flex-col",
          "items-center",
          "justify-center",
          "space-y-6",
        )}
      >
        <Loader2
          className={clsx("w-12", "h-12", "text-primary", "animate-spin")}
        />
        <p
          className={clsx(
            "text-[10px]",
            "font-black",
            "uppercase",
            "tracking-[0.3em]",
            "text-slate-400",
            "animate-pulse",
          )}
        >
          Consulting Mall Concierge...
        </p>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div
        className={clsx(
          "min-h-screen",
          "bg-white",
          "dark:bg-zinc-950",
          "flex",
          "flex-col",
          "items-center",
          "justify-center",
          "p-8",
          "text-center",
        )}
      >
        <div
          className={clsx(
            "w-20",
            "h-20",
            "bg-primary/10",
            "rounded-full",
            "flex",
            "items-center",
            "justify-center",
            "text-primary",
            "mb-6",
          )}
        >
          <AlertTriangle size={40} />
        </div>
        <h2
          className={clsx(
            "text-3xl",
            "font-black",
            "text-charcoal",
            "dark:text-white",
            "mb-4",
            "uppercase",
            "text-center",
          )}
        >
          Slot Vacant
        </h2>
        <p
          className={clsx("text-slate-500", "font-medium", "max-w-sm", "mb-8")}
        >
          {error || "This unit currently has no digital profile."}
        </p>
        <button
          onClick={() => router.back()}
          className={clsx(
            "flex",
            "items-center",
            "gap-2",
            "px-8",
            "py-4",
            "bg-primary",
            "text-white",
            "rounded-2xl",
            "font-black",
            "text-xs",
            "uppercase",
            "tracking-widest",
            "shadow-xl",
            "shadow-primary/20",
            "hover:scale-105",
            "transition-transform",
          )}
        >
          <ArrowLeft size={16} /> Return to Directory
        </button>
      </div>
    );
  }

  const galleryUrls = getGalleryUrls(shop.gallery_urls);

  return (
    <div
      className={clsx(
        "min-h-screen",
        "bg-white",
        "dark:bg-zinc-950",
        "pb-24",
        "lg:pb-0",
        "relative",
        "overflow-x-hidden",
      )}
    >
      {/* Premium Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[300px] sm:h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-[60px] sm:blur-[100px] pointer-events-none" />

      {/* Dynamic Navigation Bar (Sticky) */}
      <nav
        className={clsx(
          "sticky",
          "top-0",
          "z-50",
          "bg-white/80",
          "dark:bg-zinc-950/80",
          "backdrop-blur-xl",
          "border-b",
          "border-slate-100",
          "dark:border-white/5",
          "px-4",
          "sm:px-6",
          "py-3",
          "flex",
          "items-center",
          "justify-between",
        )}
      >
        <button
          onClick={() => router.back()}
          className={clsx(
            "w-9",
            "h-9",
            "sm:w-10",
            "sm:h-10",
            "rounded-xl",
            "bg-slate-50",
            "dark:bg-zinc-900",
            "flex",
            "items-center",
            "justify-center",
            "text-slate-500",
            "hover:bg-primary",
            "hover:text-white",
            "transition-colors",
            "group",
          )}
        >
          <ArrowLeft
            size={18}
            className={clsx(
              "group-hover:-translate-x-1",
              "transition-transform",
            )}
          />
        </button>

        <div
          className={clsx(
            "flex",
            "flex-col",
            "items-center",
            "max-w-[180px] sm:max-w-md",
            "mx-auto",
            "px-3",
            "sm:px-5",
            "py-1",
            "sm:py-1.5",
            "rounded-xl",
            "sm:rounded-2xl",
            "bg-slate-50/50",
            "dark:bg-white/5",
            "border",
            "border-slate-200/50",
            "dark:border-white/10",
            "shadow-sm",
          )}
        >
          <div className={clsx("flex", "items-center", "gap-1.5", "mb-0.5")}>
            <div
              className={clsx(
                "w-1",
                "h-1",
                "sm:w-1.5",
                "sm:h-1.5",
                "rounded-full",
                "bg-emerald-500",
                "animate-pulse",
                "shadow-[0_0_8px_rgba(16,185,129,0.5)]",
              )}
            />
            <h4
              className={clsx(
                "text-[6px] sm:text-[7px]",
                "font-black",
                "text-slate-400",
                "uppercase",
                "tracking-[0.3em] sm:tracking-[0.4em]",
                "leading-none",
              )}
            >
              Now Visiting
            </h4>
          </div>
          <div className={clsx("flex", "items-center", "gap-2 sm:gap-3")}>
            <span
              className={clsx(
                "text-[10px] sm:text-sm",
                "font-black",
                "text-charcoal",
                "dark:text-white",
                "tracking-tight",
                "uppercase",
                "line-clamp-1",
              )}
            >
              {shop.shop_name}
            </span>
            <div
              className={clsx(
                "h-2.5 sm:h-3",
                "w-[1px] sm:w-[1.5px]",
                "bg-primary/20",
                "rounded-full",
                "hidden xs:block",
              )}
            ></div>
            <div className={clsx("hidden xs:flex", "items-center", "gap-1")}>
              <Tag size={10} className="text-primary hidden sm:block" />
              <span
                className={clsx(
                  "text-[8px] sm:text-[9px]",
                  "font-bold",
                  "text-slate-500",
                  "dark:text-slate-400",
                  "uppercase",
                  "tracking-widest",
                )}
              >
                Fashion
              </span>
            </div>
          </div>
        </div>

        <button
          className={clsx(
            "w-9",
            "h-9",
            "sm:w-10",
            "sm:h-10",
            "rounded-xl",
            "bg-slate-50",
            "dark:bg-zinc-900",
            "flex",
            "items-center",
            "justify-center",
            "text-slate-400",
          )}
        >
          <AlertTriangle size={18} />
        </button>
      </nav>

      <div
        className={clsx(
          "max-w-7xl",
          "mx-auto",
          "px-4",
          "sm:px-6",
          "lg:px-10",
          "py-6",
          "sm:py-8",
          "lg:py-12",
        )}
      >
        {/* main card: Glass container */}
        <div
          className={clsx(
            "bg-white",
            "dark:bg-zinc-900/40",
            "rounded-[2rem]",
            "sm:rounded-[3rem]",
            "border",
            "border-slate-200",
            "dark:border-white/5",
            "shadow-2xl",
            "overflow-hidden",
            "grid",
            "grid-cols-1",
            "lg:grid-cols-12",
          )}
        >
          {/* Left Side: Media / Lookbook (7 cols) */}
          <div
            className={clsx(
              "lg:col-span-7",
              "p-4",
              "sm:p-6",
              "lg:p-10",
              "border-b",
              "lg:border-b-0",
              "lg:border-r",
              "border-slate-100",
              "dark:border-white/5",
            )}
          >
            {/* Main Hero Slider */}
            <div
              className={clsx(
                "relative",
                "aspect-[4/3] sm:aspect-video lg:aspect-[4/3]",
                "rounded-[1.5rem] sm:rounded-[2.5rem]",
                "overflow-hidden",
                "bg-slate-100",
                "dark:bg-zinc-800",
                "shadow-xl",
                "group/slider",
              )}
            >
              {(() => {
                const galleryUrls = getGalleryUrls(shop.gallery_urls);
                if (!galleryUrls || galleryUrls.length === 0) {
                  return (
                    <div
                      className={clsx(
                        "w-full",
                        "h-full",
                        "flex",
                        "flex-col",
                        "items-center",
                        "justify-center",
                        "text-slate-300",
                      )}
                    >
                      <Store size={60} className="sm:size-[80px]" />
                      <span
                        className={clsx(
                          "text-[8px] sm:text-[10px]",
                          "font-black",
                          "uppercase",
                          "tracking-widest",
                          "mt-4",
                          "text-center",
                        )}
                      >
                        Store Hub Media Missing
                      </span>
                    </div>
                  );
                }

                const currentUrl = getSafeUrl(
                  galleryUrls[activeImageIndex],
                  activeImageIndex,
                );
                const isVideo =
                  currentUrl?.match(/\.(mp4|webm|mov|ogg)$/i) ||
                  currentUrl?.includes("/video/upload/");

                return isVideo ? (
                  <video
                    src={currentUrl}
                    className={clsx("w-full", "h-full", "object-cover")}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={currentUrl}
                    className={clsx(
                      "w-full",
                      "h-full",
                      "object-cover",
                      "transition-transform",
                      "duration-1000",
                      "group-hover:scale-110",
                    )}
                    alt="Store Highlight"
                  />
                );
              })()}

              <div
                className={clsx(
                  "absolute",
                  "inset-0",
                  "bg-gradient-to-t",
                  "from-black/40",
                  "via-transparent",
                  "to-black/20",
                  "pointer-events-none",
                )}
              ></div>

              {/* Carousel Controls */}
              {(() => {
                const galleryUrls = getGalleryUrls(shop.gallery_urls);
                return (
                  galleryUrls &&
                  galleryUrls.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActiveImageIndex((prev) =>
                            prev === 0 ? galleryUrls.length - 1 : prev - 1,
                          )
                        }
                        className={clsx(
                          "absolute",
                          "left-2",
                          "sm:left-4",
                          "top-1/2",
                          "-translate-y-1/2",
                          "w-10",
                          "h-10",
                          "sm:w-12",
                          "sm:h-12",
                          "bg-white/10",
                          "hover:bg-white/30",
                          "backdrop-blur-xl",
                          "rounded-xl",
                          "sm:rounded-2xl",
                          "flex",
                          "items-center",
                          "justify-center",
                          "text-white",
                          "opacity-80 sm:opacity-0",
                          "group-hover/slider:opacity-100",
                          "transition-all",
                          "active:scale-95",
                        )}
                      >
                        <ChevronLeft size={20} className="sm:size-[24px]" />
                      </button>
                      <button
                        onClick={() =>
                          setActiveImageIndex((prev) =>
                            prev === galleryUrls.length - 1 ? 0 : prev + 1,
                          )
                        }
                        className={clsx(
                          "absolute",
                          "right-2",
                          "sm:right-4",
                          "top-1/2",
                          "-translate-y-1/2",
                          "w-10",
                          "h-10",
                          "sm:w-12",
                          "sm:h-12",
                          "bg-white/10",
                          "hover:bg-white/30",
                          "backdrop-blur-xl",
                          "rounded-xl",
                          "sm:rounded-2xl",
                          "flex",
                          "items-center",
                          "justify-center",
                          "text-white",
                          "opacity-80 sm:opacity-0",
                          "group-hover/slider:opacity-100",
                          "transition-all",
                          "active:scale-95",
                        )}
                      >
                        <ChevronRight size={20} className="sm:size-[24px]" />
                      </button>
                    </>
                  )
                );
              })()}

              {/* Store Status Overlay Badge */}
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                <div
                  className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-full backdrop-blur-xl border flex items-center gap-1.5 sm:gap-2 shadow-2xl ${shop.is_open ? "bg-emerald-500/80 border-emerald-400/30 text-white" : "bg-charcoal/80 border-white/10 text-slate-300"}`}
                >
                  <div
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${shop.is_open ? "bg-white animate-pulse" : "bg-slate-400"}`}
                  ></div>
                  <span
                    className={clsx(
                      "text-[8px] sm:text-[10px]",
                      "font-black",
                      "uppercase",
                      "tracking-[0.15em] sm:tracking-[0.2em]",
                    )}
                  >
                    {shop.is_open ? "Open Now" : "Closed"}
                  </span>
                </div>
              </div>

              {/* Counter */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <div className="bg-black/30 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-white/10 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                  {(galleryUrls?.length || 0) > 0
                    ? (activeImageIndex + 1).toString().padStart(2, "0")
                    : "00"}{" "}
                  / {(galleryUrls?.length || 0).toString().padStart(2, "0")}
                </div>
              </div>
            </div>

            {/* Gallery Thumbnails Strip */}
            <div
              className={clsx(
                "flex",
                "gap-3",
                "sm:gap-4",
                "mt-4 sm:mt-8",
                "overflow-x-auto",
                "pb-2",
                "no-scrollbar",
              )}
            >
              {galleryUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-16 h-16 sm:w-24 sm:h-24 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden border-2 transition-all ${activeImageIndex === i ? "border-primary shadow-lg scale-105" : "border-transparent opacity-40 hover:opacity-100"}`}
                >
                  <img
                    src={getSafeUrl(url, i)}
                    className={clsx("w-full", "h-full", "object-cover")}
                    alt="Gallery"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Identity & Premium Interaction (5 cols) */}
          <div
            className={clsx(
              "lg:col-span-5",
              "bg-slate-50/30",
              "dark:bg-zinc-950/20",
              "p-6",
              "sm:p-8",
              "lg:p-12",
              "flex",
              "flex-col",
              "justify-between",
            )}
          >
            <div className="space-y-8 sm:space-y-12">
              {/* Header: Logo + Identity */}
              <div className="flex flex-col items-center lg:items-start gap-6 sm:gap-8">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-orange-500 rounded-[1.8rem] sm:rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <div
                    className={clsx(
                      "relative",
                      "w-24",
                      "h-24",
                      "sm:w-32",
                      "sm:h-32",
                      "rounded-[1.6rem] sm:rounded-[2.2rem]",
                      "bg-white",
                      "dark:bg-zinc-900",
                      "p-1",
                      "sm:p-1.5",
                      "shadow-2xl",
                      "border",
                      "border-slate-100",
                      "dark:border-white/10",
                      "rotate-2",
                    )}
                  >
                    <img
                      src={getSafeUrl(shop.logo_url || "", 0)}
                      className={clsx(
                        "w-full",
                        "h-full",
                        "object-cover",
                        "rounded-[1.4rem] sm:rounded-[2rem]",
                      )}
                      alt="Shop Logo"
                    />
                  </div>
                </div>

                <div className="text-center lg:text-left space-y-3 sm:space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 bg-primary/5 border border-primary/20 rounded-full mx-auto lg:mx-0">
                    <Store size={10} className="text-primary sm:size-[12px]" />
                    <span className="text-[8px] sm:text-[10px] font-black text-primary uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                      Verified Boutique
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-charcoal dark:text-white tracking-tighter uppercase leading-[0.9]">
                    {shop.shop_name}
                  </h1>

                  {/* Compact Location Badge */}
                  <div className="flex items-center justify-center lg:justify-start gap-2 sm:gap-3 pt-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-white">
                      <MapPin size={14} className="sm:size-[16px]" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 sm:mb-1">
                        Floor Level
                      </span>
                      <span className="text-[10px] sm:text-xs font-black text-charcoal dark:text-white uppercase tracking-widest">
                        {shop.unit_id} — Plaza Wing
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Body */}
              <div className="relative p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-[1.2rem] sm:rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h3 className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-3 sm:mb-4">
                  Official Bio
                </h3>
                <p
                  className={clsx(
                    "text-sm sm:text-base",
                    "text-slate-600",
                    "dark:text-slate-300",
                    "font-medium",
                    "leading-relaxed",
                    "italic",
                  )}
                >
                  "
                  {shop.description ||
                    "Welcome to Rizal Fashion. We specialize in presenting the finest local craftsmanship mixed with global design trends. Experience the luxury of choice with our curated seasonal collections."}
                  "
                </p>
              </div>
            </div>

            {/* Action Section */}
            <div className="mt-8 sm:mt-12 space-y-3 sm:space-y-4">
              <button
                onClick={() => {
                  if (isAuthenticated) setIsChatOpen(true);
                  else setIsLoginModalOpen(true);
                }}
                className={clsx(
                  "w-full",
                  "py-4 sm:py-5",
                  "bg-primary",
                  "text-white",
                  "rounded-[1.2rem] sm:rounded-[1.5rem]",
                  "flex",
                  "items-center",
                  "justify-center",
                  "gap-3 sm:gap-4",
                  "font-black",
                  "text-[10px] sm:text-xs",
                  "uppercase",
                  "tracking-[0.15em] sm:tracking-[0.2em]",
                  "hover:scale-[1.02]",
                  "active:scale-95",
                  "transition-all",
                  "shadow-[0_15px_30px_-10px_rgba(190,30,45,0.4)]",
                )}
              >
                <MessageCircle size={18} /> Initiate Concierge Chat
              </button>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">
                    Status
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase">
                    Live Now
                  </span>
                </div>
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">
                    Inquiries
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-black text-charcoal dark:text-white uppercase">
                    High Volume
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Products Section: The Lookbook */}
      {shop?.products && shop.products.length > 0 && (
        <div
          className={clsx(
            "max-w-7xl",
            "mx-auto",
            "px-4",
            "sm:px-6",
            "lg:px-10",
            "pb-32",
            "animate-fade-in-up",
          )}
          style={{ animationDelay: "400ms" }}
        >
          <div
            className={clsx(
              "flex",
              "flex-col",
              "lg:flex-row",
              "lg:items-end",
              "justify-between",
              "mb-10 sm:mb-12",
              "gap-6 sm:gap-8",
            )}
          >
            <div className="space-y-3 sm:space-y-4">
              <span className="text-[8px] sm:text-[10px] font-black text-primary uppercase tracking-[0.3em] sm:tracking-[0.4em]">
                Curated Collection
              </span>
              <h3
                className={clsx(
                  "text-3xl sm:text-5xl",
                  "font-black",
                  "text-charcoal",
                  "dark:text-white",
                  "uppercase",
                  "tracking-tighter",
                  "leading-none",
                )}
              >
                Store{" "}
                <span className="text-slate-300 dark:text-zinc-800">
                  Catalog.
                </span>
              </h3>
            </div>

            {/* Professional Search Input + Predictive Recommendations */}
            <div className="relative group w-full lg:w-96">
              <Search
                size={18}
                className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
              />
              <input
                type="text"
                placeholder="Search in this boutique..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border-2 border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-12 sm:pl-14 pr-10 sm:pr-6 text-[11px] sm:text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
              />

              {/* Predictive Search Panel */}
              {productSearch && (
                <div className="absolute top-full left-0 w-full mt-2 sm:mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-3 sm:p-4 border-b border-slate-50 dark:border-white/5">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Recommended Matches
                    </span>
                  </div>
                  <div className="max-h-60 sm:max-h-80 overflow-y-auto no-scrollbar">
                    {shop.products
                      .filter((p) =>
                        (p.name || "")
                          .toLowerCase()
                          .includes(productSearch.toLowerCase()),
                      )
                      .slice(0, 5)
                      .map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => setProductSearch(p.name || "")}
                          className="w-full p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 text-left group/item"
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0">
                            {p.image_url ? (
                              <img
                                src={getSafeUrl(p.image_url, i)}
                                className="w-full h-full object-cover group-hover/item:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Store size={14} className="sm:size-[18px]" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] sm:text-xs font-black text-charcoal dark:text-white line-clamp-1">
                              {p.name || "Untitled Boutique Item"}
                            </p>
                            <p className="text-[8px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                              {p.price || "Price on Inquiry"}
                            </p>
                          </div>
                          <ChevronRight
                            size={12}
                            className="text-slate-300 group-hover/item:text-primary transition-colors sm:size-[14px]"
                          />
                        </button>
                      ))}
                    {shop.products.filter((p) =>
                      (p.name || "")
                        .toLowerCase()
                        .includes(productSearch.toLowerCase()),
                    ).length === 0 && (
                      <div className="p-6 sm:p-8 text-center text-slate-400">
                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                          No matching items found
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-charcoal z-10"
                >
                  <X size={14} className="sm:size-[16px]" />
                </button>
              )}
            </div>
          </div>

          <div
            className={clsx(
              "grid",
              "grid-cols-2",
              "sm:grid-cols-3",
              "lg:grid-cols-4",
              "xl:grid-cols-5",
              "gap-4",
              "sm:gap-6",
            )}
          >
            {shop.products
              .filter((p) => {
                const query = productSearch.toLowerCase();
                return (
                  !productSearch ||
                  (p.name && p.name.toLowerCase().includes(query)) ||
                  (p.description && p.description.toLowerCase().includes(query))
                );
              })
              .map((product) => (
                <div
                  key={product.id}
                  className={clsx(
                    "group",
                    "bg-white",
                    "dark:bg-zinc-900",
                    "rounded-[1.5rem]",
                    "sm:rounded-[2rem]",
                    "overflow-hidden",
                    "border",
                    "border-slate-100",
                    "dark:border-white/5",
                    "shadow-sm",
                    "hover:shadow-2xl",
                    "transition-all",
                    "duration-700",
                    "flex",
                    "flex-col",
                    "hover:-translate-y-2",
                    "cursor-pointer",
                  )}
                  onClick={() => setSelectedProduct({ ...product, shopName: shop.shop_name })}
                >
                  <div
                    className={clsx(
                      "aspect-square",
                      "relative",
                      "overflow-hidden",
                      "bg-slate-50",
                      "dark:bg-zinc-800",
                    )}
                  >
                    {product.image_url ? (
                      <img
                        src={getSafeUrl(product.image_url, 0)}
                        className={clsx(
                          "w-full",
                          "h-full",
                          "object-cover",
                          "transition-transform",
                          "duration-1000",
                          "group-hover:scale-110",
                        )}
                        alt={product.name || "Product"}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-zinc-700">
                        <ShoppingBag size={32} className="sm:size-[40px]" />
                      </div>
                    )}

                    {/* Compact Price Tag */}
                    {product.price && (
                      <div
                        className={clsx(
                          "absolute",
                          "top-3",
                          "right-3",
                          "bg-white/90",
                          "dark:bg-zinc-950/90",
                          "backdrop-blur-md",
                          "px-2.5",
                          "py-1",
                          "rounded-lg",
                          "shadow-lg",
                          "border",
                          "border-white/20",
                          "group-hover:scale-105",
                          "transition-transform",
                        )}
                      >
                        <span
                          className={clsx(
                            "text-[8px] sm:text-[9px]",
                            "font-black",
                            "text-emerald-600",
                            "dark:text-emerald-400",
                            "tracking-wider",
                          )}
                        >
                          {product.price}
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>

                  <div
                    className={clsx(
                      "p-4",
                      "sm:p-5",
                      "flex-1",
                      "flex",
                      "flex-col",
                      "text-center",
                    )}
                  >
                    <h4
                      className={clsx(
                        "text-[10px] sm:text-xs",
                        "font-black",
                        "text-charcoal",
                        "dark:text-white",
                        "mb-2",
                        "uppercase",
                        "tracking-tight",
                        "line-clamp-1",
                        "group-hover:text-primary",
                        "transition-colors",
                      )}
                    >
                      {product.name || "Untitled Boutique Item"}
                    </h4>
                    <p
                      className={clsx(
                        "text-[8px] sm:text-[9px]",
                        "font-medium",
                        "text-slate-500",
                        "dark:text-slate-400",
                        "line-clamp-2",
                        "flex-1",
                        "leading-tight",
                        "italic",
                      )}
                    >
                      {product.description || "Curated for quality."}
                    </p>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct({ ...product, shopName: shop.shop_name });
                      }}
                      className="mt-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-white/5 rounded-lg text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all active:scale-95"
                    >
                      Investigate
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tenant-Specific Feedback Section */}
      <FeedbackSection isAuthenticated={isAuthenticated} tenantId={shop.id} />

      {shop && (
        <ChatBox
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isAuthenticated={isAuthenticated}
          initialShopName={shop.shop_name}
          initialRecipient="shop"
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onInquire={(shopName) => {
          setIsChatOpen(true);
          setSelectedProduct(null);
        }}
      />
    </div>
  );
}
