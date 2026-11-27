"use client";

import { optimizedImage } from "@/lib/media";
import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { FilterRow, PublicHeader, PublicSearch } from "@/components/public-header";
import { formatPrice } from "@/lib/price";
import { productHref } from "@/lib/products";
import { useRouter } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { Loader2 } from "lucide-react";
import { loadStorefronts } from "@/lib/shared-request";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";

export default function AllProductsPage() {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<any[]>(() => spaCache.get("products") || []);
  const [loading, setLoading] = useState(() => !spaCache.has("products"));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const router = useRouter();
  // Products open their own page (/products/[shopId]/[productId]).
  const setSelectedProduct = (p: any) => {
    if (p?.shopId && p?.id) router.push(productHref(p.shopId, p.id));
  };
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(
    null,
  );
  const [sortBy, setSortBy] = useState("featured");

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
    const res = await loadStorefronts();
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

    // Tenant-chosen category wins; older items without one fall back to the description.
    const matchesCategory =
      selectedCategory === "All Categories" ||
      (product.category
        ? product.category.toLowerCase() === selectedCategory.toLowerCase()
        : !!product.description &&
          product.description
            .toLowerCase()
            .includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  // Items without a number ("Ask for price") go last when sorting by price.
  const priceNumber = (price?: string | null) => {
    const n = parseFloat(String(price ?? "").replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "featured") return 0;
    const priceA = priceNumber(a.price);
    const priceB = priceNumber(b.price);
    if (priceA === null || priceB === null) return Number(priceA === null) - Number(priceB === null);
    return sortBy === "price-low" ? priceA - priceB : priceB - priceA;
  });

  const query = searchQuery.toLowerCase();
  const suggestions = products
    .filter((p) => (p.name || "").toLowerCase().includes(query) || (p.shopName || "").toLowerCase().includes(query))
    .slice(0, 5)
    .map((p, i) => ({
      key: `${p.id}-${i}`,
      title: p.name || "Untitled product",
      detail: `${formatPrice(p.price) || "Ask for price"}, ${p.shopName}`,
      image: p.image_url ? optimizedImage(p.image_url, 160) : null,
      onSelect: () => {
        setSearchQuery(p.name || "");
        setSelectedProduct(p);
      },
    }));

  return (
    <div className="min-h-screen bg-kumo-recessed font-sans selection:bg-primary selection:text-white">
      <Navbar />

      <PublicHeader title="Products" description="Browse what the shops at SR Mall sell.">
        <PublicSearch
          value={searchQuery}
          onChange={setSearchQuery}
          label="Search products or shops"
          placeholder="Search products or shops"
          suggestions={suggestions}
        />
      </PublicHeader>

      {/* Results Section */}
      <section className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex flex-col gap-3">
            <FilterRow
              label="Category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((c) => ({ id: c, label: c === "All Categories" ? "All" : c }))}
            />
            <FilterRow
              label="Sort by"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { id: "featured", label: "Featured" },
                { id: "price-low", label: "Price: low to high" },
                { id: "price-high", label: "Price: high to low" },
              ]}
            />
          </div>
          {loading ? (
            <div className="space-y-3 py-20 text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <p className="text-sm text-kumo-subtle">Loading products...</p>
            </div>
          ) : sortedProducts.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-kumo-subtle">
                Showing {sortedProducts.length} {sortedProducts.length === 1 ? "item" : "items"}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
                {sortedProducts.map((product, idx) => (
                  <ProductCard
                    key={`${product.id}-${idx}`}
                    product={product}
                    onClick={setSelectedProduct}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-16 text-center">
              <h3 className="font-display text-xl font-semibold text-kumo-default">No items found</h3>
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

      {/* Modals */}

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
