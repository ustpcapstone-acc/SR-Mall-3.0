"use client";

import { optimizedImage } from "@/lib/media";
import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ShopCard } from "@/components/shop-card";
import { AdBanner } from "@/components/ad-banner";
import { UpcomingEventsSlider } from "@/components/upcoming-events-slider";
import { ShopSalesSlider } from "@/components/shop-sales-slider";
import dynamic from "next/dynamic";
import {
  Search,
  MapPin,
  Mail,
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
  PhilippinePeso,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import { DigitalStorefront } from "@/types/storefront";
import { loadStorefronts, primeSharedRequest } from "@/lib/shared-request";
import { getHomePageDataAction } from "@/app/actions/home";
import { getPublicAreaSlots } from "@/app/actions/space-slot";

import { AreaSlot } from "@srmall/database";
import { getActiveMallAds, getApprovedTenantPromos } from "@/app/actions/ads";
import {
  getPublicViewConfigAction,
  getPublicViewCarouselAction,
} from "@/app/actions/cms";
import { applyThemeColor, mapEmbedSrc, PUBLIC_CONFIG_CACHE_KEY } from "@/lib/theme";
import { mergeSlotPatch, slotAccess, useLiveSlots } from "@/lib/slot-live";
import { toast } from "sonner";
import { ProductCard } from "@/components/product-card";
import { hasAssignedUnit, productHref } from "@/lib/products";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useChatUnread } from "@/lib/chat-unread";
import { AboutMall } from "@/components/landing/about-mall";
import { Reveal } from "@/components/landing/reveal";
import { ShopsMarquee } from "@/components/landing/shops-marquee";

// Below the fold or opened on demand: loaded in their own chunks so the first
// screen downloads less JavaScript.
const FeedbackSection = dynamic(() => import("@/components/feedback-section").then((m) => m.FeedbackSection));
const EventInquiryForm = dynamic(() => import("@/components/event-inquiry-form").then((m) => m.EventInquiryForm));
const ChatBox = dynamic(() => import("@/components/chat-box").then((m) => m.ChatBox), { ssr: false });
const LoginModal = dynamic(() => import("@/components/login-modal").then((m) => m.LoginModal), { ssr: false });
const SpaceDetailModal = dynamic(() => import("@/components/space-detail-modal"), { ssr: false });

// Directory category buttons → keywords matched against the shop's category.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ["food", "beverage", "dining", "restaurant", "cafe", "coffee", "drink"],
  fashion: ["fashion", "apparel", "clothing", "wear"],
  tech: ["electronic", "tech", "gadget", "digital"],
  beauty: ["health", "wellness", "beauty", "cosmetic"],
  services: ["service"],
};

function shopMatchesCategory(category: string | null | undefined, selected: string) {
  if (selected === "All Categories") return true;
  const c = (category || "").toLowerCase();
  if (selected === "other") {
    return !Object.values(CATEGORY_KEYWORDS).some((words) => words.some((w) => c.includes(w)));
  }
  return (CATEGORY_KEYWORDS[selected] || []).some((w) => c.includes(w));
}

/** Two-line section heading: first line dark, the rest in the muted accent. */
function SectionTitleLines({
  text,
  accentClass,
  breakClassName,
}: {
  text: string;
  accentClass: string;
  breakClassName?: string;
}) {
  const [first, ...rest] = text.split(/\r?\n/);
  return (
    <>
      {first}
      {rest.length > 0 && (
        <>
          <br className={breakClassName} />{" "}
          <span className={accentClass}>{rest.join(" ")}</span>
        </>
      )}
    </>
  );
}

