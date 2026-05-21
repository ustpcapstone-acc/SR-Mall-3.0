"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ShopCard } from "@/components/shop-card";
import { AdBanner } from "@/components/ad-banner";
import { UpcomingEventsSlider } from "@/components/upcoming-events-slider";
import { ShopSalesSlider } from "@/components/shop-sales-slider";
import { FeedbackSection } from "@/components/feedback-section";
import { ChatBox } from "@/components/chat-box";
import { EventInquiryForm } from "@/components/event-inquiry-form";
import {
  Search,
  MapPin,
  Navigation,
  ArrowRight,
  MessageCircle,
  X,
  Loader2,
  RefreshCw,
  Tag,
  ShoppingBag,
  Sparkles,
  Zap,
  Shirt,
  Coffee,
} from "lucide-react";
import Link from "next/link";
import { LoginModal } from "@/components/login-modal";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import { DigitalStorefront } from "@/types/storefront";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { getAreaSlots } from "@/app/actions/space-slot";

import { AreaSlot } from "@srmall/database";
import { getActiveMallAds, getApprovedTenantPromos } from "@/app/actions/ads";
import {
  getPublicViewConfigAction,
  getPublicViewCarouselAction,
} from "@/app/actions/cms";
import SpaceDetailModal from "@/components/space-detail-modal";
import { ProductCard } from "@/components/product-card";
import { ProductDetailModal } from "@/components/product-detail-modal";
import clsx from "clsx";

