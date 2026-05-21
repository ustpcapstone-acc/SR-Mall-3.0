"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { ProductDetailModal } from "@/components/product-detail-modal";
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
} from "lucide-react";
import Link from "next/link";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import clsx from "clsx";

export default function AllProductsPage() {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<any[]>(() => spaCache.get("products") || []);
  const [loading, setLoading] = useState(() => !spaCache.has("products"));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(
    null,
  );
  const [sortBy, setSortBy] = useState("featured");
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
    const hasCache = spaCache.has("products");
    fetchProducts(hasCache);
  }, []);

  const fetchProducts = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const res = await getAllStorefrontsAction();
    if (res.success && res.data) {
      const allProducts = res.data.flatMap((shop: any) =>
        (shop.products || []).map((p: any) => ({
          ...p,
          shopName: shop.shop_name,
          shopId: shop.id,
        })),
      );
      setProducts(allProducts);
      spaCache.set("products", allProducts);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.shopName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All Categories" ||
      (product.category &&
        product.category
          .toLowerCase()
          .includes(selectedCategory.toLowerCase())) ||
      (product.description &&
        product.description
          .toLowerCase()
          .includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "price-low") {
      const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ""));
      const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ""));
      return priceA - priceB;
    }
    if (sortBy === "price-high") {
      const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ""));
      const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ""));
      return priceB - priceA;
    }
    return 0; // default to featured
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
      <Navbar />

      {/* Header Section */}
      <section className="pt-32 pb-12 sm:pt-40 sm:pb-20 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-white/5 overflow-hidden relative">
        {/* Abstract Background Accents */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-[120px] -z-0 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] -z-0 -translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-all mb-8 group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Home
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-primary/20">
                <Sparkles size={12} />
                Global Catalog
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-charcoal dark:text-white tracking-tighter leading-[0.9] uppercase">
                Explore All <br />
                <span className="text-slate-300 dark:text-zinc-800">
                  Mall Items.
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                Discover our curated collection of luxury items, tech
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
                  placeholder="Search products or stores..."
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
                      {products
                        .filter((p) =>
                          (p.name || "")
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          (p.shopName || "")
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                        )
                        .slice(0, 5)
                        .map((p, i) => (
                          <button
                            key={`${p.id}-${i}`}
                            onClick={() => {
                              setSearchQuery(p.name || "");
                              setSelectedProduct(p);
                            }}
                            className="w-full p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 text-left group/item"
                          >
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  className="w-full h-full object-cover group-hover/item:scale-110 transition-transform"
                                  alt={p.name}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                  <ShoppingBag size={14} className="sm:size-[18px]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] sm:text-xs font-black text-charcoal dark:text-white line-clamp-1">
                                {p.name || "Untitled Product"}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-[8px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                  {p.price || "Price on Inquiry"}
                                </p>
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {p.shopName}
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={12}
                              className="text-slate-300 group-hover/item:text-primary transition-colors sm:size-[14px] -rotate-90"
                            />
                          </button>
                        ))}
                      {products.filter((p) =>
                        (p.name || "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        (p.shopName || "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())
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

              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Sort By
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "featured", label: "Featured" },
                    { id: "price-low", label: "Price: Low-High" },
                    { id: "price-high", label: "Price: High-Low" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id)}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                        sortBy === option.id
                          ? "bg-charcoal dark:bg-white dark:text-black text-white"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200",
                      )}
                    >
                      {option.label}
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
                Assembling Catalog...
              </p>
            </div>
          ) : sortedProducts.length > 0 ? (
            <>
              <div className="mb-10 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {sortedProducts.length} items
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
                {sortedProducts.map((product, idx) => (
                  <ProductCard
                    key={`${product.id}-${idx}`}
                    product={product}
                    onClick={setSelectedProduct}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-zinc-950 rounded-[3rem] border border-dashed border-slate-200 dark:border-white/10">
              <ShoppingBag size={48} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tighter mb-2">
                No Items Found
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

      {/* Modals */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onInquire={(shopName) => {
          setChatInitialShopName(shopName);
          setIsChatOpen(true);
          setSelectedProduct(null);
        }}
      />

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