export default function PublicDigitalConcierge() {
  const { isAuthenticated, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleSlotsCount, setVisibleSlotsCount] = useState(4);
  const [isLoadingMoreSlots, setIsLoadingMoreSlots] = useState(false);
  const [config, setConfig] = useState<any>(() => spaCache.get("public_config") || null);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [shops, setShops] = useState<DigitalStorefront[]>(() => spaCache.get("public_shops") || []);
  const [loadingShops, setLoadingShops] = useState(() => !spaCache.has("public_shops"));
  // Live unread chat count (same source as the bell's Messages tab).
  const unreadMessages = useChatUnread(user?.id).total;
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
  // Featured Campaign preview: autoplays muted (browser rule); the viewer can unmute.
  const campaignVideoRef = useRef<HTMLVideoElement>(null);
  const [campaignMuted, setCampaignMuted] = useState(true);
  useEffect(() => {
    // The preview only downloads and plays while it is on screen, and never
    // starts by itself for people who ask for reduced motion.
    const video = campaignVideoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reduce) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Opening the full video silences the preview so two sounds never overlap.
    if (isVideoModalOpen && campaignVideoRef.current) {
      campaignVideoRef.current.muted = true;
      setCampaignMuted(true);
    }
  }, [isVideoModalOpen]);
  const toggleCampaignSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = campaignVideoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) {
      if (v.volume === 0) v.volume = 1;
      void v.play().catch(() => {});
    }
    setCampaignMuted(v.muted);
  };
  const [ads, setAds] = useState<any[]>(() => spaCache.get("public_ads") || []);
  const [adsLoaded, setAdsLoaded] = useState(() => spaCache.has("public_ads"));
  const [tenantPromos, setTenantPromos] = useState<any[]>(() => spaCache.get("public_promos") || []);
  const [carouselItems, setCarouselItems] = useState<any[]>(() => spaCache.get("public_carousel") || []);
  const router = useRouter();
  // Products open their own page (/products/[shopId]/[productId]).
  const setSelectedProduct = (p: any) => {
    if (p?.shopId && p?.id) router.push(productHref(p.shopId, p.id));
  };
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
    void loadHome(hasCache);

    // Scroll restoration for Featured Products
    const shouldScroll = sessionStorage.getItem("scroll_to_featured");
    if (shouldScroll === "true") {
      sessionStorage.removeItem("scroll_to_featured");
      // Execute scroll at multiple intervals to handle dynamic layout adjustments on mobile/slow networks
      const scrollDelays = [150, 450, 850, 1400, 2000];
      scrollDelays.forEach((delay) => {
        setTimeout(() => {
          const el = document.getElementById("featured-products");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, delay);
      });
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

  // Apply theme color from CMS config to CSS variables
  useEffect(() => {
    applyThemeColor(config?.themeColor);
  }, [config?.themeColor]);

  // Handle URL query parameters and global events to open ChatBox directly from notifications
  useEffect(() => {
    const checkChatParams = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const isChatUrl = params.get("chat") === "open" || params.get("chat") === "true";
      const stored = sessionStorage.getItem("pending_chat_open");

      if (isChatUrl || stored) {
        let recipient: "shop" | "admin" | null = null;
        let shop: string | null = null;

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            recipient = parsed.recipient || null;
            shop = parsed.shop || null;
          } catch (err) {}
          sessionStorage.removeItem("pending_chat_open");
        }

        if (!recipient) {
          const urlRecipient = params.get("recipient") as "shop" | "admin" | null;
          if (urlRecipient === "admin" || urlRecipient === "shop") {
            recipient = urlRecipient;
          }
        }
        if (!shop) {
          const urlShop = params.get("shop");
          if (urlShop) shop = decodeURIComponent(urlShop);
        }

        setIsChatOpen(true);
        if (recipient === "admin") {
          setChatRecipient("admin");
          setChatInitialShopName(null);
        } else if (recipient === "shop" || shop) {
          setChatRecipient("shop");
          setChatInitialShopName(shop || null);
        } else {
          setChatRecipient(null);
          setChatInitialShopName(null);
        }
      }
    };

    checkChatParams();

    const handleOpenMallChat = (e: any) => {
      setIsChatOpen(true);
      const recipient = e.detail?.recipient as "shop" | "admin" | null;
      const shop = e.detail?.shop as string | null;

      if (recipient === "admin") {
        setChatRecipient("admin");
        setChatInitialShopName(null);
      } else if (recipient === "shop" || shop) {
        setChatRecipient("shop");
        setChatInitialShopName(shop || null);
      } else {
        setChatRecipient(null);
        setChatInitialShopName(null);
      }
    };

    window.addEventListener("open-mall-chat", handleOpenMallChat);
    window.addEventListener("popstate", checkChatParams);
    return () => {
      window.removeEventListener("open-mall-chat", handleOpenMallChat);
      window.removeEventListener("popstate", checkChatParams);
    };
  }, []);

  // First load: one round trip for everything (see getHomePageDataAction).
  // Later refreshes (tab focus, live slots) still use the single reads below.
  const loadHome = async (hasCache: boolean) => {
    if (!hasCache) {
      setLoadingShops(true);
      setLoadingSlots(true);
    }
    let d: Awaited<ReturnType<typeof getHomePageDataAction>>;
    try {
      d = await getHomePageDataAction();
    } catch (e) {
      console.error(e);
      fetchConfig();
      fetchShops(hasCache);
      fetchSlots(hasCache);
      fetchAds(hasCache);
      fetchCarousel();
      return;
    }
    primeSharedRequest("storefronts", d.storefronts);
    void fetchConfig(d.config);
    void fetchShops(true, d.storefronts);
    void fetchSlots(true, d.slots);
    void fetchAds(true, { ads: d.ads, promos: d.promos });
    void fetchCarousel(d.carousel);
  };

  const fetchConfig = async (preloaded?: Awaited<ReturnType<typeof getPublicViewConfigAction>>) => {
    try {
      const data = preloaded ?? (await getPublicViewConfigAction());
      setConfig(data);
      spaCache.set("public_config", data);
      // Shared with the navbar on every other public page (logo, name, theme).
      try {
        sessionStorage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(data));
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAds = async (
    isBackground = false,
    preloaded?: {
      ads: Awaited<ReturnType<typeof getActiveMallAds>>;
      promos: Awaited<ReturnType<typeof getApprovedTenantPromos>>;
    },
  ) => {
    try {
      const [adsData, tenantPromosData] = preloaded
        ? [preloaded.ads, preloaded.promos]
        : await Promise.all([getActiveMallAds(), getApprovedTenantPromos()]);
      setAds(adsData);
      setTenantPromos(tenantPromosData);
      spaCache.set("public_ads", adsData);
      spaCache.set("public_promos", tenantPromosData);
    } catch (error) {
      console.error("Public view: error fetching ads:", error);
    } finally {
      setAdsLoaded(true);
    }
  };

  const fetchCarousel = async (preloaded?: Awaited<ReturnType<typeof getPublicViewCarouselAction>>) => {
    try {
      const data = preloaded ?? (await getPublicViewCarouselAction());
      setCarouselItems(data);
      spaCache.set("public_carousel", data);
    } catch (error) {
      console.error("❌ Public view: Error fetching carousel:", error);
    }
  };

  const fetchShops = async (isBackground = false, preloaded?: Awaited<ReturnType<typeof loadStorefronts>>) => {
    if (!isBackground) setLoadingShops(true);
    const res = preloaded ?? (await loadStorefronts());
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

  const fetchSlots = async (isBackground = false, preloaded?: Awaited<ReturnType<typeof getPublicAreaSlots>>) => {
    if (!isBackground) setLoadingSlots(true);
    const res = preloaded ?? (await getPublicAreaSlots());
    if (res.success && res.data) {
      setSlots(res.data);
      spaCache.set("public_slots", res.data);
    }
    setLoadingSlots(false);
  };

  // Live: a unit someone just reserved flips to Pending here without a reload.
  useLiveSlots(
    (patch) =>
      setSlots((prev) => {
        const next = mergeSlotPatch(prev as any, patch) as any;
        if (next !== prev) spaCache.set("public_slots", next);
        return next;
      }),
    () => fetchSlots(true),
  );

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      shop.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = shopMatchesCategory((shop as any).category, selectedCategory);

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

  const handleLoadMore = () => setVisibleCount((prev) => prev + 3);

  const handleLoadMoreSlots = () => setVisibleSlotsCount((prev) => prev + 4);

  const visibleShopsArray = filteredShops.slice(0, visibleCount);
  const hasMore = visibleCount < filteredShops.length;

  const visibleSlotsArray = filteredSlots.slice(0, visibleSlotsCount);
  const hasMoreSlots = visibleSlotsCount < filteredSlots.length;

  // Location section: same contact data and directions link the page already used.
  const contactAddress =
    config?.contactAddress || "Crossing Villanueva, Misamis Oriental, 9002, Philippines";
  const contactEmail = config?.contactEmail || config?.footerEmail || "";
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    config?.contactAddress || config?.footerAddress || "Sophie Red Mall Villanueva Misamis Oriental",
  )}`;

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
      <Navbar config={config} />

      {/* High Impact Hero Carousel */}
      {/* High Impact Hero Carousel with Search */}
      <section className={clsx("w-full", "relative", "bg-black", "pt-20", "hero-enter")}>
        {/* The banner headline changes with each slide; this is the page's fixed main heading. */}
        <h1 className="sr-only">SR Mall: shops, dining and spaces in Jasaan</h1>
        <AdBanner
          ads={ads}
          tenantPromos={tenantPromos}
          extraItems={carouselItems}
          loaded={adsLoaded}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearchClick={handleSearchClick}
          shops={shops}
          allFeaturedProducts={allFeaturedProducts}
          setSelectedProduct={setSelectedProduct}
        />
      </section>

      {/* Shop names and promos drifting across the page */}
      <ShopsMarquee shops={shops} promos={tenantPromos} />

      {/* About the mall */}
      <AboutMall
        config={config}
        shopCount={shops.length}
        spacesForRent={slots.filter((sl) => sl.status === "AVAILABLE").length}
      />

      {/* Upcoming Events Slider */}
      <UpcomingEventsSlider />

      {/* Shop Sales Slider */}
      <ShopSalesSlider shops={shops} />

      {/* Featured Products Showcase */}
      {allFeaturedProducts.length > 0 && (
        <section
          id="featured-products"
          className={clsx(
            "screen-section",
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
          <Reveal>

          <div
            className={clsx("max-w-7xl", "mx-auto", "px-4", "relative", "z-10")}
          >
            {/* Section header — left-aligned on mobile, side-by-side on sm+ */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8 mb-10 sm:mb-16 text-left">
              <div className="space-y-3">
                <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal dark:text-white tracking-tight leading-[1.05]">
                  <SectionTitleLines
                    text={config?.productsTitle || "Featured\nProducts."}
                    accentClass="text-slate-500 dark:text-slate-400"
                    breakClassName="hidden sm:block"
                  />
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
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition-all"
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
                    "group relative aspect-3/4 bg-white dark:bg-zinc-900 rounded-4xl overflow-hidden",
                    "border-2 border-slate-100 dark:border-white/5 hover:border-primary/30",
                    "shadow-lg hover:shadow-[0_30px_60px_-15px_rgba(190,30,45,0.25)]",
                    "transition-all duration-700 cursor-pointer",
                  )}
                >
                  {/* Background/Overlay */}
                  <div className="absolute inset-0 bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                    <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-700 z-10" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white dark:bg-zinc-800 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl z-20 border border-slate-100 dark:border-white/5">
                      <ArrowRight size={32} />
                    </div>
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-30 text-left">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-primary">
                        Collection
                      </p>
                      <p className="text-2xl font-semibold text-white tracking-tight">
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
          </Reveal>
        </section>
      )}

      <section className="screen-section relative overflow-hidden py-14 sm:py-20 lg:py-28 bg-slate-100 dark:bg-zinc-950 border-y border-slate-200 dark:border-white/5">
        <Reveal>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-14">
          {/* Copy */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-7">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal dark:text-white tracking-tight leading-[1.05]">
              {config?.videoTitle || "Elevate Your Lifestyle."}
            </h2>
            <span aria-hidden className="block w-16 h-1 rounded-full bg-primary dark:bg-[#BE1E2D]" />

            <p className="text-slate-600 dark:text-slate-400 font-medium text-base sm:text-lg leading-relaxed max-w-xl">
              {config?.videoDescription ||
                "Watch our latest visual showcase highlighting the premier shopping and dining experiences waiting for you at SR Mall. Immerse yourself in the extraordinary."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                suppressHydrationWarning
                onClick={() => setIsVideoModalOpen(true)}
                className="group inline-flex items-center justify-center gap-3 pl-2 pr-6 py-2 rounded-full bg-primary dark:bg-[#BE1E2D] text-white font-bold text-sm sm:text-base shadow-xl shadow-primary/25 dark:shadow-[#BE1E2D]/25 hover:bg-primary/90 dark:hover:bg-[#9E1B26] active:scale-95 transition-all"
              >
                <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                  <Play size={16} className="fill-current translate-x-px" />
                </span>
                Watch Full Campaign
              </button>
              <a
                href="#directory"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-slate-300 dark:border-white/15 text-charcoal dark:text-white font-bold text-sm sm:text-base hover:border-primary hover:text-primary dark:hover:border-[#BE1E2D] dark:hover:text-[#E04B57] transition-colors"
              >
                {config?.videoCtaLabel || "Explore the shops"}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Video */}
          <div className="lg:col-span-7">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsVideoModalOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsVideoModalOpen(true);
                }
              }}
              aria-label="Play the full campaign video"
              className="group relative block w-full text-left cursor-pointer rounded-[1.75rem] sm:rounded-[2.25rem] p-1.5 sm:p-2 bg-white/60 dark:bg-white/4 border border-slate-200 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/50 focus:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <div className="relative aspect-video overflow-hidden rounded-[1.4rem] sm:rounded-[1.8rem] bg-black">
                <video
                  ref={campaignVideoRef}
                  src={config?.featuredVideoUrl || "/vid/Download.mp4"}
                  className="w-full h-full object-cover scale-[1.01] group-hover:scale-105 transition-transform duration-1200 ease-out"
                  preload="none"
                  loop
                  muted
                  playsInline
                />

                {/* Readability gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-black/20" />

                {/* Centre play button */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/30 group-hover:scale-110 transition-transform duration-500">
                    <span className="absolute inset-0 rounded-full bg-white/20 animate-ping [animation-duration:2.5s]" />
                    <span className="relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-primary dark:bg-[#BE1E2D] text-white shadow-lg">
                      <Play size={20} className="fill-current translate-x-[2px]" />
                    </span>
                  </span>
                </span>

                {/* Caption */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl font-semibold text-white tracking-tight truncate">
                      {config?.featuredVideoTitle || "SR Mall Cinematic Experience"}
                    </p>
                  </div>
                  {/* Sound on / off (the centre button plays the full video) */}
                  <button
                    type="button"
                    onClick={toggleCampaignSound}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-pressed={!campaignMuted}
                    aria-label={campaignMuted ? "Turn sound on" : "Turn sound off"}
                    title={campaignMuted ? "Turn sound on" : "Turn sound off"}
                    className="relative z-20 shrink-0 inline-flex items-center gap-1.5 h-9 sm:h-10 pl-2.5 pr-3.5 rounded-full bg-white text-charcoal hover:bg-primary hover:text-white dark:hover:bg-[#BE1E2D] shadow-lg transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    {campaignMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    <span className="text-xs font-semibold">
                      {campaignMuted ? "Sound off" : "Sound on"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* Shop Directory Section */}
      <section
        id="directory"
        className={clsx(
          "screen-section",
          "py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-zinc-950",
        )}
      >
        <Reveal>
        <div className={clsx("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8")}>
          {/* Section Header */}
          <div className={clsx("relative", "mb-16", "sm:mb-20")}>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-2xl">
                <h2
                  className={clsx(
                    "text-3xl",
                    "sm:text-4xl",
                    "lg:text-5xl",
                    "font-display", "font-semibold", "text-charcoal", "dark:text-white", "tracking-tight", "leading-[1.05]",
                    "mb-6",
                    "sm:mb-8",
                  )}
                >
                  <SectionTitleLines
                    text={config?.directoryTitle || "Mall\nDirectory."}
                    accentClass="text-slate-500 dark:text-slate-400"
                  />
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
                  {config?.directoryDescription ||
                    "Navigate through our curated ecosystem of high-end retail, digital-first storefronts, and world-class dining destinations."}
                </p>
              </div>

              {/* In-Section Search Input */}
              <div className="w-full lg:w-96 flex flex-col items-start lg:items-end gap-4">
                <Link
                  href="/tenant-directory"
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition-all"
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
                    aria-label="Search stores, brands, or unit IDs"
                    placeholder="Search stores, brands, or unit IDs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 rounded-3xl py-5 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none"
                  />

                  {/* Predictive Search Panel */}
                  {searchQuery && (
                    <div className="absolute top-full left-0 w-full mt-2 sm:mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl z-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-3 sm:p-4 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-400">
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
                                <img loading="lazy" decoding="async"
                                  src={optimizedImage(s.logo_url || "/images/logo/logoshop.jpg", 160)}
                                  className="w-full h-full object-cover group-hover/item:scale-110 transition-transform"
                                  alt="Shop Logo"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-charcoal dark:text-white line-clamp-1">
                                  {s.shop_name}
                                </p>
                                <p className="text-xs font-bold text-slate-400">
                                  {hasAssignedUnit(s.unit_id) ? `${s.unit_id} — Plaza Wing` : "Unit to be assigned"}
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
                              <p className="text-xs font-bold">
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
            <div className="lg:hidden absolute right-0 top-0 bottom-4 w-8 bg-linear-to-l from-slate-100 dark:from-zinc-950 to-transparent pointer-events-none z-20"></div>
            {[
              { id: "All Categories", label: "All", icon: <ShoppingBag size={16} /> },
              { id: "food", label: "Food & Drinks", icon: <Coffee size={16} /> },
              { id: "fashion", label: "Fashion", icon: <Shirt size={16} /> },
              { id: "tech", label: "Electronics & Tech", icon: <Zap size={16} /> },
              { id: "beauty", label: "Health & Beauty", icon: <Sparkles size={16} /> },
              { id: "services", label: "Services", icon: <Tag size={16} /> },
              { id: "other", label: "Other", icon: <ShoppingBag size={16} /> },
            ].map((cat) => (
              <button suppressHydrationWarning
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "flex items-center gap-3 px-6 py-4 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap border-2",
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
                "flex sm:grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 overflow-x-auto sm:overflow-x-visible scroll-smooth no-scrollbar snap-x snap-mandatory gap-8 px-4 sm:px-0",
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

                  {/* View All Shops — same shape as ShopCard / slot card */}
                  <Link
                    href="/tenant-directory"
                    className="w-[85%] sm:w-full shrink-0 snap-center group relative bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 shadow-xs hover:shadow-2xl hover:-translate-y-2"
                  >
                    <div className="aspect-4/3 sm:aspect-16/10 relative overflow-hidden bg-linear-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center">
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white dark:bg-zinc-800 text-primary flex items-center justify-center shadow-xl group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-500">
                        <ArrowRight size={28} />
                      </div>
                      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-8 right-3 sm:right-8">
                        <h4 className="text-base sm:text-3xl font-semibold text-charcoal dark:text-white tracking-tight leading-none">
                          View All Shops
                        </h4>
                      </div>
                    </div>
                    <div className="p-3 sm:p-8 flex items-center justify-between bg-white dark:bg-zinc-900/50">
                      <div className="space-y-0.5 sm:space-y-1.5">
                        <p className="text-xs font-semibold text-slate-400">Stores</p>
                        <p className="text-lg sm:text-3xl font-semibold text-charcoal dark:text-white tracking-tight">{shops.length}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-right">
                        <span className="text-xs font-bold text-slate-400">Directory</span>
                        <span className="text-xs font-semibold text-primary">Full Listing</span>
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
                  "inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-zinc-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-primary font-bold text-xs hover:bg-slate-200 dark:hover:bg-zinc-800 hover:border-primary transition-all active:scale-95 disabled:opacity-70 shadow-xs",
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
        </Reveal>
      </section>

      {/* Available Spaces Section */}
      <section
        id="availability"
        className={clsx(
          "screen-section",
          "py-24 sm:py-28",
          "bg-white dark:bg-black",
          "relative",
          "overflow-hidden",
        )}
      >
        <Reveal>

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
              <h2
                className={clsx(
                  "text-3xl",
                  "sm:text-4xl",
                  "lg:text-5xl",
                  "font-display", "font-semibold", "text-charcoal", "dark:text-white", "tracking-tight", "leading-[1.05]",
                )}
              >
                <SectionTitleLines
                  text={config?.spacesTitle || "Available\nSpaces."}
                  accentClass="text-slate-500 dark:text-slate-400"
                />
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
                {config?.spacesDescription ||
                  "Join our premium retail ecosystem. Explore high-visibility slots designed for modern brands and start your journey at SR Mall."}
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-4 w-full lg:w-auto">
              <Link
                href="/available-spaces"
                className="group inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition-all"
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
                  "font-semibold",


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
                      "font-semibold",


                      "text-slate-400",
                    )}
                  >
                    Synchronizing Inventory...
                  </p>
                </div>
              ) : visibleSlotsArray.length > 0 ? (
                visibleSlotsArray.map((slot, idx) => {
                  const access = slotAccess(slot as any, user?.id);
                  return (
                  <div
                    key={slot.id}
                    onClick={() =>
                      access.open
                        ? setSelectedSlot(slot)
                        : toast.info(
                          slot.status === "RESERVED"
                            ? `Unit ${slot.unit_id} is pending: another customer reserved it first. It's released automatically if it isn't confirmed within 2 days.`
                            : `Unit ${slot.unit_id} is already occupied.`,
                        )
                    }
                    aria-disabled={!access.open}
                    className={clsx(
                      "w-[85%] sm:w-full",
                      "shrink-0 snap-center group relative bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 shadow-xs animate-fade-in-up",
                      access.open ? "cursor-pointer hover:shadow-2xl hover:-translate-y-2" : "cursor-not-allowed opacity-75 grayscale-35",
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div
                      className={clsx(
                        "aspect-16/10",
                        "relative",
                        "overflow-hidden",
                        "bg-slate-100",
                        "dark:bg-black",
                      )}
                    >
                      {slot.space_images && slot.space_images[0] ? (
                        <img loading="lazy" decoding="async"
                          src={optimizedImage(slot.space_images[0], 800)}
                          alt={`Space ${slot.unit_id}`}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-linear-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                          <ShoppingBag className="w-12 h-12 text-slate-200 dark:text-zinc-800 mb-4" />
                          <p className="text-xs font-semibold text-slate-300 text-center">
                            Premium Unit <br />
                            Preview Pending
                          </p>
                        </div>
                      )}

                      {/* Professional Glassmorphism Overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>

                      <div className={clsx("absolute", "top-6", "right-6")}>
                        <div
                          className={clsx(
                            "backdrop-blur-xl px-4 py-2 rounded-full border text-xs font-semibold transition-all shadow-2xl",
                            slot.status === "AVAILABLE"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : access.mine
                                ? "bg-yellow-400/25 border-yellow-400/60 text-yellow-300"
                                : "bg-amber-500/20 border-amber-500/40 text-amber-400",
                          )}
                        >
                          {slot.status === "AVAILABLE" ? "Available Now" : access.label}
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
                            "text-3xl font-semibold text-white tracking-tight leading-none",
                          )}
                        >
                          Unit {slot.unit_id}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={clsx("w-1.5 h-1.5 rounded-full", slot.status === "AVAILABLE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")}></div>
                          <p className="text-xs font-bold text-white/70">
                            Plaza Wing — Level 1
                          </p>
                        </div>
                      </div>

                      {/* Action Button on Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
                        <div className="px-8 py-3 bg-white text-black text-xs font-semibold rounded-full shadow-3xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
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
                            "font-semibold",
                            "text-slate-400",


                          )}
                        >
                          Floor Area
                        </p>
                        <div className="flex items-baseline gap-1">
                          <p
                            className={clsx(
                              "text-3xl",
                              "font-semibold",
                              "text-charcoal",
                              "dark:text-white",
                              "tracking-tight",
                            )}
                          >
                            {slot.sqm_size}
                          </p>
                          <span className="text-xs font-semibold text-primary">SQM</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-slate-400">Lease Terms</span>
                        <span className="text-xs font-semibold text-charcoal dark:text-white">Flexible</span>
                      </div>
                    </div>
                  </div>
                  );
                })
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
                    "group relative bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 cursor-pointer shadow-xs hover:shadow-2xl hover:-translate-y-2",
                  )}
                >
                  <div className={clsx("aspect-16/10", "relative", "overflow-hidden", "bg-slate-50", "dark:bg-zinc-950", "flex items-center justify-center")}>
                    <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
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
                      <p className="text-xs font-semibold text-slate-400">
                        Inventory
                      </p>
                      <p className="text-2xl font-semibold text-charcoal dark:text-white tracking-tight">
                        View All <br />
                        Spaces
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary">Explore</p>
                      <p className="text-xs font-bold text-slate-400">Full Map</p>
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
                  "inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-zinc-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-primary font-bold text-xs hover:bg-slate-200 dark:hover:bg-zinc-800 hover:border-primary transition-all active:scale-95 disabled:opacity-70 shadow-xs",
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
        </Reveal>
      </section>

      {/* Space Detail Modal */}
      {selectedSlot && (
        <SpaceDetailModal
          slot={(slots.find((s) => s.id === selectedSlot.id) || selectedSlot) as any}
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

      {isLoginModalOpen && <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />}

      {/* Venue Booking / Event Inquiry Section */}
      <section
        id="event-inquiry"
        className="screen-section relative overflow-hidden bg-[#FAF7F3] dark:bg-zinc-950"
      >
        <EventInquiryForm
          isAuthenticated={isAuthenticated}
          user={user}
          eyebrow={config?.venueEyebrow}
          title={config?.venueTitle}
          description={config?.venueDescription}
          imageUrl={config?.venueImageUrl}
          imageAlt={config?.venueImageAlt}
        />
      </section>

      {/* Gated Feedback & Communication */}
      <FeedbackSection
        isAuthenticated={isAuthenticated}
        title={config?.reviewsTitle}
        description={config?.reviewsDescription}
      />

      {/* Location Section */}
      <section
        id="location"
        className={clsx(
          "screen-section",
          "scroll-mt-20",
          "bg-[#FAF7F3]",
          "dark:bg-zinc-950",
          "py-16",
          "sm:py-24",
          "lg:py-28",
        )}
      >
        <Reveal>
        <div className={clsx("max-w-7xl", "mx-auto", "px-4", "sm:px-6", "lg:px-10")}>
          <div className="max-w-2xl">
            <p className="text-xs font-bold text-[#C51D30]">
              Visit us
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-[#21191B] dark:text-white sm:text-4xl lg:text-5xl">
              <span className="whitespace-pre-line">
                {config?.locationTitle || "Prime location.\nEndless access."}
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#70656A] dark:text-slate-400">
              {config?.contactDescription ||
                "On the national highway in Brgy. Luz Banzon, Jasaan. Easy to reach from Cagayan de Oro and the towns of Misamis Oriental."}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-5 lg:gap-6">
            {/* Interactive Google Map */}
            <div className="relative min-h-88 overflow-hidden rounded-[1.75rem] border border-[#E8E2DE] bg-[#F4EEE6] shadow-[0_18px_40px_-32px_rgba(33,25,27,0.4)] dark:border-white/10 dark:bg-zinc-900 sm:min-h-104 md:min-h-0">
              <iframe
                title="Map to SR Mall"
                src={mapEmbedSrc(config)}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full"
              />
            </div>

            {/* Mall photo, contact card and directions */}
            <div className="flex flex-col gap-4">
              <div className="relative aspect-16/10 overflow-hidden rounded-[1.75rem] border border-[#E8E2DE] shadow-[0_18px_40px_-32px_rgba(33,25,27,0.4)] dark:border-white/10">
                {/* Existing SR Mall building photo. */}
                <img
                  src="/images/mall/facade.webp"
                  alt="The Sophie Red Mall entrance"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#E8E2DE] bg-white shadow-xs dark:border-white/10 dark:bg-zinc-900">
                <div className="flex items-start gap-3 border-b border-[#E8E2DE] p-4 dark:border-white/10">
                  <MapPin
                    size={20}
                    strokeWidth={1.8}
                    className="mt-0.5 shrink-0 text-[#C51D30]"
                    aria-hidden
                  />
                  <p className="text-[13.5px] font-medium leading-relaxed text-[#21191B] dark:text-slate-200 sm:text-sm">
                    {contactAddress}
                  </p>
                </div>
                {contactEmail && (
                  <div className="flex items-start gap-3 p-4">
                    <Mail
                      size={20}
                      strokeWidth={1.8}
                      className="mt-0.5 shrink-0 text-[#C51D30]"
                      aria-hidden
                    />
                    <a
                      href={`mailto:${contactEmail}`}
                      className="break-all text-[13.5px] font-medium leading-relaxed text-[#21191B] transition-colors hover:text-[#C51D30] dark:text-slate-200 sm:text-sm"
                    >
                      {contactEmail}
                    </a>
                  </div>
                )}
              </div>

              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#C51D30] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(197,29,48,0.7)] transition-all hover:bg-[#A8172A] hover:shadow-[0_14px_30px_-12px_rgba(197,29,48,0.75)] active:scale-[0.99]"
              >
                <Navigation size={16} aria-hidden />
                Get directions
              </a>
            </div>
          </div>
        </div>
        </Reveal>
      </section>



      {/* Floating Action Button for Chat - Available for all, but gated inside */}
      <button suppressHydrationWarning
        onClick={() => {
          if (isChatOpen) {
            setIsChatOpen(false);
            setChatRecipient(null);
            setChatInitialShopName(null);
          } else {
            setChatRecipient(null);
            setChatInitialShopName(null);
            setIsChatOpen(true);
          }
        }}
        aria-label={isChatOpen ? "Close messages" : unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : "Messages"}
        className={`fixed bottom-4 right-4 sm:bottom-10 sm:right-10 w-14 h-14 sm:w-20 sm:h-20 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all z-50 group ${isChatOpen ? "rotate-90" : ""}`}
      >
        {isChatOpen ? <X size={32} /> : <MessageCircle size={32} />}
        {!isChatOpen && unreadMessages > 0 && (
          <span
            className={clsx(
              "absolute",
              "-top-2",
              "-right-2",
              "bg-red-500",
              "text-white",
              "text-[10px]",
              "font-bold",
              unreadMessages > 0 ? "w-6 h-6 flex items-center justify-center text-xs" : "px-2 py-1",
              "rounded-full",
              "border-2",
              "border-white",
              "dark:border-black",
              unreadMessages > 0 && "animate-pulse"
            )}
          >
            {unreadMessages > 9 ? "9+" : unreadMessages}
          </span>
        )}
      </button>

      {isChatOpen && <ChatBox
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatRecipient(null);
          setChatInitialShopName(null);
        }}
        isAuthenticated={isAuthenticated}
        initialShopName={chatInitialShopName}
        initialRecipient={chatRecipient}
        inquirySlotId={chatInquirySlotId}
      />}

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



      <Footer config={config} />
    </div>
  );
}