export default function PublicDigitalConcierge() {
  const { isAuthenticated, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleSlotsCount, setVisibleSlotsCount] = useState(4);
  const [isLoadingMoreSlots, setIsLoadingMoreSlots] = useState(false);
  const [config, setConfig] = useState<any>(() => spaCache.get("public_config") || null);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [shops, setShops] = useState<DigitalStorefront[]>(() => spaCache.get("public_shops") || []);
  const [loadingShops, setLoadingShops] = useState(() => !spaCache.has("public_shops"));
  const [slots, setSlots] = useState<AreaSlot[]>(() => spaCache.get("public_slots") || []);
  const [loadingSlots, setLoadingSlots] = useState(() => !spaCache.has("public_slots"));
  const [selectedSlot, setSelectedSlot] = useState<AreaSlot | null>(null);

  // Dynamic Chat Intros
  const [chatRecipient, setChatRecipient] = useState<"shop" | "admin" | null>(
    null,
  );
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(
    null,
  );
  const [chatInquirySlotId, setChatInquirySlotId] = useState<string | null>(
    null,
  );

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [ads, setAds] = useState<any[]>(() => spaCache.get("public_ads") || []);
  const [tenantPromos, setTenantPromos] = useState<any[]>(() => spaCache.get("public_promos") || []);
  const [carouselItems, setCarouselItems] = useState<any[]>(() => spaCache.get("public_carousel") || []);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [allFeaturedProducts, setAllFeaturedProducts] = useState<any[]>(() => spaCache.get("public_featured_products") || []);
  const productsCarouselRef = useRef<HTMLDivElement>(null);
  const [activeProductIdx, setActiveProductIdx] = useState(0);

  const handleProductsScroll = () => {
    if (productsCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        productsCarouselRef.current;
      const scrollPercentage = scrollLeft / (scrollWidth - clientWidth);
      const totalItemsCount = allFeaturedProducts.length + 1;
      const index = Math.round(scrollPercentage * (totalItemsCount - 1));
      if (!isNaN(index)) setActiveProductIdx(index);
    }
  };

  const scrollToProduct = (index: number) => {
    if (productsCarouselRef.current) {
      const { scrollWidth, clientWidth } = productsCarouselRef.current;
      const totalItemsCount = allFeaturedProducts.length + 1;
      const scrollTo =
        (index / (totalItemsCount - 1)) * (scrollWidth - clientWidth);
      productsCarouselRef.current.scrollTo({
        left: scrollTo,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const hasCache = spaCache.has("public_shops");
    fetchConfig();
    fetchShops(hasCache);
    fetchSlots(hasCache);
    fetchAds(hasCache);
    fetchCarousel();

    // Scroll restoration for Featured Products
    const shouldScroll = sessionStorage.getItem("scroll_to_featured");
    if (shouldScroll === "true") {
      sessionStorage.removeItem("scroll_to_featured");
      setTimeout(() => {
        const el = document.getElementById("featured-products");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }

    // Refetch when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchConfig();
        fetchCarousel();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await getPublicViewConfigAction();
      setConfig(data);
      spaCache.set("public_config", data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAds = async (isBackground = false) => {
    try {
      console.log("🔍 Public view: Fetching active ads...");
      const adsData = await getActiveMallAds();
      const tenantPromosData = await getApprovedTenantPromos();

      console.log("📊 Public view: Ads fetched:", adsData.length, "items");
      console.log(
        "📊 Public view: Tenant promos fetched:",
        tenantPromosData.length,
        "items",
      );
      console.log("📊 Public view: Ads data:", adsData);
      console.log("📊 Public view: Tenant promos data:", tenantPromosData);

      setAds(adsData);
      setTenantPromos(tenantPromosData);
      spaCache.set("public_ads", adsData);
      spaCache.set("public_promos", tenantPromosData);

      console.log("📊 Public view: Setting ads state:", adsData);
      console.log(
        "📊 Public view: Setting tenantPromos state:",
        tenantPromosData,
      );
    } catch (error) {
      console.error("❌ Public view: Error fetching ads:", error);
    }
  };

  const fetchCarousel = async () => {
    try {
      const data = await getPublicViewCarouselAction();
      setCarouselItems(data);
      spaCache.set("public_carousel", data);
    } catch (error) {
      console.error("❌ Public view: Error fetching carousel:", error);
    }
  };

  // Force refresh function to manually trigger data fetch
  const refreshAds = () => {
    console.log("🔄 Public view: Manual refresh triggered");
    fetchAds();
  };

  const fetchShops = async (isBackground = false) => {
    if (!isBackground) setLoadingShops(true);
    const res = await getAllStorefrontsAction();
    if (res.success && res.data) {
      setShops(res.data);
      spaCache.set("public_shops", res.data);

      // Aggregate some featured products for the landing page
      const featured = res.data.flatMap((shop: any) =>
        (shop.products || []).map((p: any) => ({
          ...p,
          shopName: shop.shop_name,
          shopId: shop.id,
        })),
      );
      const randomFeatured = featured.sort(() => 0.5 - Math.random()).slice(0, 8);
      setAllFeaturedProducts(randomFeatured);
      spaCache.set("public_featured_products", randomFeatured);
    }
    setLoadingShops(false);
  };

  const fetchSlots = async (isBackground = false) => {
    if (!isBackground) setLoadingSlots(true);
    const res = await getAreaSlots();
    if (res.success && res.data) {
      setSlots(res.data);
      spaCache.set("public_slots", res.data);
    }
    setLoadingSlots(false);
  };

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      shop.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All Categories" ||
      shop.description?.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const filteredSlots = slots.filter((slot) => {
    // If user types "event", "space", or "slot", show all available slots
    const isGenericSpaceSearch = ["event", "space", "slot", "available"].some(
      (term) => searchQuery.toLowerCase().includes(term),
    );

    const matchesSearch =
      slot.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      isGenericSpaceSearch;

    // Show both Available and Reserved slots per user request
    return (
      matchesSearch &&
      (slot.status === "AVAILABLE" || slot.status === "RESERVED")
    );
  });

  const handleSearchClick = () => {
    const isSpaceSearch = ["event", "space", "slot", "available"].some((term) =>
      searchQuery.toLowerCase().includes(term),
    );

    if (isSpaceSearch && filteredSlots.length > 0) {
      document
        .getElementById("availability")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      document
        .getElementById("directory")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 3);
      setIsLoadingMore(false);
    }, 800);
  };

  const handleLoadMoreSlots = () => {
    setIsLoadingMoreSlots(true);
    setTimeout(() => {
      setVisibleSlotsCount((prev) => prev + 4);
      setIsLoadingMoreSlots(false);
    }, 800);
  };

  const visibleShopsArray = filteredShops.slice(0, visibleCount);
  const hasMore = visibleCount < filteredShops.length;

  const visibleSlotsArray = filteredSlots.slice(0, visibleSlotsCount);
  const hasMoreSlots = visibleSlotsCount < filteredSlots.length;

  return (
    <div
      className={clsx(
        "min-h-screen",
        "bg-slate-100",
        "dark:bg-black",
        "font-sans",
        "selection:bg-primary",
        "selection:text-white",
        "overflow-x-hidden",
      )}
    >
      <Navbar />

      {/* High Impact Hero Carousel */}
      {/* High Impact Hero Carousel with Search */}
      <section className={clsx("w-full", "relative", "bg-black", "pt-20")}>
        <AdBanner
          ads={ads}
          tenantPromos={tenantPromos}
          extraItems={carouselItems}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearchClick={handleSearchClick}
          shops={shops}
          allFeaturedProducts={allFeaturedProducts}
          setSelectedProduct={setSelectedProduct}
        />
      </section>

      {/* Upcoming Events Slider */}
      <UpcomingEventsSlider />

      {/* Shop Sales Slider */}
      <ShopSalesSlider shops={shops} />

      {/* Featured Products Showcase */}
      {allFeaturedProducts.length > 0 && (
        <section
          id="featured-products"
          className={clsx(
            "py-12 sm:py-24 lg:py-32",
            "bg-white",
            "dark:bg-zinc-900",
            "border-y",
            "border-slate-100",
            "dark:border-white/5",
            "relative",
            "overflow-hidden",
          )}
        >
          {/* Subtle background element */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
          </div>

          <div
            className={clsx("max-w-7xl", "mx-auto", "px-4", "relative", "z-10")}
          >
            {/* Section header — left-aligned on mobile, side-by-side on sm+ */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8 mb-10 sm:mb-16 text-left">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] bg-primary/5 px-5 py-1.5 rounded-full border border-primary/10 inline-block">
                  Top Picks
                </span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-charcoal dark:text-white tracking-tighter leading-none">
                  Featured <br className="hidden sm:block" />
                  <span className="text-slate-300 dark:text-zinc-800">
                    {" "}
                    Products.
                  </span>
                </h2>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3">
                <p className="max-w-xs text-sm text-slate-500 font-medium leading-relaxed sm:text-right">
                  {config?.productsDescription ||
                    "Handpicked collections from our premier tenants, refreshed daily."}
                </p>
                <Link
                  href="/products"
                  onClick={() => sessionStorage.setItem("scroll_to_featured", "true")}
                  className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary-hover transition-all"
                >
                  View All Products
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </Link>
              </div>
            </div>

            <div className="relative group/products">
              <div
                ref={productsCarouselRef}
                onScroll={handleProductsScroll}
                className={clsx(
                  "flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 overflow-x-auto sm:overflow-x-visible snap-x snap-mandatory no-scrollbar pb-4 pt-4 px-4 sm:px-0",
                  "cursor-grab active:cursor-grabbing",
                )}
              >
                {allFeaturedProducts.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={setSelectedProduct}
                    className="w-[62%] sm:w-full shrink-0 snap-center"
                  />
                ))}

                {/* View All Products Card - Matched to ProductCard Design */}
                <Link
                  href="/products"
                  onClick={() => sessionStorage.setItem("scroll_to_featured", "true")}
                  className={clsx(
                    "w-[62%] sm:w-full shrink-0 snap-center",
                    "group relative aspect-[3/4] bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden",
                    "border-2 border-slate-100 dark:border-white/5 hover:border-primary/30",
                    "shadow-lg hover:shadow-[0_30px_60px_-15px_rgba(190,30,45,0.25)]",
                    "transition-all duration-700 cursor-pointer",
                  )}
                >
                  {/* Background/Overlay */}
                  <div className="absolute inset-0 bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-700 z-10" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white dark:bg-zinc-800 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl z-20 border border-slate-100 dark:border-white/5">
                      <ArrowRight size={32} />
                    </div>
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-30 text-left">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                        Collection
                      </p>
                      <p className="text-2xl font-black text-white uppercase tracking-tighter">
                        View All <br />
                        Products
                      </p>
                    </div>
                  </div>

                  {/* Glass Border Effect on Hover */}
                  <div className="absolute inset-4 border border-white/0 group-hover:border-white/20 rounded-[2.5rem] transition-all duration-700 z-40 pointer-events-none" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onInquire={(shopName) => {
          setChatInitialShopName(shopName);
          setChatRecipient("shop");
          setIsChatOpen(true);
          setSelectedProduct(null);
        }}
      />
      <section
        className={clsx(
          "py-12",
          "sm:py-16",
          "lg:py-24",
          "bg-slate-200",
          "dark:bg-zinc-950",
          "relative",
          "overflow-hidden",
          "border-y",
          "border-slate-300",
          "dark:border-white/5",
        )}
      >
        <div
          className={clsx(
            "absolute",
            "inset-0",
            "bg-primary/5",
            "dark:bg-[#BE1E2D]/5",
          )}
        ></div>
        <div
          className={clsx(
            "max-w-7xl",
            "mx-auto",
            "px-4",
            "relative",
            "z-10",
            "flex",
            "flex-col",
            "md:flex-row",
            "items-center",
            "gap-8",
            "sm:gap-12",
            "lg:gap-16",
          )}
        >
          <div className={clsx("w-full", "md:w-1/2", "space-y-6")}>
            <span
              className={clsx(
                "text-xs",
                "uppercase",
                "tracking-[0.2em]",
                "text-primary",
                "dark:text-[#BE1E2D]",
                "font-black",
                "bg-primary/10",
                "dark:bg-[#BE1E2D]/10",
                "px-4",
                "py-1.5",
                "rounded-full",
                "inline-block",
                "border",
                "border-primary/20",
                "dark:border-[#BE1E2D]/20",
                "shadow-sm",
              )}
            >
              {config?.videoBadge || "Featured Campaign"}
            </span>
            <h2
              className={clsx(
                "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
                "font-black",
                "text-charcoal",
                "dark:text-white",
                "tracking-tight",
                "leading-tight",
                "drop-shadow-lg",
              )}
            >
              {config?.videoTitle || "Elevate Your Lifestyle."}
            </h2>
            <p
              className={clsx(
                "text-slate-600",
                "dark:text-slate-400",
                "font-medium",
                "text-base",
                "sm:text-lg",
                "leading-relaxed",
                "max-w-lg",
              )}
            >
              {config?.videoDescription ||
                "Watch our latest visual showcase highlighting the premier shopping and dining experiences waiting for you at SR Mall. Immerse yourself in the extraordinary."}
            </p>
            <button suppressHydrationWarning
              onClick={() => setIsVideoModalOpen(true)}
              className={clsx(
                "px-6",
                "sm:px-8",
                "py-3",
                "sm:py-4",
                "bg-primary",
                "dark:bg-[#BE1E2D]",
                "text-white",
                "font-bold",
                "rounded-xl",
                "hover:bg-primary/90",
                "dark:hover:bg-[#9E1B26]",
                "transition-all",
                "shadow-xl",
                "shadow-primary/30",
                "dark:shadow-[#BE1E2D]/30",
                "active:scale-95",
                "group",
                "flex",
                "items-center",
                "gap-3",
                "text-sm",
                "sm:text-base",
              )}
            >
              Watch Full Campaign
              <ArrowRight
                size={18}
                className={clsx(
                  "group-hover:translate-x-1",
                  "transition-transform",
                )}
              />
            </button>
          </div>

          <div className={clsx("w-full", "md:w-1/2", "relative", "group")}>
            <div
              className={clsx(
                "absolute",
                "-inset-4",
                "bg-gradient-to-r",
                "from-primary",
                "dark:from-[#BE1E2D]",
                "to-blue-600",
                "rounded-[3rem]",
                "blur-xl",
                "opacity-20",
                "group-hover:opacity-40",
                "transition",
                "duration-1000",
              )}
            ></div>
            <div
              className={clsx(
                "relative",
                "aspect-video",
                "bg-black",
                "rounded-4xl",
                "overflow-hidden",
                "border",
                "border-slate-200",
                "dark:border-white/10",
                "shadow-2xl",
              )}
            >
              <video
                src={config?.featuredVideoUrl || "/vid/Download.mp4"}
                className={clsx(
                  "w-full",
                  "h-full",
                  "object-cover",
                  "opacity-80",
                  "group-hover:opacity-100",
                  "transition-opacity",
                  "duration-700",
                )}
                autoPlay
                loop
                muted
                playsInline
              />
              <div
                className={clsx(
                  "absolute",
                  "inset-0",
                  "bg-gradient-to-t",
                  "from-black/90",
                  "via-black/20",
                  "to-transparent",
                  "flex",
                  "items-end",
                  "p-4",
                  "sm:p-8",
                )}
              >
                <div
                  className={clsx(
                    "flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4",
                  )}
                >
                  <div
                    className={clsx(
                      "w-10 h-10 sm:w-12 sm:h-12 bg-primary dark:bg-[#BE1E2D] text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white/20 animate-pulse cursor-pointer hover:scale-110 transition-transform flex-shrink-0",
                    )}
                  >
                    <svg
                      className={clsx("w-4 h-4 sm:w-5 sm:h-5 translate-x-0.5")}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4
                      className={clsx(
                        "text-sm sm:text-base text-white font-bold tracking-wide",
                      )}
                    >
                      {config?.featuredVideoTitle ||
                        "SR Mall Cinematic Experience"}
                    </h4>
                    <p
                      className={clsx(
                        "text-slate-300 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold",
                      )}
                    >
                      Now Playing
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shop Directory Section */}
      <section
        id="directory"
        className={clsx(
          "py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-zinc-950",
        )}
      >
        <div className={clsx("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8")}>
          {/* Section Header */}
          <div className={clsx("relative", "mb-16", "sm:mb-20")}>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-2xl">
                <span
                  className={clsx(
                    "inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-primary bg-primary/10 px-6 py-2 rounded-full mb-6 border border-primary/20",
                  )}
                >
                  Premium Collection
                </span>
                <h2
                  className={clsx(
                    "text-4xl",
                    "sm:text-6xl",
                    "lg:text-7xl",
                    "font-black",
                    "text-charcoal",
                    "dark:text-white",
                    "tracking-tighter",
                    "leading-[0.95]",
                    "lg:leading-[0.9]",
                    "mb-6",
                    "sm:mb-8",
                  )}
                >
                  Mall <br />
                  <span className="text-slate-300 dark:text-zinc-800">
                    Directory.
                  </span>
                </h2>
                <p
                  className={clsx(
                    "text-sm",
                    "sm:text-lg",
                    "text-slate-500",
                    "dark:text-slate-400",
                    "font-medium",
                    "leading-relaxed",
                    "max-w-xl",
                  )}
                >
                  Navigate through our curated ecosystem of high-end retail,
                  digital-first storefronts, and world-class dining
                  destinations.
                </p>
              </div>

              {/* In-Section Search Input */}
              <div className="w-full lg:w-96 flex flex-col items-start lg:items-end gap-4">
                <Link
                  href="/tenant-directory"
                  className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary-hover transition-all"
                >
                  View All Tenant Directory
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </Link>
                <div className="relative group w-full">
                  <Search
                    size={20}
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
                  />
                  <input suppressHydrationWarning
                    type="text"
                    placeholder="Search stores, brands, or unit IDs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none"
                  />

                  {/* Predictive Search Panel */}
                  {searchQuery && (
                    <div className="absolute top-full left-0 w-full mt-2 sm:mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-3 sm:p-4 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Recommended Matches
                        </span>
                        <button suppressHydrationWarning onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-charcoal transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="max-h-60 sm:max-h-80 overflow-y-auto no-scrollbar">
                        {shops
                          .filter((s) =>
                            s.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.description || "").toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .slice(0, 5)
                          .map((s) => (
                            <Link
                              key={s.id}
                              href={`/shop/${s.id}`}
                              className="w-full p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 text-left group/item"
                            >
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                                <img
                                  src={s.logo_url || "/images/logo/logoshop.jpg"}
                                  className="w-full h-full object-cover group-hover/item:scale-110 transition-transform"
                                  alt="Shop Logo"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] sm:text-xs font-black text-charcoal dark:text-white line-clamp-1 uppercase">
                                  {s.shop_name}
                                </p>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {s.unit_id} — Plaza Wing
                                </p>
                              </div>
                              <Navigation
                                size={12}
                                className="text-slate-300 group-hover/item:text-primary transition-colors sm:size-[14px]"
                              />
                            </Link>
                          ))}
                        {shops.filter((s) =>
                          s.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.description || "").toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                            <div className="p-6 sm:p-8 text-center text-slate-400">
                              <Search size={24} className="mx-auto mb-2 opacity-20" />
                              <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                                No matching shops found
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Icon-based Category Switcher */}
          <div
            className={clsx(
              "flex",
              "items-center",
              "gap-3",
              "sm:gap-4",
              "mb-10",
              "sm:mb-16",
              "pb-4",
              "overflow-x-auto",
              "no-scrollbar",
              "touch-pan-x",
              "relative",
            )}
          >
            {/* Scroll Indication for Mobile */}
            <div className="lg:hidden absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-slate-100 dark:from-zinc-950 to-transparent pointer-events-none z-20"></div>
            {[
              {
                id: "All Categories",
                label: "Everything",
                icon: <ShoppingBag size={16} />,
              },
              { id: "Food", label: "Gastronomy", icon: <Coffee size={16} /> },
              { id: "Tech", label: "Innovation", icon: <Zap size={16} /> },
              { id: "Fashion", label: "Couture", icon: <Shirt size={16} /> },
              {
                id: "Dining",
                label: "Experience",
                icon: <Sparkles size={16} />,
              },
              { id: "Electronics", label: "Digital", icon: <Tag size={16} /> },
            ].map((cat) => (
              <button suppressHydrationWarning
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border-2",
                  selectedCategory === cat.id
                    ? "bg-primary text-white border-primary shadow-[0_10px_30px_-5px_rgba(190,30,45,0.4)] scale-105 z-10"
                    : "bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border-slate-50 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10",
                )}
              >
                <span
                  className={
                    selectedCategory === cat.id
                      ? "text-white"
                      : "text-slate-300"
                  }
                >
                  {cat.icon}
                </span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative group/carousel">
            {/* Carousel Container */}
            <div
              id="directory-carousel"
              className={clsx(
                "flex sm:grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 overflow-x-auto sm:overflow-x-visible scroll-smooth no-scrollbar snap-x snap-mandatory gap-6 px-4 sm:px-0",
                "cursor-grab active:cursor-grabbing pb-12",
              )}
            >
              {loadingShops ? (
                <div
                  className={clsx(
                    "w-full shrink-0",
                    "py-20",
                    "text-center",
                    "space-y-4",
                    "snap-center",
                  )}
                >
                  <Loader2
                    size={40}
                    className={clsx("animate-spin", "text-primary", "mx-auto")}
                  />
                  <p
                    className={clsx(
                      "text-sm",
                      "font-bold",
                      "text-slate-400",
                      "uppercase",
                      "tracking-widest",
                    )}
                  >
                    Loading Premium Collection...
                  </p>
                </div>
              ) : visibleShopsArray.length > 0 ? (
                <>
                  {visibleShopsArray.map((shop, index) => (
                    <div
                      key={shop.id}
                      className="w-[85%] sm:w-full shrink-0 snap-center animate-fade-in-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ShopCard
                        shop={shop}
                        onMessage={(name) => {
                          setChatInitialShopName(name);
                          setChatRecipient("shop");
                          setIsChatOpen(true);
                        }}
                      />
                    </div>
                  ))}

                  {/* View All Shops Card - Matched to ShopCard Design */}
                  <Link
                    href="/tenant-directory"
                    className={clsx(
                      "w-[85%] sm:w-full shrink-0 snap-center",
                      "group relative bg-white dark:bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-[0_40px_80px_-15px_rgba(190,30,45,0.25)] transition-all duration-700 border-2 border-slate-100 dark:border-white/5 hover:border-primary/20 cursor-pointer",
                    )}
                  >
                    {/* Top Media Area */}
                    <div className="relative h-48 sm:h-64 md:h-72 overflow-hidden bg-slate-50 dark:bg-zinc-900 flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white dark:bg-zinc-800 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl z-10 border border-slate-100 dark:border-white/5">
                        <ArrowRight size={32} />
                      </div>
                    </div>

                    {/* Bottom Info Area */}
                    <div className="p-6 sm:p-10 relative">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-3xl font-black text-charcoal dark:text-white tracking-tighter group-hover:text-primary transition-colors leading-none mb-3 uppercase">
                          View All <br />
                          Shops
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1 bg-primary/5 border border-primary/20 rounded-md flex items-center gap-2">
                            <Tag size={12} className="text-primary" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                              Directory
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                            Full Listing
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </>
              ) : (
                <div
                  className={clsx(
                    "w-full shrink-0 snap-center",
                    "py-20",
                    "text-center",
                    "bg-zinc-50",
                    "dark:bg-zinc-900",
                    "rounded-[3rem]",
                    "border",
                    "border-dashed",
                    "border-slate-200",
                    "dark:border-white/10",
                  )}
                >
                  <p
                    className={clsx(
                      "text-slate-500",
                      "font-bold",
                      "uppercase",
                      "tracking-widest",
                      "text-sm",
                    )}
                  >
                    No storefronts matching your search found.
                  </p>
                </div>
              )}
            </div>

            {/* Pagination Dots */}
            {!loadingShops && visibleShopsArray.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex sm:hidden gap-3">
                {visibleShopsArray.slice(0, 10).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-2 h-2 rounded-full bg-slate-200 dark:bg-zinc-800 transition-all"
                  ></div>
                ))}
              </div>
            )}
          </div>

          {hasMore && (
            <div className={clsx("mt-12 sm:mt-16 text-center")}>
              <button suppressHydrationWarning
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={clsx(
                  "inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-zinc-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-primary font-bold uppercase text-xs tracking-wider sm:tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-zinc-800 hover:border-primary transition-all active:scale-95 disabled:opacity-70 shadow-sm",
                )}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2
                      size={16}
                      className={clsx(
                        "animate-spin",
                        "sm:w-[18px]",
                        "sm:h-[18px]",
                      )}
                    />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More{" "}
                    <ArrowRight
                      size={16}
                      className={clsx(
                        "group-hover:translate-x-1",
                        "transition-transform",
                        "sm:w-[18px]",
                        "sm:h-[18px]",
                      )}
                    />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Available Spaces Section */}
      <section
        id="availability"
        className={clsx(
          "py-24 sm:py-32 lg:py-40",
          "bg-white dark:bg-black",
          "relative",
          "overflow-hidden",
        )}
      >
        {/* Professional Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3 opacity-50"></div>
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] dark:opacity-[0.05] invert dark:invert-0"></div>
        </div>

        <div
          className={clsx(
            "max-w-7xl",
            "mx-auto",
            "px-4",
            "sm:px-6",
            "lg:px-8",
            "relative",
            "z-10",
          )}
        >
          {/* Section Header */}
          <div
            className={clsx(
              "flex",
              "flex-col",
              "lg:flex-row",
              "items-start",
              "lg:items-end",
              "justify-between",
              "gap-8",
              "mb-12",
              "sm:mb-20",
            )}
          >
            <div className="max-w-2xl space-y-6">
              <span
                className={clsx(
                  "inline-flex",
                  "items-center",
                  "gap-2",
                  "text-[10px]",
                  "sm:text-[11px]",
                  "uppercase",
                  "tracking-[0.3em]",
                  "text-primary",
                  "font-black",
                  "bg-primary/10",
                  "px-5",
                  "py-2",
                  "rounded-full",
                  "border",
                  "border-primary/20",
                )}
              >
                Leasing Opportunities
              </span>
              <h2
                className={clsx(
                  "text-4xl",
                  "sm:text-5xl",
                  "lg:text-7xl",
                  "font-black",
                  "text-charcoal",
                  "dark:text-white",
                  "tracking-tighter",
                  "leading-[0.95]",
                )}
              >
                Available <br />
                <span className="text-slate-300 dark:text-zinc-800">
                  Spaces.
                </span>
              </h2>
              <p
                className={clsx(
                  "text-sm",
                  "sm:text-lg",
                  "text-slate-500",
                  "dark:text-slate-400",
                  "font-medium",
                  "max-w-xl",
                  "leading-relaxed",
                )}
              >
                Join our premium retail ecosystem. Explore high-visibility slots
                designed for modern brands and start your journey at SR Mall.
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-4 w-full lg:w-auto">
              <Link
                href="/available-spaces"
                className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary-hover transition-all"
              >
                View All Spaces
                <ArrowRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <button suppressHydrationWarning
                className={clsx(
                  "inline-flex",
                  "items-center",
                  "gap-3",
                  "px-8",
                  "py-5",
                  "bg-primary",
                  "text-white",
                  "rounded-2xl",
                  "text-xs",
                  "font-black",
                  "uppercase",
                  "tracking-[0.2em]",
                  "hover:bg-primary-hover",
                  "hover:scale-105",
                  "transition-all",
                  "active:scale-95",
                  "shadow-[0_20px_40px_-10px_rgba(190,30,45,0.4)]",
                  "justify-center",
                  "w-full sm:w-auto",
                )}
                onClick={() => {
                  setChatInitialShopName("Leasing Inquiry");
                  setChatRecipient("admin");
                  setChatInquirySlotId(null);
                  setIsChatOpen(true);
                }}
              >
                <MessageCircle size={18} />
                Talk to Leasing Agent
              </button>
            </div>
          </div>

          <div className="relative group/carousel-spaces">
            {/* Carousel Container */}
            <div
              id="spaces-carousel"
              className={clsx(
                "flex sm:grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 overflow-x-auto sm:overflow-x-visible scroll-smooth no-scrollbar snap-x snap-mandatory gap-8 px-4 sm:px-0",
                "cursor-grab active:cursor-grabbing pb-12",
              )}
            >
              {loadingSlots ? (
                <div
                  className={clsx(
                    "w-full shrink-0 snap-center",
                    "py-20",
                    "text-center",
                    "space-y-6",
                  )}
                >
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p
                    className={clsx(
                      "text-xs",
                      "font-black",
                      "uppercase",
                      "tracking-widest",
                      "text-slate-400",
                    )}
                  >
                    Synchronizing Inventory...
                  </p>
                </div>
              ) : visibleSlotsArray.length > 0 ? (
                visibleSlotsArray.map((slot, idx) => (
                  <div
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={clsx(
                      "w-[85%] sm:w-full",
                      "shrink-0 snap-center group relative bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 cursor-pointer shadow-sm hover:shadow-2xl hover:-translate-y-2 animate-fade-in-up",
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div
                      className={clsx(
                        "aspect-[16/10]",
                        "relative",
                        "overflow-hidden",
                        "bg-slate-100",
                        "dark:bg-black",
                      )}
                    >
                      {slot.space_images && slot.space_images[0] ? (
                        <img
                          src={slot.space_images[0]}
                          alt={`Space ${slot.unit_id}`}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                          <ShoppingBag className="w-12 h-12 text-slate-200 dark:text-zinc-800 mb-4" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
                            Premium Unit <br />
                            Preview Pending
                          </p>
                        </div>
                      )}

                      {/* Professional Glassmorphism Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>

                      <div className={clsx("absolute", "top-6", "right-6")}>
                        <div
                          className={clsx(
                            "backdrop-blur-xl px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl",
                            slot.status === "AVAILABLE"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : "bg-amber-500/20 border-amber-500/40 text-amber-400",
                          )}
                        >
                          {slot.status === "AVAILABLE"
                            ? "Available Now"
                            : "Reserved"}
                        </div>
                      </div>

                      <div
                        className={clsx(
                          "absolute",
                          "bottom-6",
                          "left-8",
                          "right-8",
                        )}
                      >
                        <h4
                          className={clsx(
                            "text-3xl font-black text-white tracking-tighter uppercase leading-none",
                          )}
                        >
                          Unit {slot.unit_id}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={clsx("w-1.5 h-1.5 rounded-full", slot.status === "AVAILABLE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")}></div>
                          <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                            Plaza Wing — Level 1
                          </p>
                        </div>
                      </div>

                      {/* Action Button on Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
                        <div className="px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-3xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          Inquire Details
                        </div>
                      </div>
                    </div>

                    <div
                      className={clsx(
                        "p-8",
                        "flex",
                        "items-center",
                        "justify-between",
                        "bg-white",
                        "dark:bg-zinc-900/50",
                      )}
                    >
                      <div className="space-y-1.5">
                        <p
                          className={clsx(
                            "text-[10px]",
                            "font-black",
                            "text-slate-400",
                            "uppercase",
                            "tracking-[0.3em]",
                          )}
                        >
                          Floor Area
                        </p>
                        <div className="flex items-baseline gap-1">
                          <p
                            className={clsx(
                              "text-3xl",
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                              "tracking-tighter",
                            )}
                          >
                            {slot.sqm_size}
                          </p>
                          <span className="text-xs font-black text-primary">SQM</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lease Terms</span>
                        <span className="text-xs font-black text-charcoal dark:text-white uppercase">Flexible</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className={clsx(
                    "w-full shrink-0 snap-center",
                    "py-20",
                    "text-center",
                    "bg-slate-50",
                    "dark:bg-zinc-900",
                    "border-2",
                    "border-dashed",
                    "border-slate-200",
                    "dark:border-white/5",
                    "rounded-[3rem]",
                  )}
                >
                  <p
                    className={clsx(
                      "text-sm",
                      "font-bold",
                      "text-slate-500",
                      "uppercase",
                      "tracking-widest",
                    )}
                  >
                    No spaces currently available for lease.
                  </p>
                </div>
              )}

              {/* View All Spaces Card - Matched to Slot Card Design */}
              {!loadingSlots && (
                <Link
                  href="/available-spaces"
                  className={clsx(
                    "w-[85%] sm:w-full shrink-0 snap-center",
                    "group relative bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 cursor-pointer shadow-sm hover:shadow-2xl hover:-translate-y-2",
                  )}
                >
                  <div className={clsx("aspect-[16/10]", "relative", "overflow-hidden", "bg-slate-50", "dark:bg-zinc-950", "flex items-center justify-center")}>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white dark:bg-zinc-800 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl z-10 border border-slate-100 dark:border-white/5">
                      <ArrowRight size={32} />
                    </div>
                  </div>

                  <div
                    className={clsx(
                      "p-8",
                      "flex",
                      "items-center",
                      "justify-between",
                      "bg-white",
                      "dark:bg-zinc-900/50",
                    )}
                  >
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Inventory
                      </p>
                      <p className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter">
                        View All <br />
                        Spaces
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Explore</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Full Map</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            {/* Pagination Dots */}
            {!loadingSlots && visibleSlotsArray.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex sm:hidden gap-3">
                {visibleSlotsArray.slice(0, 10).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-2 h-2 rounded-full bg-slate-200 dark:bg-zinc-800 transition-all"
                  ></div>
                ))}
              </div>
            )}
          </div>

          {hasMoreSlots && (
            <div className={clsx("mt-10 sm:mt-12 text-center")}>
              <button suppressHydrationWarning
                onClick={handleLoadMoreSlots}
                disabled={isLoadingMoreSlots}
                className={clsx(
                  "inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-zinc-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-primary font-bold uppercase text-xs tracking-wider sm:tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-zinc-800 hover:border-primary transition-all active:scale-95 disabled:opacity-70 shadow-sm",
                )}
              >
                {isLoadingMoreSlots ? (
                  <>
                    <Loader2
                      size={16}
                      className={clsx(
                        "animate-spin",
                        "sm:w-[18px]",
                        "sm:h-[18px]",
                      )}
                    />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More Spaces{" "}
                    <ArrowRight
                      size={16}
                      className={clsx(
                        "group-hover:translate-x-1",
                        "transition-transform",
                        "sm:w-[18px]",
                        "sm:h-[18px]",
                      )}
                    />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Space Detail Modal */}
      {selectedSlot && (
        <SpaceDetailModal
          slot={selectedSlot as any}
          onClose={() => setSelectedSlot(null)}
          onLoginRequired={() => setIsLoginModalOpen(true)}
          onInquire={(unitId) => {
            setChatInitialShopName(`Leasing Inquiry for Unit ${unitId}`);
            setChatRecipient("admin");
            setChatInquirySlotId(unitId);
            setIsChatOpen(true);
            setSelectedSlot(null);
          }}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* High-Impact Event Inquiry Section */}
      <section
        id="event-inquiry"
        className={clsx(
          "py-12 sm:py-20 bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden",
        )}
      >
        {/* Background Visual Elements */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-0 w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-primary rounded-full blur-[100px] sm:blur-[200px] translate-x-1/2"></div>
          <div className="absolute bottom-1/4 left-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-blue-600 rounded-full blur-[100px] sm:blur-[150px] -translate-x-1/2"></div>
        </div>

        <div
          className={clsx(
            "max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10",
          )}
        >
          <div className="text-center mb-8 sm:mb-16">
            <span className="inline-block px-4 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4 border border-primary/20">
              Elite Venue Booking
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-black dark:text-white tracking-tighter leading-tight mb-4">
              Plan Your Next{" "}
              <span className="text-slate-300 dark:text-zinc-800">
                Masterpiece.
              </span>
            </h2>
            <p className="max-w-xl mx-auto text-xs sm:text-base text-slate-500 font-medium leading-relaxed">
              Digital-ready spaces for corporate exhibits or regional finals.
            </p>
          </div>

          <EventInquiryForm isAuthenticated={isAuthenticated} user={user} />
        </div>
      </section>

      {/* Gated Feedback & Communication */}
      <FeedbackSection isAuthenticated={isAuthenticated} />

      {/* Location Section */}
      <section
        id="location"
        className={clsx(
          "py-16",
          "sm:py-24",
          "lg:py-32",
          "bg-slate-100",
          "dark:bg-black",
        )}
      >
        <div
          className={clsx(
            "max-w-7xl",
            "mx-auto",
            "px-4",
            "grid",
            "grid-cols-1",
            "lg:grid-cols-2",
            "gap-12",
            "sm:gap-16",
            "lg:gap-24",
            "items-center",
          )}
        >
          <div className={clsx("space-y-10", "order-2", "lg:order-1")}>
            <div className="space-y-4">
              <span
                className={clsx(
                  "text-xs",
                  "uppercase",
                  "tracking-[0.2em]",
                  "text-primary",
                  "font-bold",
                  "bg-primary/10",
                  "px-4",
                  "py-1.5",
                  "rounded-full",
                  "inline-block",
                )}
              >
                Visit Us
              </span>
              <h2
                className={clsx(
                  "text-3xl",
                  "sm:text-4xl",
                  "lg:text-5xl",
                  "font-black",
                  "text-charcoal",
                  "dark:text-white",
                  "tracking-tight",
                  "leading-tight",
                )}
              >
                Prime Location. <br />
                <span className="text-slate-400">Endless Access.</span>
              </h2>
            </div>

            <div className="space-y-8">
              <div
                className={clsx(
                  "group flex flex-col sm:flex-row items-start gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5 transition-all hover:shadow-xl",
                )}
              >
                <div
                  className={clsx(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-black flex items-center justify-center text-primary shadow-sm border border-slate-200 dark:border-white/5 flex-shrink-0",
                  )}
                >
                  <MapPin size={24} />
                </div>
                <div>
                  <h4
                    className={clsx(
                      "text-base sm:text-lg font-bold text-charcoal dark:text-white mb-1 sm:mb-2",
                    )}
                  >
                    Physical Address
                  </h4>
                  <p
                    className={clsx(
                      "text-xs sm:text-sm text-slate-500 font-medium leading-relaxed",
                    )}
                  >
                    Crossing Villanueva, Misamis Oriental, <br />
                    9002, Philippines
                  </p>
                </div>
              </div>

              <a
                href="https://www.google.com/maps/place/Sophie+Red+Mall/@8.6403138,124.761748,17z/data=!4m6!3m5!1s0x32ffe583faa1a8b5:0x4465b912f19f4403!8m2!3d8.6401918!4d124.7642264!16s%2Fg%2F11r9ngrmtw?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "group flex flex-col sm:flex-row items-start gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-primary text-white transition-all hover:shadow-2xl hover:shadow-primary/30 cursor-pointer",
                )}
              >
                <div
                  className={clsx(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md flex-shrink-0",
                  )}
                >
                  <Navigation size={24} />
                </div>
                <div>
                  <h4
                    className={clsx(
                      "text-base sm:text-lg font-bold mb-1 sm:mb-2",
                    )}
                  >
                    Get Directions
                  </h4>
                  <p
                    className={clsx(
                      "text-xs sm:text-sm text-white/70 font-medium leading-relaxed",
                    )}
                  >
                    Open in Google Maps for the fastest route <br />
                    from your current location.
                  </p>
                </div>
              </a>
            </div>
          </div>

          <div className={clsx("relative", "order-1", "lg:order-2")}>
            <div
              className={clsx(
                "aspect-square",
                "bg-slate-100",
                "dark:bg-zinc-900",
                "rounded-[3rem]",
                "overflow-hidden",
                "group",
                "shadow-2xl",
                "border-8",
                "border-zinc-100",
                "dark:border-zinc-900/50",
              )}
            >
              <iframe
                src="https://maps.google.com/maps?q=Sophie%20Red%20Mall%20Villanueva&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className={clsx(
                  "grayscale",
                  "group-hover:grayscale-0",
                  "transition-all",
                  "duration-700",
                  "contrast-125",
                )}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button for Chat - Available for all, but gated inside */}
      <button suppressHydrationWarning
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-10 sm:right-10 w-14 h-14 sm:w-20 sm:h-20 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all z-50 group ${isChatOpen ? "rotate-90" : ""}`}
      >
        {isChatOpen ? <X size={32} /> : <MessageCircle size={32} />}
        {!isChatOpen && (
          <span
            className={clsx(
              "absolute",
              "-top-2",
              "-right-2",
              "bg-blue-500",
              "text-white",
              "text-[10px]",
              "font-bold",
              "px-2",
              "py-1",
              "rounded-full",
              "border-2",
              "border-white",
              "dark:border-black",
            )}
          >
            LIVE
          </span>
        )}
      </button>

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialShopName={chatInitialShopName}
        initialRecipient={chatRecipient}
        inquirySlotId={chatInquirySlotId}
      />

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "z-50",
            "flex",
            "items-center",
            "justify-center",
            "bg-black/95",
            "backdrop-blur-md",
            "p-4",
          )}
        >
          <button suppressHydrationWarning
            onClick={() => setIsVideoModalOpen(false)}
            className={clsx(
              "absolute",
              "top-6",
              "right-6",
              "z-50",
              "p-3",
              "bg-white/10",
              "hover:bg-white/20",
              "text-white",
              "rounded-full",
              "transition-all",
            )}
          >
            <X size={24} />
          </button>
          <div
            className={clsx(
              "w-full",
              "max-w-5xl",
              "aspect-video",
              "bg-black",
              "rounded-2xl",
              "overflow-hidden",
              "shadow-2xl",
              "border",
              "border-white/10",
              "relative",
            )}
          >
            <video
              src={config?.featuredVideoUrl || "/vid/Download.mp4"}
              className={clsx("w-full", "h-full", "object-contain")}
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
