"use client";

import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { isOutOfStock } from "@/lib/products";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: string;
    image_url?: string;
    shopName: string;
    description?: string;
    stock?: number | null;
    status?: string;
  };
  onClick: (product: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ProductCard = ({
  product,
  onClick,
  className,
  style,
}: ProductCardProps) => {
  return (
    <div
      onClick={() => onClick(product)}
      style={style}
      className={clsx(
        "group relative aspect-3/4 bg-white dark:bg-zinc-900 rounded-4xl overflow-hidden",
        "border-2 border-slate-100 dark:border-white/5 hover:border-primary/30",
        "shadow-lg hover:shadow-[0_30px_60px_-15px_rgba(190,30,45,0.25)]",
        "transition-all duration-700 cursor-pointer",
        className,
      )}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        {product.image_url ? (
          <img
            src={product.image_url}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            alt={product.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-zinc-800 bg-slate-50 dark:bg-black">
            <ShoppingBag size={64} />
          </div>
        )}
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-700 z-10" />
      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-11" />

      {/* Out of stock */}
      {isOutOfStock(product) && (
        <div className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-[0.15em]">
          Out of stock
        </div>
      )}

      {/* Shop Label */}
      <div className="absolute top-3 left-3 z-20">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-[0.15em]">
          {product.shopName}
        </div>
      </div>

      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 md:p-6 z-30 transform translate-y-0 md:translate-y-3 group-hover:translate-y-0 transition-all duration-700 text-left">
        <div className="space-y-2">
          <div className="overflow-hidden">
            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tighter leading-none transform translate-y-0 md:translate-y-full group-hover:translate-y-0 transition-transform duration-700 delay-100 line-clamp-2">
              {product.name}
            </h4>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-[0.15em]">
                Curated Item
              </p>
              <p className="text-lg sm:text-xl font-black text-primary drop-shadow-[0_0_15px_rgba(190,30,45,0.5)]">
                {product.price}
              </p>
            </div>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white text-primary flex items-center justify-center shadow-xl transform translate-x-0 md:translate-x-3 opacity-100 md:opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-700 delay-200">
              <ArrowRight size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Glass Border Effect on Hover */}
      <div className="absolute inset-4 border border-white/0 group-hover:border-white/20 rounded-[2.5rem] transition-all duration-700 z-40 pointer-events-none" />
    </div>
  );
};
