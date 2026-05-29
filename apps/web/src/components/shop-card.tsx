"use client";

import React, { useState } from "react";
import {
  Heart,
  MapPin,
  Tag,
  ChevronRight,
  MessageCircle,
  Eye,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DigitalStorefront } from "@/types/storefront";

interface ShopCardProps {
  shop: DigitalStorefront;
  onClick?: () => void;
  onMessage?: (shopName: string) => void;
}

// Premium Placeholders for Broken/Blob URLs
const PLACEHOLDERS = [
  "/images/logo/gudget.jpg",
  "/images/logo/gudget2.jpg",
  "/images/logo/gudget3.webp",
  "/images/logo/logoshop.jpg",
];

const getSafeUrl = (url: string | null | undefined, index: number) => {
  if (!url || url.startsWith("blob:") || url.includes("placeholder")) {
    if (index === 0) return "/images/logo/logoshop.jpg"; // Default Logo
    return PLACEHOLDERS[(index - 1) % PLACEHOLDERS.length];
  }
  return url;
};

export const ShopCard = ({ shop, onClick, onMessage }: ShopCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const { id, shop_name, unit_id, is_open, logo_url } = shop;

  // Sync favorites with localStorage
  React.useEffect(() => {
    const favorites = JSON.parse(
      localStorage.getItem("sr_mall_favorites") || "[]",
    );
    setIsFavorited(favorites.includes(id));
  }, [id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const favorites = JSON.parse(
      localStorage.getItem("sr_mall_favorites") || "[]",
    );
    let newFavorites;

    if (favorites.includes(id)) {
      newFavorites = favorites.filter((favId: string) => favId !== id);
      setIsFavorited(false);
    } else {
      newFavorites = [...favorites, id];
      setIsFavorited(true);
    }

    localStorage.setItem("sr_mall_favorites", JSON.stringify(newFavorites));

    // Trigger a custom event so other components can react if needed
    window.dispatchEvent(new Event("favorites-updated"));
  };

  return (
    <Link
      href={id === "preview" ? "#" : `/shop/${id}`}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative bg-white dark:bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none hover:shadow-[0_40px_80px_-15px_rgba(190,30,45,0.25)] transition-all duration-700 border-2 border-slate-100 dark:border-white/5 hover:border-primary/20 cursor-pointer block ${!is_open ? "opacity-85" : ""
        }`}
    >
      {/* Image Container with Hover Zoom & Grayscale Logic */}
      <div
        className={`relative h-48 sm:h-64 md:h-72 overflow-hidden transition-all duration-700 ${!is_open ? "grayscale" : ""}`}
      >
        <Image
          src={getSafeUrl(logo_url, 0) || "/placeholder-shop.jpg"}
          alt={shop_name}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-110"
        />

        {/* Dark Overlay on Hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-700 pointer-events-none flex items-center justify-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-500 shadow-2xl">
            <Eye size={28} />
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`absolute top-5 left-5 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl transition-all duration-500 border border-white/20 shadow-xl ${is_open
            ? "bg-emerald-500/80 text-white"
            : "bg-zinc-800/80 text-zinc-100"
            }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${is_open ? "bg-white shadow-[0_0_8px_white] animate-pulse" : "bg-zinc-400"}`}
          ></div>
          {is_open ? "Open Now" : "Closed"}
        </div>

        {/* Favorite Icon */}
        <button
          onClick={toggleFavorite}
          className={`absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border border-white/20 backdrop-blur-xl shadow-xl ${isFavorited
            ? "bg-primary text-white scale-110 shadow-primary/40"
            : "bg-white/30 text-white hover:bg-white hover:text-primary hover:scale-110"
            }`}
        >
          <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
        </button>

        {/* Floating Unit ID Tag */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2 bg-charcoal/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
          <MapPin size={14} className="text-primary" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
            {unit_id}
          </span>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-6 sm:p-10 relative">
        {/* Mall Theme Accent */}
        <div className="absolute top-0 right-10 w-16 h-1 bg-primary transform origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-b-full shadow-[0_0_10px_rgba(190,30,45,0.5)]"></div>

        <div className="flex flex-col gap-2 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-3xl font-black text-charcoal dark:text-white tracking-tighter group-hover:text-primary transition-colors leading-none mb-3 uppercase">
                {shop_name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-primary/5 border border-primary/20 rounded-md flex items-center gap-2">
                  <Tag size={12} className="text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                    {shop.category || "Fashion"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  Official Tenant
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2 mt-4 italic">
            "
            {shop.description ||
              "Step into a world of curated style and premium experiences."}
            "
          </p>
        </div>

        <div className="flex items-center gap-4 pt-8 mt-4 border-t border-slate-100 dark:border-white/10">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onMessage) onMessage(shop_name);
            }}
            className="flex-1 py-4.5 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary text-slate-900 dark:text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"
          >
            <MessageCircle
              size={18}
              className="text-primary group-hover/btn:scale-125 transition-transform"
            />
            Live Inquiry
          </button>

          <div className="w-14 h-14 rounded-[1.5rem] bg-charcoal dark:bg-zinc-900 text-white flex items-center justify-center transition-all shadow-xl group-hover:bg-primary group-hover:shadow-[0_20px_40px_-5px_rgba(190,30,45,0.4)] active:scale-95 group-hover:scale-110 border border-white/5">
            <ChevronRight size={24} />
          </div>
        </div>
      </div>
    </Link>
  );
};
