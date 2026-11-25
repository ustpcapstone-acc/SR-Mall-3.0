"use client";

import { hasAssignedUnit } from "@/lib/products";
import { optimizedImage } from "@/lib/media";
import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ShopCard } from "@/components/shop-card";
import { FilterRow, PublicHeader, PublicSearch } from "@/components/public-header";
import { floorLabel } from "@/lib/floors";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { Loader2 } from "lucide-react";
import { getDirectoryShopsAction } from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";

export default function TenantDirectoryPage() {
  const { isAuthenticated } = useAuth();
  const [shops, setShops] = useState<any[]>(() => spaCache.get("directory_shops") || []);
  const [loading, setLoading] = useState(() => !spaCache.has("directory_shops"));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(
    null,
  );

  const categories = [
    "All Categories",
    "On Promo",
    "Fashion",
    "Electronics",
    "Food",
    "Living",
    "Beauty",
  ];

  useEffect(() => {
    const hasCache = spaCache.has("directory_shops");
    fetchShops(hasCache);
  }, []);

  const fetchShops = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const res = await getDirectoryShopsAction();
    if (res.success && res.data) {
      setShops(res.data);
      spaCache.set("directory_shops", res.data);
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
      (selectedCategory === "On Promo" && !!shop.activePromo) ||
      (shop.description && shop.description.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  const query = searchQuery.toLowerCase();
  const suggestions = shops
    .filter(
      (s) =>
        s.shop_name.toLowerCase().includes(query) ||
        s.unit_id.toLowerCase().includes(query) ||
        (s.description || "").toLowerCase().includes(query),
    )
    .slice(0, 5)
    .map((s) => ({
      key: s.id,
      title: s.shop_name,
      detail: hasAssignedUnit(s.unit_id)
        ? [`Unit ${s.unit_id}`, floorLabel(s.floor)].filter(Boolean).join(", ")
        : "Unit to be assigned",
      image: optimizedImage(s.logo_url || "/images/logo/logoshop.jpg", 160),
      href: `/shop/${s.id}`,
    }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
      <Navbar />

      <PublicHeader title="Tenant directory" description="Every shop at SR Mall, with where to find it.">
        <PublicSearch
          value={searchQuery}
          onChange={setSearchQuery}
          label="Search shops or unit numbers"
          placeholder="Search shops or unit numbers"
          suggestions={suggestions}
        />
      </PublicHeader>

      {/* Results Section */}
      <section className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6">
            <FilterRow
              label="Category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((c) => ({ id: c, label: c === "All Categories" ? "All" : c }))}
            />
          </div>
          {loading ? (
            <div className="space-y-3 py-20 text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <p className="text-sm text-kumo-subtle">Loading shops...</p>
            </div>
          ) : filteredShops.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-kumo-subtle">
                Showing {filteredShops.length} {filteredShops.length === 1 ? "shop" : "shops"}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
            <div className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-16 text-center">
              <h3 className="font-display text-xl font-semibold text-kumo-default">No shops found</h3>
              <p className="mt-1 text-sm text-kumo-subtle">Try another search or category.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All Categories");
                }}
                className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
              >
                Clear search and filters
              </button>
            </div>
          )}
        </div>
      </section>

      <ChatLauncher hidden={isChatOpen} />

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
