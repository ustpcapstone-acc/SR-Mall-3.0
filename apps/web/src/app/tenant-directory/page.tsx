"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ShopCard } from "@/components/shop-card";
import { ChatBox } from "@/components/chat-box";
import {
  Search,
  SlidersHorizontal,
  Tag,
  ShoppingBag,
  Loader2,
  X,
  ChevronDown,
  Sparkles,
  ArrowLeft,
  Store,
} from "lucide-react";
import Link from "next/link";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import clsx from "clsx";

export default function TenantDirectoryPage() {
  const { isAuthenticated } = useAuth();
  const [shops, setShops] = useState<any[]>(() => spaCache.get("public_shops") || []);
  const [loading, setLoading] = useState(() => !spaCache.has("public_shops"));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(
    null,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const categories = [
    "All Categories",
    "Fashion",
    "Electronics",
    "Food",
    "Living",
    "Beauty",
  ];

  useEffect(() => {
    const hasCache = spaCache.has("public_shops");
    fetchShops(hasCache);
  }, []);

  const fetchShops = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const res = await getAllStorefrontsAction();
    if (res.success && res.data) {
      setShops(res.data);
      spaCache.set("public_shops", res.data);
    }
    setLoading(false);
  };

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      shop.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shop.description && shop.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "All Categories" ||
      (shop.description && shop.description.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
      <Navbar />

      {/* Header Section */}
      <section className="pt-32 pb-12 sm:pt-40 sm:pb-20 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-white/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-[120px] -z-0 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] -z-0 -translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <Link
            href="/public-view"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-all mb-8 group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Public View
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-primary/20">
                <Store size={12} />
                Global Directory
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-charcoal dark:text-white tracking-tighter leading-[0.9] uppercase">
                Tenant <br />
                <span className="text-slate-300 dark:text-zinc-800">
                  Directory.
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                Discover our curated collection of luxury boutiques, tech
                essentials, and gourmet finds from all our premium tenants.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="relative group w-full sm:w-80 lg:w-96">
                <Search
                  size={20}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
                />
                <input
                  type="text"
                  placeholder="Search stores or unit IDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all shadow-sm"
                />

                {/* Predictive Search Panel */}
                {searchQuery && (
                  <div className="absolute top-full left-0 w-full mt-2 sm:mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-3 sm:p-4 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                      <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Recommended Matches
                      </span>
                      <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-charcoal transition-colors">
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
                            <ChevronDown
                              size={12}
                              className="text-slate-300 group-hover/item:text-primary transition-colors sm:size-[14px] -rotate-90"
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
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={clsx(
                  "flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                  isFilterOpen
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                    : "bg-white dark:bg-zinc-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-white/5 hover:border-slate-200",
                )}
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          <div
            className={clsx(
              "mt-8 pt-8 border-t border-slate-50 dark:border-white/5 transition-all duration-500 overflow-hidden",
              isFilterOpen
                ? "max-h-96 opacity-100"
                : "max-h-0 opacity-0 pointer-events-none",
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Categories
                </span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                        selectedCategory === cat
                          ? "bg-primary text-white"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-12 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2
                size={48}
                className="animate-spin text-primary mx-auto"
              />
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                Loading Directory...
              </p>
            </div>
          ) : filteredShops.length > 0 ? (
            <>
              <div className="mb-10 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {filteredShops.length} stores
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {filteredShops.map((shop, idx) => (
                  <ShopCard
                    key={`${shop.id}-${idx}`}
                    shop={shop}
                    onMessage={(name) => {
                      setChatInitialShopName(name);
                      setIsChatOpen(true);
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-zinc-950 rounded-[3rem] border border-dashed border-slate-200 dark:border-white/10">
              <Store size={48} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tighter mb-2">
                No Storefronts Found
              </h3>
              <p className="text-sm text-slate-400 font-medium">
                Try adjusting your search or category filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All Categories");
                }}
                className="mt-8 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </section>

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialRecipient="shop"
        initialShopName={chatInitialShopName || undefined}
      />

      <Footer />
    </div>
  );
}
