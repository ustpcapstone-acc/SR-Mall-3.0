"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Navigation, Tag } from "lucide-react";
import Link from "next/link";

// Default SR-MANAGE Ad when nothing is live
const DEFAULT_AD = {
  id: "default",
  title: "Luxe Summer Sale",
  description:
    "Experience up to 70% off on all premium luxury brands this weekend only. Join us for a unique shopping gala.",
  imageUrl:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000",
  ctaText: "View Directory",
};

export const AdBanner = ({
  ads,
  tenantPromos,
  extraItems,
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
    } else {
      fetchActiveAds();
    }
  }, [ads, tenantPromos, extraItems]);

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
    <div className="relative w-full h-[280px] sm:h-[380px] md:h-[500px] overflow-hidden group">
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

            return isVideo ? (
              <video
                src={url}
                className="w-full h-full object-cover transition-transform duration-[20s] scale-105 group-hover:scale-110"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={ad.promoImage || ad.imageUrl}
                alt={ad.title}
                className="w-full h-full object-cover transition-transform duration-[20s] scale-105 group-hover:scale-110"
              />
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex items-center">
            <div className="max-w-7xl mx-auto px-5 sm:px-10 w-full flex flex-col lg:flex-row lg:items-center justify-between gap-10">
              <div className="max-w-xs sm:max-w-xl animate-fade-in-up">
                <span className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 bg-primary text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] mb-3 sm:mb-6 rounded-full shadow-lg shadow-primary/30">
                  {ad.tenantId ? "Tenant Spotlight" : "Experience SR Mall"}
                </span>
                <h2 className="text-2xl sm:text-5xl md:text-7xl font-bold text-white mb-2 sm:mb-6 leading-tight tracking-tight line-clamp-2 sm:line-clamp-none">
                  {ad.title}
                </h2>
                <p className="text-xs sm:text-lg text-white/80 mb-4 sm:mb-10 leading-relaxed font-medium line-clamp-2 sm:line-clamp-3">
                  {ad.description ||
                    "Visit us and experience the future of digital shopping today."}
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <button
                    suppressHydrationWarning
                    onClick={() => handleAdClick(ad)}
                    className="px-5 sm:px-10 py-3 sm:py-5 bg-primary text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full hover:bg-white hover:text-primary transition-all active:scale-95 shadow-xl shadow-primary/20"
                  >
                    {ad.linkUrl ? "Explore Now" : "View Directory"}
                  </button>
                  <Link
                    href="/lost-and-found"
                    className="px-5 sm:px-10 py-3 sm:py-5 bg-primary text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full hover:bg-white hover:text-primary transition-all active:scale-95 shadow-xl shadow-primary/20"
                  >
                    Lost and Found
                  </Link>
                </div>
              </div>

              {/* Search Bar - Positioned on the side within the banner */}
              <div className="hidden lg:block w-full max-w-md animate-fade-in-up delay-200">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative flex items-center bg-white/10 backdrop-blur-xl rounded-2xl p-2 border border-white/20 shadow-2xl">
                    <Search size={20} className="ml-4 text-white/60" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search shops or products..."
                      className="w-full px-4 py-3 bg-transparent text-white focus:outline-none text-sm font-medium placeholder:text-white/40"
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
                    <div className="absolute top-full left-0 w-full mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-3xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Results</span>
                        <button suppressHydrationWarning onClick={() => setSearchQuery("")}>
                          <X size={14} className="text-slate-300" />
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto no-scrollbar p-2">
                        {shops
                          .filter((s: any) => s.shop_name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 2)
                          .map((s: any) => (
                            <Link key={s.id} href={`/shop/${s.id}`} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group/item">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0">
                                <img src={s.logo_url || "/images/logo/logoshop.jpg"} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-charcoal dark:text-white truncate uppercase">{s.shop_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{s.unit_id}</p>
                              </div>
                              <Navigation size={10} className="text-slate-300 group-hover/item:text-primary" />
                            </Link>
                          ))}
                        
                        {allFeaturedProducts
                          .filter((p: any) => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 2)
                          .map((p: any) => (
                            <button suppressHydrationWarning key={p.id} onClick={() => setSelectedProduct(p)} className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group/item text-left">
                              <div className="w-8 h-8 rounded-lg bg-white dark:bg-black overflow-hidden shrink-0 border border-slate-100 dark:border-white/10">
                                <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-charcoal dark:text-white truncate">{p.name}</p>
                                <p className="text-[9px] font-bold text-primary uppercase">{p.price}</p>
                              </div>
                              <Tag size={10} className="text-slate-300 group-hover/item:text-primary" />
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-white/50 dark:bg-charcoal/50 backdrop-blur-md px-3 py-2 rounded-full border border-slate-200 dark:border-white/10">
          {localAds.map((_: any, index: number) => (
            <button
              suppressHydrationWarning
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${index === currentIndex ? "bg-primary w-4" : "bg-slate-400 dark:bg-white/50 hover:bg-primary dark:hover:bg-white"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
