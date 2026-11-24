"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  ShoppingBag,
  Star,
  Store,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { LoginModal } from "@/components/login-modal";
import { useAuth } from "@/app/providers";
import { getProductPageAction } from "@/app/actions/tenant";
import { sendProductInquiryAction } from "@/app/actions/product-inquiry";
import { availabilityLabel, isOutOfStock, productHref } from "@/lib/products";

type PageData = Extract<Awaited<ReturnType<typeof getProductPageAction>>, { success: true }>["data"];

const FLOORS: Record<string, string> = { ground: "Ground Floor", first: "First Floor", second: "Second Floor" };

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = String(params.shopId || "");
  const productId = String(params.productId || "");
  const { user, isAuthenticated } = useAuth();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inquiring, setInquiring] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await getProductPageAction(shopId, productId);
    if (res.success) setData(res.data);
    else setError(res.error);
  }, [shopId, productId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const inquire = async () => {
    if (!data) return;
    if (!isAuthenticated || !user?.id) {
      setLoginOpen(true);
      return;
    }
    setInquiring(true);
    const res = await sendProductInquiryAction(user.id, data.shop.id, data.product.id);
    setInquiring(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Inquiry sent to ${data.shop.name}`, { description: `Availability: ${res.availability}` });
    setChatOpen(true);
  };

  const openChatOnly = () => {
    if (!isAuthenticated) {
      setLoginOpen(true);
      return;
    }
    setChatOpen(true);
  };

  const p = data?.product;
  const shop = data?.shop;
  const out = p ? isOutOfStock(p) : false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest min-w-0">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1 hover:text-primary shrink-0">
            <ArrowLeft size={13} /> Back
          </button>
          <ChevronRight size={12} className="shrink-0" />
          <Link href="/products" className="hover:text-primary shrink-0">Products</Link>
          {shop && (
            <>
              <ChevronRight size={12} className="shrink-0" />
              <Link href={`/shop/${shop.id}`} className="hover:text-primary truncate">{shop.name}</Link>
            </>
          )}
        </nav>

        {error ? (
          <div className="py-24 text-center space-y-4 bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5">
            <ShoppingBag size={48} className="mx-auto text-slate-300" />
            <p className="text-lg font-black text-charcoal dark:text-white">{error}</p>
            <p className="text-sm text-slate-500">It may have been removed or hidden by the shop.</p>
            <Link href="/products" className="inline-flex px-6 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest">
              Browse products
            </Link>
          </div>
        ) : !data || !p || !shop ? (
          <div className="py-32 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
            {/* Product */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 shadow-xs">
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 dark:bg-zinc-800">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className={clsx("w-full h-full object-cover", out && "grayscale-40")} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ShoppingBag size={80} />
                  </div>
                )}
                {out && (
                  <span className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/70 text-white text-[10px] font-black uppercase tracking-widest">
                    Out of stock
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-5 py-1">
                <div className="space-y-2">
                  {p.category && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                      <Tag size={10} /> {p.category}
                    </span>
                  )}
                  <h1 className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white leading-tight wrap-break-word">{p.name}</h1>
                  {shop.reviewCount > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold text-charcoal dark:text-white">{shop.avgRating.toFixed(1)}</span>
                      shop rating · {shop.reviewCount} review{shop.reviewCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>

                <div className="px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60">
                  <p className="text-3xl sm:text-4xl font-black text-primary">{p.price || "Ask for price"}</p>
                </div>

                <dl className="grid grid-cols-[7rem_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-400 font-bold">Availability</dt>
                  <dd className={clsx("font-black flex items-center gap-1.5", out ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                    <Package size={15} /> {availabilityLabel(p)}
                  </dd>
                  <dt className="text-slate-400 font-bold">Sold by</dt>
                  <dd className="font-bold text-charcoal dark:text-white truncate">{shop.name}</dd>
                  <dt className="text-slate-400 font-bold">Location</dt>
                  <dd className="font-bold text-charcoal dark:text-white">
                    Unit {shop.unitId}
                    {shop.floor ? ` · ${FLOORS[shop.floor] || shop.floor}` : ""}
                  </dd>
                </dl>

                <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={inquire}
                    disabled={inquiring}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
                  >
                    {inquiring ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                    {out ? "Ask about restock" : "Inquire availability"}
                  </button>
                </div>
              </div>
            </section>

            {/* Shop profile */}
            <section className="p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex items-center gap-4 md:pr-6 md:border-r border-slate-100 dark:border-white/5 min-w-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 shrink-0 flex items-center justify-center">
                    {shop.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-slate-400">{shop.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-black text-charcoal dark:text-white truncate">{shop.name}</p>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
                        shop.isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400",
                      )}
                    >
                      <span className={clsx("w-1.5 h-1.5 rounded-full", shop.isOpen ? "bg-emerald-500" : "bg-slate-400")} />
                      {shop.isOpen ? "Open now" : "Closed"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={openChatOnly}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/5"
                      >
                        <MessageCircle size={12} /> Chat
                      </button>
                      <Link
                        href={`/shop/${shop.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary"
                      >
                        <Store size={12} /> View shop
                      </Link>
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-sm">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Star size={11} /> Rating</dt>
                    <dd className="mt-1 font-black text-primary">
                      {shop.reviewCount > 0 ? `${shop.avgRating.toFixed(1)} (${shop.reviewCount})` : "No reviews yet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><ShoppingBag size={11} /> Products</dt>
                    <dd className="mt-1 font-black text-primary">{shop.productCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><MapPin size={11} /> Location</dt>
                    <dd className="mt-1 font-black text-primary">
                      Unit {shop.unitId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      {shop.openingHours ? <Clock size={11} /> : <CalendarDays size={11} />} {shop.openingHours ? "Hours" : "Joined"}
                    </dt>
                    <dd className="mt-1 font-black text-primary truncate">
                      {shop.openingHours ||
                        new Date(shop.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* Details */}
            <section className="p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-4xl border border-slate-100 dark:border-white/5 shadow-xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Product details</h2>
              <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
                <dt className="text-slate-400 font-bold">Category</dt>
                <dd className="font-bold text-charcoal dark:text-white">{p.category || "—"}</dd>
                <dt className="text-slate-400 font-bold">Shop</dt>
                <dd className="font-bold text-charcoal dark:text-white">{shop.name}</dd>
              </dl>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line pt-2 border-t border-slate-100 dark:border-white/5">
                {p.description || "The shop hasn't added a description for this item yet. Tap Inquire to ask them directly."}
              </p>
            </section>

            {/* More from this shop */}
            {data.moreFromShop.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <h2 className="text-lg font-black text-charcoal dark:text-white">More from {shop.name}</h2>
                  <Link href={`/shop/${shop.id}`} className="text-[11px] font-black uppercase tracking-widest text-primary hover:underline">
                    See all
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {data.moreFromShop.map((item: any) => (
                    <ProductCard
                      key={item.id}
                      product={{ ...item, shopName: shop.name }}
                      onClick={() => router.push(productHref(shop.id, item.id))}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <ChatLauncher hidden={chatOpen} />
      <ChatBox
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialRecipient="shop"
        initialShopName={shop?.name || undefined}
      />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <Footer />
    </div>
  );
}
