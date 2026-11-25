"use client";

import { optimizedImage } from "@/lib/media";
import React from "react";
import { ShoppingBag } from "lucide-react";
import { cn } from "@cloudflare/kumo";
import { isOutOfStock } from "@/lib/products";
import { formatPrice } from "@/lib/price";

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

/** Picture on top, then name, shop and price. Nothing sits over the picture. */
export const ProductCard = ({ product, onClick, className, style }: ProductCardProps) => {
  const price = formatPrice(product.price);
  const soldOut = isOutOfStock(product);
  return (
    <button
      type="button"
      onClick={() => onClick(product)}
      style={style}
      className={cn(
        "group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base text-left",
        "transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <span className="relative block aspect-square w-full overflow-hidden bg-kumo-recessed">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            decoding="async"
            src={optimizedImage(product.image_url, 600)}
            alt={product.name}
            className={cn(
              "absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105",
              soldOut && "opacity-60 grayscale",
            )}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-kumo-subtle">
            <ShoppingBag size={40} aria-hidden />
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-center text-xs font-semibold text-white">
            Out of stock
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-kumo-default sm:text-base">{product.name}</span>
        <span className="truncate text-sm text-kumo-subtle">{product.shopName}</span>
        <span className="mt-auto pt-2">
          {price ? (
            <span className="text-lg font-semibold tabular-nums text-primary">{price}</span>
          ) : (
            <span className="text-sm text-kumo-subtle">Ask for price</span>
          )}
        </span>
      </span>
    </button>
  );
};
