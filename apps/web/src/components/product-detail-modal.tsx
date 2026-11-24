"use client";

import React from "react";
import { X, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface ProductDetailModalProps {
  product: {
    id: string;
    name: string;
    price: string;
    image_url?: string;
    shopName: string;
    shopId: string;
    description?: string;
  } | null;
  onClose: () => void;
  onInquire?: (shopName: string) => void;
}

export const ProductDetailModal = ({
  product,
  onClose,
  onInquire,
}: ProductDetailModalProps) => {
  if (!product) return null;

  return (
    <div
      className={clsx(
        "fixed",
        "inset-0",
        "z-100",
        "flex",
        "items-end",
        "sm:items-center",
        "justify-center",
        "bg-black/90",
        "backdrop-blur-xl",
        "p-0",
        "sm:p-4",
        "animate-fade-in",
      )}
    >
      <div
        className={clsx(
          "w-full",
          "sm:max-w-4xl",
          "bg-white",
          "dark:bg-zinc-900",
          "rounded-t-4xl",
          "sm:rounded-[3rem]",
          "overflow-y-auto",
          "max-h-[95svh]",
          "sm:max-h-[90vh]",
          "grid",
          "grid-cols-1",
          "md:grid-cols-2",
          "relative",
          "shadow-2xl",
          "border",
          "border-white/10",
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 sm:top-8 sm:right-8 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full flex items-center justify-center text-charcoal dark:text-white transition-all shadow-lg active:scale-95"
        >
          <X size={20} />
        </button>

        <div
          className={clsx(
            "aspect-square",
            "md:aspect-auto",
            "bg-slate-100",
            "dark:bg-zinc-800",
            "max-h-[45svh]",
            "md:max-h-none",
          )}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              className="w-full h-full object-cover"
              alt={product.name}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ShoppingBag size={80} />
            </div>
          )}
        </div>

        <div className="p-6 sm:p-10 lg:p-14 flex flex-col justify-center space-y-5 sm:space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-primary">
              {product.shopName}
            </span>
            <h3 className="text-2xl sm:text-4xl lg:text-5xl font-semibold text-charcoal dark:text-white tracking-tight leading-none">
              {product.name}
            </h3>
            <p className="text-xl sm:text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight mt-2">
              {product.price}
            </p>
          </div>

          <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">
            "
            {product.description ||
              "No detailed description provided for this premium item."}
            "
          </p>

          <div className="pt-3 sm:pt-6 space-y-3 sm:space-y-4">
            <Link
              href={`/shop/${product.shopId}`}
              className="w-full py-4 sm:py-5 bg-charcoal dark:bg-zinc-800 text-white rounded-2xl flex items-center justify-center gap-4 font-semibold text-xs hover:bg-black transition-all shadow-xl active:scale-95 text-center"
            >
              Visit Official Store
            </Link>
            {onInquire && (
              <button
                onClick={() => onInquire(product.shopName)}
                className="w-full py-4 sm:py-5 bg-primary text-white rounded-2xl flex items-center justify-center gap-4 font-semibold text-xs hover:scale-105 transition-all shadow-xl shadow-primary/20 active:scale-95"
              >
                Inquire for Availability
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
