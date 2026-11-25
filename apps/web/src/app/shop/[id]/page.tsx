"use client";

import { optimizedImage } from "@/lib/media";
import {
  availabilityLabel,
  isOutOfStock,
  productHref,
} from "@/lib/products";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Star,
  Store,
  Tag,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DigitalStorefront } from "@/types/storefront";
import {
  getDirectoryShopsAction,
  getStorefrontByIdAction,
} from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { spaCache } from "@/utils/cache";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { ShopPromos } from "@/components/shop-promos";
import NotificationDropdown from "@/components/notification-dropdown";
import { FeedbackSection } from "@/components/feedback-section";
import { LoginModal } from "@/components/login-modal";
import { FAVORITES_EVENT, readLocalFavorites, setFavorite } from "@/lib/favorites";
import { formatSaleDate, isSaleActive, saleEndsAt } from "@/lib/post-sales";
import clsx from "clsx";

// Premium Placeholders for Broken/Blob URLs
const PLACEHOLDERS = [
  "/images/logo/gudget.jpg",
  "/images/logo/gudget2.jpg",
  "/images/logo/gudget3.webp",
  "/images/logo/logoshop.jpg",
];

const FLOOR_LABELS: Record<string, string> = {
  ground: "Ground Floor",
  first: "First Floor",
  second: "Second Floor",
};

type ShopTab = "products" | "about" | "promos";
type SortKey = "featured" | "price-asc" | "price-desc" | "name-asc";

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

/** Prices are raw strings ("99.0", "1111", "---"); only format real numbers. */
const formatPrice = (raw?: string | null): string | null => {
  const value = (raw || "").trim();
  if (!value) return null;
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || !/\d/.test(value)) return value;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
  }).format(numeric);
};

