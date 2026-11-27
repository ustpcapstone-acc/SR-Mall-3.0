"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Navigation, Tag } from "lucide-react";
import Link from "next/link";
import { optimizedImage } from "@/lib/media";

// Default SR-MANAGE Ad when nothing is live
const DEFAULT_AD = {
  id: "default",
  title: "Welcome to SR Mall",
  description: "Find shops, products and spaces for rent in Jasaan.",
  imageUrl:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000",
  ctaText: "View Directory",
};

export const AdBanner = ({
  ads,
  tenantPromos,
  extraItems,
  loaded,
  searchQuery = "",
  setSearchQuery = () => {},
  handleSearchClick = () => {},
  shops = [],
  allFeaturedProducts = [],
  setSelectedProduct = () => {},
}: {
  ads?: any[];
  tenantPromos?: any[];
  extraItems?: any[];
  /** The parent has finished loading ads (undefined: the banner loads its own). */
  loaded?: boolean;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  handleSearchClick?: () => void;
  shops?: any[];
  allFeaturedProducts?: any[];
  setSelectedProduct?: (val: any) => void;
}) => {
  const [localAds, setLocalAds] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Combine Mall Ads, Tenant Promos, and Extra Carousel Items
    const mallAds = ads || [];
    const promos = tenantPromos || [];
    const extras = extraItems || [];

    let combined = [...mallAds, ...promos, ...extras];

    // Sort by priority if available
    combined = combined.sort((a, b) => {
      const priorityA =
        typeof a.priority === "string"
          ? a.priority === "HIGH"
            ? 3
            : a.priority === "MEDIUM"
              ? 2
              : 1
          : a.priority || 0;
      const priorityB =
        typeof b.priority === "string"
          ? b.priority === "HIGH"
            ? 3
            : b.priority === "MEDIUM"
              ? 2
              : 1
          : b.priority || 0;
      return priorityB - priorityA;
    });

    if (combined.length > 0) {
      setLocalAds(combined);
    } else if (loaded === undefined) {
      // Used on its own: load the ads here.
      fetchActiveAds();
    } else if (loaded) {
      // The page loaded them and there are none live.
      setLocalAds([DEFAULT_AD]);
    }
    // While the page is still loading, wait instead of fetching the same
    // lists a second time (server actions queue, so that delayed the page).
  }, [ads, tenantPromos, extraItems, loaded]);

  // Only the slide on screen and the next one load their media; a slide's
  // media stays once loaded so cycling back never flashes. Before, every
  // slide's full-size image and video downloaded (and played) at once.
  const [warm, setWarm] = useState<Set<number>>(() => new Set([0, 1]));
  const upNext = (currentIndex + 1) % Math.max(localAds.length, 1);
  if (!warm.has(currentIndex) || !warm.has(upNext)) {
    // Adjusting state while rendering (React's pattern for derived state).
    setWarm(new Set([...warm, currentIndex, upNext]));
  }

  // Separate effect for interval
  useEffect(() => {
    if (localAds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev: number) => (prev + 1) % localAds.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [localAds.length]);

  const fetchActiveAds = async () => {
    try {
      const { getAllMallAds, getApprovedTenantPromos } =
        await import("@/app/actions/ads");
      const { getPublicViewCarouselAction } = await import("@/app/actions/cms");

      const [mallAdsData, tenantPromosData, carouselData] = await Promise.all([
        getAllMallAds(),
        getApprovedTenantPromos(),
        getPublicViewCarouselAction(),
      ]);

      const allAds = [...mallAdsData, ...tenantPromosData, ...carouselData];

      if (allAds && allAds.length > 0) {
        setLocalAds(allAds);
      } else {
        setLocalAds([DEFAULT_AD]);
      }
    } catch (error) {
      console.error("AdBanner fetch error:", error);
      if (localAds.length === 0) setLocalAds([DEFAULT_AD]);
    }
  };

  const activeAd = localAds[currentIndex] || DEFAULT_AD;

  const handleAdClick = (ad: any) => {
    if (ad.id === "default") return;
    if (ad.linkUrl) {
      window.location.href = ad.linkUrl;
      return;
    }
    document
      .getElementById("directory")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    // Full screen below the fixed 5rem navbar (svh: correct on mobile browsers
    // whose address bar resizes the viewport); never shorter than 520px.
    <div className="relative w-full h-[calc(100svh-5rem)] min-h-[520px] overflow-hidden group">
      {localAds.map((ad: any, index: number) => (
        <div
          key={`${ad.id}-${index}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${index === currentIndex ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}
        >
          {(() => {
            // Enhanced media detection
            const url = ad.promoVideo || ad.imageUrl;
            const isVideo =
              ad.promoVideo ||
              ad.mediaType === "VIDEO" ||
              url?.match(/\.(mp4|webm|mov|ogg)$/i) ||
              url?.includes("/video/upload/");

            if (!warm.has(index)) return <div className="w-full h-full bg-black" />;
            const active = index === currentIndex;
            return isVideo ? (
              <video
                src={url}
                ref={(v) => {
                  // Only the slide on screen plays.
                  if (!v) return;
                  if (active) void v.play().catch(() => {});
                  else v.pause();
                }}
                className="w-full h-full object-cover transition-transform duration-[20s] scale-105 group-hover:scale-110"
                autoPlay={active}
                preload={active ? "auto" : "metadata"}
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={optimizedImage(ad.promoImage || ad.imageUrl, 1920)}
                alt={ad.title}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-[20s] scale-105 group-hover:scale-110"
              />
            );
          })()}
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent flex items-center">
            {/* The leaving slide's text fades out fast and the new text only
                comes in after it, so two headlines never sit on top of each
                other during the 1s image cross-fade. */}
            <div
              className={`max-w-7xl mx-auto px-5 sm:px-10 w-full flex flex-col lg:flex-row lg:items-center justify-between gap-10 transition-opacity ${index === currentIndex ? "opacity-100 duration-500 delay-500" : "opacity-0 duration-200"}`}
            >
              <div className="max-w-sm sm:max-w-2xl animate-fade-in-up">
                <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-semibold text-white mb-3 sm:mb-6 leading-[1.05] tracking-tight line-clamp-3">
                  {ad.title}
                </h2>
                <p className="text-sm sm:text-lg text-white/80 mb-6 sm:mb-10 leading-relaxed font-medium line-clamp-3">
                  {ad.description ||
                    "Visit us and experience the future of digital shopping today."}
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <button
                    suppressHydrationWarning
                    onClick={() => handleAdClick(ad)}
                    className="px-6 sm:px-8 py-3 sm:py-3.5 bg-primary text-white text-sm sm:text-base font-semibold rounded-xl hover:bg-white hover:text-primary transition-colors active:scale-95"
                  >
                    {ad.linkUrl ? "Explore Now" : "View Directory"}
                  </button>
                  <Link
                    href="/lost-and-found"
                    className="px-6 sm:px-8 py-3 sm:py-3.5 border border-white/60 text-white text-sm sm:text-base font-semibold rounded-xl hover:bg-white hover:text-kumo-default transition-colors active:scale-95"
                  >
                    Lost and Found
                  </Link>
                </div>
              </div>

              {/* Search Bar - Positioned on the side within the banner */}
              <div className="hidden lg:block w-full max-w-md animate-fade-in-up delay-200">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-linear-to-r from-primary to-blue-600 rounded-2xl blur-sm opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative flex items-center bg-white/10 backdrop-blur-xl rounded-2xl p-2 border border-white/20 shadow-2xl">
                    <Search size={20} className="ml-4 text-white/60" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search shops or products"
                      placeholder="Search shops or products..."
                      className="w-full px-4 py-3 bg-transparent text-white focus:outline-hidden text-sm font-medium placeholder:text-white/40"
                    />
                    <button
                      suppressHydrationWarning
                      onClick={handleSearchClick}
                      className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-white hover:text-primary transition-all active:scale-95 shadow-lg"
                    >
                      Search
                    </button>
                  </div>

                  {/* Predictive Search Panel inside Banner */}
                  {searchQuery && (
                    <div className="absolute top-full left-0 w-full mt-3 bg-kumo-base border border-kumo-line rounded-2xl shadow-3xl z-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 border-b border-kumo-line flex items-center justify-between">
                        <span className="text-xs font-semibold text-kumo-subtle">Quick Results</span>
                        <button suppressHydrationWarning onClick={() => setSearchQuery("")}>
                          <X size={14} className="text-kumo-subtle" />
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto no-scrollbar p-2">
                        {shops
                          .filter((s: any) => s.shop_name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 2)
                          .map((s: any) => (
                            <Link key={s.id} href={`/shop/${s.id}`} className="flex items-center gap-3 p-2 hover:bg-kumo-tint rounded-xl transition-all group/item">
                              <div className="w-8 h-8 rounded-lg bg-kumo-recessed overflow-hidden shrink-0">
                                <img src={s.logo_url || "/images/logo/logoshop.jpg"} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-kumo-default truncate">{s.shop_name}</p>
                                <p className="text-xs font-bold text-kumo-subtle">{s.unit_id}</p>
                              </div>
                              <Navigation size={10} className="text-kumo-subtle group-hover/item:text-primary" />
                            </Link>
                          ))}
                        
                        {allFeaturedProducts
                          .filter((p: any) => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 2)
                          .map((p: any) => (
                            <button suppressHydrationWarning key={p.id} onClick={() => setSelectedProduct(p)} className="w-full flex items-center gap-3 p-2 hover:bg-kumo-tint rounded-xl transition-all group/item text-left">
                              <div className="w-8 h-8 rounded-lg bg-kumo-base overflow-hidden shrink-0 border border-kumo-line">
                                <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-kumo-default truncate">{p.name}</p>
                                <p className="text-xs font-bold text-primary">{p.price}</p>
                              </div>
                              <Tag size={10} className="text-kumo-subtle group-hover/item:text-primary" />
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Slide Indicators */}
      {localAds.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-white/50 dark:bg-charcoal/50 backdrop-blur-md px-3 py-2 rounded-full border border-kumo-line">
          {localAds.map((_: any, index: number) => (
            <button
              suppressHydrationWarning
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Show slide ${index + 1} of ${localAds.length}`}
              aria-current={index === currentIndex ? "true" : undefined}
              // The dot stays small; the padding gives fingers a 22px+ target.
              className="group/dot -m-2 p-2 flex items-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${index === currentIndex ? "bg-primary w-4" : "w-1.5 bg-slate-400 dark:bg-white/50 group-hover/dot:bg-primary dark:group-hover/dot:bg-white"}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