const priceValue = (raw?: string | null): number | null => {
  const value = (raw || "").trim().replace(/,/g, "");
  if (!value || !/\d/.test(value)) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

/** Display-only cleanup for descriptions that were saved with light markdown. */
const plainText = (text?: string | null): string =>
  (text || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[*_`>]/g, "")
    .trim();

const plainPreview = (text?: string | null): string =>
  plainText(text).replace(/\s+/g, " ").trim();

type InfoItem = { label: string; value: React.ReactNode; icon: LucideIcon };

export default function ShopProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [shop, setShop] = useState<DigitalStorefront | null>(() => {
    return params?.id ? spaCache.get("shop_profile_" + params.id) : null;
  });
  const [loading, setLoading] = useState(() => {
    return params?.id ? !spaCache.has("shop_profile_" + params.id) : true;
  });
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<{
    avgRating: number;
    reviewCount: number;
    floor: string | null;
  } | null>(() => {
    return params?.id ? spaCache.get("shop_extras_" + params.id) : null;
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ShopTab>("products");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortKey>("featured");
  const [promoCount, setPromoCount] = useState<number | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  // Products open their own page (/products/[shopId]/[productId]).
  const setSelectedProduct = (p: any) => {
    const shopId = p?.shopId || (params.id as string);
    if (shopId && p?.id) router.push(productHref(shopId, p.id));
  };

  useEffect(() => {
    async function loadShop() {
      if (params?.id) {
        const hasCache = spaCache.has("shop_profile_" + params.id);
        if (!hasCache) setLoading(true);
        if (!spaCache.get("shop_extras_" + params.id)) setExtras(null);
        setError(null);
        const [res, directory] = await Promise.all([
          getStorefrontByIdAction(params.id as string),
          getDirectoryShopsAction().catch(() => null),
        ]);
        if (res.success && res.data) {
          setShop(res.data);
          setActiveImageIndex(0);
          spaCache.set("shop_profile_" + params.id, res.data);
        } else {
          // If we have cached data but API failed, let's keep showing cached data but log error
          if (!hasCache) {
            setError(res.error || "Shop not found");
          }
        }
        if (directory && directory.success && directory.data) {
          const row = directory.data.find((s) => s.id === params.id);
          if (row) {
            const nextExtras = {
              avgRating: Number(row.avgRating || 0),
              reviewCount: Number(row.reviewCount || 0),
              floor: row.floor || null,
            };
            setExtras(nextExtras);
            spaCache.set("shop_extras_" + params.id, nextExtras);
          }
        }
        setLoading(false);
      }
    }
    loadShop();
  }, [params?.id]);

  // Reset the catalog controls when visiting another shop.
  useEffect(() => {
    setActiveTab("products");
    setActiveCategory("All");
    setSortBy("featured");
    setProductSearch("");
    setPromoCount(null);
  }, [params?.id]);

  // Favourites: account-backed when signed in (see lib/favorites).
  useEffect(() => {
    const refresh = () =>
      setIsFavorited(shop?.id ? readLocalFavorites().includes(shop.id) : false);
    refresh();
    window.addEventListener(FAVORITES_EVENT, refresh);
    return () => window.removeEventListener(FAVORITES_EVENT, refresh);
  }, [shop?.id]);

  const toggleFavorite = async () => {
    if (!shop?.id) return;
    const next = !isFavorited;
    setIsFavorited(next);
    const ok = await setFavorite(shop.id, next, user?.id);
    if (!ok) setIsFavorited(!next);
  };

  const products = shop?.products ?? [];
  const activeSales = (shop?.post_sales ?? []).filter((sale) => isSaleActive(sale));

  const productCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const p of products) {
      const category = (p.category || "").trim();
      if (category) seen.add(category);
    }
    return Array.from(seen);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (activeCategory !== "All" && (p.category || "").trim() !== activeCategory) {
        return false;
      }
      if (!query) return true;
      return (
        (p.name || "").toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query)
      );
    });

    if (sortBy === "name-asc") {
      rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "price-asc" || sortBy === "price-desc") {
      rows.sort((a, b) => {
        const aPrice = priceValue(a.price);
        const bPrice = priceValue(b.price);
        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return sortBy === "price-asc" ? aPrice - bPrice : bPrice - aPrice;
      });
    }

    return rows;
  }, [products, productSearch, activeCategory, sortBy]);

  const searchMatches = productSearch.trim()
    ? products
        .filter((p) =>
          (p.name || "")
            .toLowerCase()
            .includes(productSearch.trim().toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const totalPromos = (promoCount ?? 0) + activeSales.length;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-6 bg-[#FAF7F3] dark:bg-zinc-950">
        <Loader2 className="h-12 w-12 animate-spin text-[#C51D30]" />
        <p className="animate-pulse text-xs font-bold text-[#A79E98]">
          Consulting Mall Concierge...
        </p>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F3] p-8 text-center dark:bg-zinc-950">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#C51D30]/10 text-[#C51D30]">
          <AlertTriangle size={40} />
        </div>
        <h2 className="font-display mb-3 text-3xl font-semibold tracking-tight text-[#21191B] dark:text-white">
          Slot Vacant
        </h2>
        <p className="mb-8 max-w-sm font-medium text-[#70656A] dark:text-slate-400">
          {error || "This unit currently has no digital profile."}
        </p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-full bg-[#C51D30] px-7 py-3.5 text-xs font-bold text-white shadow-lg shadow-[#C51D30]/25 transition-all hover:bg-[#A8172A] hover:shadow-xl active:scale-95"
        >
          <ArrowLeft size={16} /> Return to Directory
        </button>
      </div>
    );
  }

  const galleryUrls = getGalleryUrls(shop.gallery_urls);
  const coverIndex = galleryUrls.length ? activeImageIndex % galleryUrls.length : 0;
  const coverUrl = galleryUrls.length
    ? getSafeUrl(galleryUrls[coverIndex], coverIndex)
    : null;
  const coverIsVideo = !!coverUrl &&
    (!!coverUrl.match(/\.(mp4|webm|mov|ogg)$/i) || coverUrl.includes("/video/upload/"));
  const logo = getSafeUrl(shop.logo_url || "", 0);
  const hasUnit =
    !!shop.unit_id &&
    shop.unit_id !== "PENDING" &&
    shop.unit_id !== "PENDING_ASSIGNMENT";
  const floorKey = extras?.floor || shop.floor || null;
  const floorLabel = floorKey ? FLOOR_LABELS[floorKey] || floorKey : null;

  const infoItems: InfoItem[] = [
    {
      label: "Products",
      value: `${products.length} ${products.length === 1 ? "item" : "items"}`,
      icon: ShoppingBag,
    },
  ];
  if (extras && extras.reviewCount > 0) {
    infoItems.push({
      label: "Rating",
      value: `${extras.avgRating.toFixed(1)} (${extras.reviewCount} ${
        extras.reviewCount === 1 ? "review" : "reviews"
      })`,
      icon: Star,
    });
  }
  if (shop.category) {
    infoItems.push({ label: "Category", value: shop.category, icon: Tag });
  }
  if (hasUnit) {
    infoItems.push({
      label: "Location",
      value: `Unit ${shop.unit_id}${floorLabel ? ` · ${floorLabel}` : ""}`,
      icon: MapPin,
    });
  }
  if (shop.opening_hours) {
    infoItems.push({
      label: "Hours",
      value: shop.opening_hours,
      icon: Clock,
    });
  }
  if (shop.phone) {
    infoItems.push({
      label: "Phone",
      value: (
        <a
          href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`}
          className="hover:text-[#C51D30]"
        >
          {shop.phone}
        </a>
      ),
      icon: Phone,
    });
  }
  if (shop.createdAt) {
    const joined = new Date(shop.createdAt);
    if (!Number.isNaN(joined.getTime())) {
      infoItems.push({
        label: "Joined",
        value: joined.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        icon: CalendarDays,
      });
    }
  }

  const tabs: {
    id: ShopTab;
    label: string;
    shortLabel?: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    { id: "products", label: "Products", icon: ShoppingBag, count: products.length },
    { id: "about", label: "About the shop", shortLabel: "About", icon: Store, count: 0 },
    {
      id: "promos",
      label: "Promos & sales",
      shortLabel: "Promos",
      icon: Tag,
      count: totalPromos,
    },
  ];

  const openChat = () => {
    if (isAuthenticated) setIsChatOpen(true);
    else setIsLoginModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F3] pb-24 text-[#21191B] dark:bg-zinc-950 dark:text-white">
      {/* Slim sticky back-nav */}
      <nav className="sticky top-0 z-50 border-b border-[#EDE6E0] bg-[#FAF7F3]/90 backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Back to directory"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8E2DE] bg-white text-[#70656A] shadow-xs transition-colors hover:border-[#C51D30]/30 hover:text-[#C51D30] dark:border-white/10 dark:bg-zinc-900 dark:text-slate-300"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#A79E98]">
                Now visiting
              </p>
              <p className="truncate text-sm font-bold text-[#21191B] dark:text-white">
                {shop.shop_name}
              </p>
            </div>
          </div>
          {isAuthenticated ? (
            <NotificationDropdown />
          ) : (
            <div className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-7 lg:px-10">
        {/* Wide horizontal shop profile card */}
        <section className="overflow-hidden rounded-[1.75rem] border border-[#E8E2DE] bg-white shadow-[0_24px_60px_-45px_rgba(33,25,27,0.45)] dark:border-white/10 dark:bg-zinc-900">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]">
            {/* Cover */}
            <div className="group/cover relative min-h-[300px] overflow-hidden bg-zinc-900 sm:min-h-[345px] lg:min-h-[360px]">
              {coverIsVideo ? (
                <video
                  src={coverUrl!}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedImage(coverUrl, 1600)}
                  alt={`${shop.shop_name} cover`}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 overflow-hidden bg-linear-to-br from-[#3A2E31] via-[#241C1E] to-[#120E0F]">
                  {shop.logo_url && !shop.logo_url.startsWith("blob:") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={optimizedImage(logo, 240)}
                      alt=""
                      aria-hidden
                      className="h-full w-full scale-125 object-cover opacity-25 blur-2xl"
                    />
                  )}
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-black/10" />

              {/* Favourite */}
              <button
                type="button"
                onClick={toggleFavorite}
                aria-pressed={isFavorited}
                aria-label={
                  isFavorited
                    ? `Remove ${shop.shop_name} from favourites`
                    : `Save ${shop.shop_name} to favourites`
                }
                title={isFavorited ? "Saved" : "Save to favourites"}
                className={clsx(
                  "absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-all",
                  isFavorited
                    ? "border-[#C51D30] bg-[#C51D30] text-white"
                    : "border-white/40 bg-white/20 text-white hover:bg-white hover:text-[#C51D30]",
                )}
              >
                <Heart size={17} fill={isFavorited ? "currentColor" : "none"} />
              </button>

              {/* Status + photo counter */}
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                {galleryUrls.length > 0 && (
                  <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                    {(coverIndex + 1).toString().padStart(2, "0")} /{" "}
                    {galleryUrls.length.toString().padStart(2, "0")}
                  </span>
                )}
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-lg backdrop-blur-md",
                    shop.is_open
                      ? "border-emerald-400/30 bg-emerald-500/85 text-white"
                      : "border-white/15 bg-black/45 text-slate-200",
                  )}
                >
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      shop.is_open ? "animate-pulse bg-white" : "bg-slate-400",
                    )}
                  />
                  {shop.is_open ? "Open now" : "Closed"}
                </span>
              </div>

              {/* Gallery arrows */}
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous shop photo"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === 0 ? galleryUrls.length - 1 : prev - 1,
                      )
                    }
                    className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white opacity-80 backdrop-blur-md transition-all hover:bg-black/55 active:scale-95 sm:opacity-0 sm:group-hover/cover:opacity-100"
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next shop photo"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === galleryUrls.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white opacity-80 backdrop-blur-md transition-all hover:bg-black/55 active:scale-95 sm:opacity-0 sm:group-hover/cover:opacity-100"
                  >
                    <ChevronRight size={19} />
                  </button>
                </>
              )}

              {/* Identity + chat */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
                <div className="flex items-end gap-3 sm:gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white/85 bg-white shadow-xl sm:h-16 sm:w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async"
                      src={optimizedImage(logo, 240)}
                      alt={`${shop.shop_name} logo`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 pb-0.5">
                    <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
                      {shop.shop_name}
                    </h1>
                    {shop.category && (
                      <p className="mt-1.5 text-xs font-semibold text-white/70">
                        {shop.category}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openChat}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#C51D30] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#C51D30]/30 transition-all hover:bg-[#A8172A] hover:shadow-xl active:scale-[0.98]"
                >
                  <MessageCircle size={15} /> Chat
                </button>
              </div>
            </div>

            {/* Shop information */}
            <div className="flex flex-col p-5 sm:p-6 lg:p-7">
              <p className="text-xs font-bold text-[#C51D30]">
                Shop information
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#70656A] dark:text-slate-400">
                {shop.is_open
                  ? "Open now — browse the catalog or say hello."
                  : "Currently closed — you can still browse the catalog."}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {infoItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-start gap-3 rounded-xl border border-[#F0EAE4] bg-[#FDFBF9] p-3 dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C51D30]/15 bg-[#C51D30]/5 text-[#C51D30]">
                      <item.icon size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#A79E98]">
                        {item.label}
                      </p>
                      <div className="mt-0.5 truncate text-[12.5px] font-semibold text-[#21191B] dark:text-slate-200">
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {shop.description && (
                <div className="mt-auto pt-4">
                  <div className="border-t border-[#F0EAE4] pt-4 dark:border-white/10">
                    <p className="text-xs font-bold text-[#A79E98]">
                      About
                    </p>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-[#70656A] dark:text-slate-400">
                      {plainText(shop.description)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("about")}
                      className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#C51D30] hover:underline"
                    >
                      Read more <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Gallery thumbnails (preserved) */}
        {galleryUrls.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {galleryUrls.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImageIndex(i)}
                aria-label={`View shop photo ${i + 1}`}
                aria-current={coverIndex === i}
                className={clsx(
                  "h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                  coverIndex === i
                    ? "border-[#C51D30] opacity-100"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async"
                  src={optimizedImage(getSafeUrl(url, i), 1200)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Rounded tab bar */}
        <div className="mt-5 flex w-full flex-wrap gap-1.5 rounded-2xl border border-[#E8E2DE] bg-white p-1.5 shadow-xs dark:border-white/10 dark:bg-zinc-900 sm:w-fit sm:flex-nowrap">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={clsx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[11.5px] font-semibold transition-all sm:gap-2 sm:px-5 sm:text-[12.5px]",
                  isActive
                    ? "bg-[#C51D30] text-white shadow-md shadow-[#C51D30]/25"
                    : "text-[#70656A] hover:bg-[#FAF7F3] hover:text-[#21191B] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <tab.icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel || tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#C51D30]/10 text-[#C51D30]",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Products */}
        <div className={activeTab === "products" ? "block" : "hidden"}>
          <div className="mt-4 rounded-2xl border border-[#E8E2DE] bg-white p-3 shadow-xs dark:border-white/10 dark:bg-zinc-900 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A79E98]"
                />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Search in ${shop.shop_name}`}
                  aria-label={`Search in ${shop.shop_name}`}
                  className="h-12 w-full rounded-xl border border-[#E8E2DE] bg-white pl-11 pr-10 text-[13px] font-medium text-[#21191B] outline-hidden transition-all placeholder:text-[#A79E98] focus:border-[#C51D30] focus:ring-4 focus:ring-[#C51D30]/10 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A79E98] transition-colors hover:text-[#C51D30]"
                  >
                    <X size={15} />
                  </button>
                )}

                {/* Predictive matches (existing behaviour) */}
                {productSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[#E8E2DE] bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
                    <div className="border-b border-[#F0EAE4] px-4 py-2.5 text-xs font-bold text-[#A79E98] dark:border-white/10">
                      Matching products
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {searchMatches.map((p, i) => {
                        const price = formatPrice(p.price);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProductSearch(p.name || "")}
                            className="flex w-full items-center gap-3 border-b border-[#F7F2ED] px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-[#FAF7F3] dark:border-white/5 dark:hover:bg-white/5"
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F4EEE6] dark:bg-zinc-800">
                              {p.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img loading="lazy" decoding="async"
                                  src={optimizedImage(getSafeUrl(p.image_url, i), 600)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#D8CCC2]">
                                  <ShoppingBag size={15} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[#21191B] dark:text-white">
                                {p.name || "Untitled product"}
                              </p>
                              <p className="text-[11px] font-bold text-[#C51D30]">
                                {price || "Price on inquiry"}
                              </p>
                            </div>
                            <ChevronRight size={13} className="shrink-0 text-[#C4B8AE]" />
                          </button>
                        );
                      })}
                      {searchMatches.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-[#8B7F76]">
                          No matching products found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative sm:w-52">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  aria-label="Sort products"
                  className="h-12 w-full appearance-none rounded-xl border border-[#E8E2DE] bg-white pl-4 pr-10 text-[12.5px] font-semibold text-[#21191B] outline-hidden transition-all focus:border-[#C51D30] focus:ring-4 focus:ring-[#C51D30]/10 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8B7F76]"
                />
              </div>
            </div>

            {productCategories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {["All", ...productCategories].map((category) => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      aria-pressed={isActive}
                      className={clsx(
                        "rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold transition-all",
                        isActive
                          ? "border-[#C51D30] bg-[#C51D30] text-white shadow-xs shadow-[#C51D30]/20"
                          : "border-[#E8E2DE] bg-white text-[#70656A] hover:border-[#C51D30]/45 hover:text-[#C51D30] dark:border-white/10 dark:bg-zinc-950 dark:text-slate-300",
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#8B7F76]">
              Showing {filteredProducts.length} of {products.length}{" "}
              {products.length === 1 ? "product" : "products"}
              {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
            </p>
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch("")}
                className="text-xs font-semibold text-[#C51D30] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>

          {filteredProducts.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product, index) => {
                const price = formatPrice(product.price);
                const soldOut = isOutOfStock(product);
                return (
                  <article
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${product.name || "product"}`}
                    onClick={() =>
                      setSelectedProduct({
                        ...product,
                        shopName: shop.shop_name,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedProduct({
                          ...product,
                          shopName: shop.shop_name,
                        });
                      }
                    }}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E8E2DE] bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#C51D30]/25 hover:shadow-xl focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C51D30] dark:border-white/10 dark:bg-zinc-900"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#F4EEE6] dark:bg-zinc-800">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={optimizedImage(getSafeUrl(product.image_url, index), 600)}
                          alt={product.name || "Product"}
                          loading="lazy"
                          className={clsx(
                            "h-full w-full object-cover transition-transform duration-700 group-hover:scale-105",
                            soldOut && "grayscale",
                          )}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#D8CCC2]">
                          <ShoppingBag size={34} />
                        </div>
                      )}

                      {soldOut && (
                        <>
                          <div className="absolute inset-0 bg-black/40" />
                          <span className="absolute inset-0 flex items-center justify-center p-3 text-center">
                            <span className="rounded-full border border-white/20 bg-black/75 px-4 py-1.5 text-xs font-bold text-white">
                              Sold out
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                      {product.category && (
                        <span className="mb-1.5 inline-flex w-fit rounded-full bg-[#C51D30]/10 px-2 py-0.5 text-xs font-bold text-[#C51D30]">
                          {product.category}
                        </span>
                      )}
                      <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#21191B] transition-colors group-hover:text-[#C51D30] dark:text-white sm:text-sm">
                        {product.name || "Untitled product"}
                      </h3>
                      {plainPreview(product.description) && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8B7F76] dark:text-slate-500">
                          {plainPreview(product.description)}
                        </p>
                      )}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        {price ? (
                          <span className="text-[15px] font-extrabold tracking-tight text-[#C51D30] sm:text-base">
                            {price}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[#A79E98]">
                            Price on inquiry
                          </span>
                        )}
                        <span
                          className={clsx(
                            "shrink-0 text-xs font-semibold",
                            soldOut ? "text-[#A79E98]" : "text-emerald-600",
                          )}
                        >
                          {availabilityLabel(product)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[#DDD2C6] bg-white/70 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-900/40">
              <Search size={28} className="mx-auto text-[#C4B8AE]" />
              <p className="mt-3 text-sm font-semibold text-[#21191B] dark:text-white">
                No products found
              </p>
              <p className="mt-1 text-xs text-[#8B7F76]">
                Try a different search or category.
              </p>
            </div>
          )}
        </div>

        {/* About the shop */}
        <div className={activeTab === "about" ? "block" : "hidden"}>
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.75fr)]">
            <div className="rounded-2xl border border-[#E8E2DE] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-zinc-900 sm:p-7">
              <p className="text-xs font-bold text-[#C51D30]">
                About the shop
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-[#21191B] dark:text-white">
                {shop.shop_name}
              </h2>
              {shop.description ? (
                <p className="mt-4 whitespace-pre-line text-[13.5px] leading-7 text-[#70656A] dark:text-slate-400">
                  {plainText(shop.description)}
                </p>
              ) : (
                <p className="mt-4 text-sm text-[#8B7F76]">
                  This shop has not added a description yet.
                </p>
              )}
            </div>

            <aside className="rounded-2xl border border-[#E8E2DE] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-zinc-900 sm:p-6">
              <h3 className="text-xs font-semibold text-[#A79E98]">
                Shop details
              </h3>
              <div className="mt-4 space-y-3">
                {infoItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C51D30]/15 bg-[#C51D30]/5 text-[#C51D30]">
                      <item.icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#A79E98]">
                        {item.label}
                      </p>
                      <div className="mt-0.5 wrap-break-word text-[12.5px] font-semibold text-[#21191B] dark:text-slate-200">
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={openChat}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#C51D30] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#C51D30]/25 transition-all hover:bg-[#A8172A] hover:shadow-xl active:scale-[0.99]"
              >
                <MessageCircle size={14} /> Chat with the shop
              </button>
            </aside>
          </div>
        </div>

        {/* Promos & sales */}
        <div className={activeTab === "promos" ? "block" : "hidden"}>
          <div className="mt-4 space-y-6">
            <ShopPromos
              tenantId={shop.id}
              embedded
              onCount={setPromoCount}
            />

            {activeSales.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C51D30]/10 px-3 py-1 text-xs font-bold text-[#C51D30]">
                    <Flame size={12} /> Sales
                  </span>
                  <span className="text-xs font-semibold text-[#A79E98]">
                    {activeSales.length} running now
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {activeSales.map((sale) => (
                    <article
                      key={sale.id}
                      className="overflow-hidden rounded-2xl border border-[#E8E2DE] bg-white shadow-xs dark:border-white/10 dark:bg-zinc-900"
                    >
                      <div className="relative aspect-16/10 bg-[#F4EEE6] dark:bg-zinc-800">
                        {sale.image_url &&
                        !sale.image_url.startsWith("blob:") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" decoding="async"
                            src={optimizedImage(sale.image_url, 1200)}
                            alt={sale.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#D8CCC2]">
                            <Tag size={34} />
                          </div>
                        )}
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#C51D30] px-3 py-1 text-xs font-bold text-white shadow-lg shadow-[#C51D30]/30">
                          <Flame size={11} fill="currentColor" /> Sale
                        </span>
                      </div>
                      <div className="space-y-2 p-4 sm:p-5">
                        <h3 className="text-lg font-semibold leading-tight text-[#21191B] dark:text-white sm:text-xl">
                          {sale.title}
                        </h3>
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B7F76]">
                          <CalendarDays size={12} className="text-[#C51D30]" />{" "}
                          Until {formatSaleDate(saleEndsAt(sale))}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {promoCount === 0 && activeSales.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#DDD2C6] bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-zinc-900/40">
                <Tag size={30} className="mx-auto text-[#C4B8AE]" />
                <p className="mt-3 text-sm font-semibold text-[#21191B] dark:text-white">
                  No active promos or sales right now
                </p>
                <p className="mt-1 text-xs text-[#8B7F76]">
                  Check back soon for new offers from {shop.shop_name}.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Tenant-Specific Feedback Section */}
      <FeedbackSection isAuthenticated={isAuthenticated} tenantId={shop.id} />

      <ChatLauncher hidden={isChatOpen} />

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
    </div>
  );
}
