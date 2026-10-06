"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, ArrowRight, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { isSaleActive } from "@/lib/post-sales";

interface ShopSale {
  id: string;
  title: string;
  date: string;
  imageUrl: string;
  shopName: string;
  shopId: string;
}

export const ShopSalesSlider = ({ shops }: { shops: any[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const allSales = shops.flatMap(shop => 
      // Only sales that haven't ended yet (see lib/post-sales).
      (shop.post_sales || []).filter((post: any) => isSaleActive(post)).map((post: any) => ({
        id: post.id,
        title: post.title,
        date: new Date(post.date || new Date()).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        imageUrl: post.image_url || "",
        shopName: shop.shop_name,
        shopId: shop.id,
      }))
    ).filter(sale => sale.imageUrl).sort(() => 0.5 - Math.random());
    
    setSales(allSales);
    setIsLoading(false);
  }, [shops]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    if (sales.length === 0) return;
    setDirection(newDirection);
    setCurrentIndex((prevIndex: number) => (prevIndex + newDirection + sales.length) % sales.length);
  };

  useEffect(() => {
    if (sales.length === 0) return;
    const timer = setInterval(() => {
      paginate(1);
    }, 6000);
    return () => clearInterval(timer);
  }, [sales]);

  if (isLoading || sales.length === 0) {
    return null; // Or a skeleton loader
  }

  const currentSale = sales[currentIndex];

  return (
    <section id="shop-sales" className="py-20 bg-white dark:bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-4">
            <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.2em] rounded-full border border-primary/20">
              Hot Deals
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-charcoal dark:text-white tracking-tighter uppercase">
              Shop <span className="text-primary">Sales</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xl text-lg">
              Check out the latest promotions, sales, and new arrivals from our tenants.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => paginate(-1)}
              className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-charcoal dark:text-white hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg border border-slate-200 dark:border-white/5"
              suppressHydrationWarning
            >
              <ArrowLeft size={24} />
            </button>
            <button
              onClick={() => paginate(1)}
              className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-charcoal dark:text-white hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg border border-slate-200 dark:border-white/5"
              suppressHydrationWarning
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>

        <div className="relative h-[400px] sm:h-[500px] md:h-[600px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.5 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);

                if (swipe < -swipeConfidenceThreshold) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold) {
                  paginate(-1);
                }
              }}
              className="absolute inset-0 w-full h-full"
            >
              {currentSale.imageUrl.startsWith("data:video") || currentSale.imageUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                <video
                  src={currentSale.imageUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentSale.imageUrl}
                  alt={currentSale.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              
              {/* Exact style requested by user */}
              <div className="absolute inset-0 transition-opacity duration-1000 bg-gradient-to-b from-transparent via-transparent to-black/5 dark:to-black/60" />
              
              {/* Additional dark overlay for better readability if needed, but keeping user's requested style primary */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute bottom-0 left-0 w-full p-6 sm:p-12 md:p-16 flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
                <div className="space-y-3 sm:space-y-4 max-w-2xl">
                  <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/30">
                    {currentSale.shopName}
                  </span>
                  <h3 className="text-2xl sm:text-5xl md:text-7xl font-black text-white leading-tight uppercase tracking-tighter">
                    {currentSale.title}
                  </h3>
                  <div className="flex items-center gap-3 text-white/90 font-bold text-base sm:text-lg">
                    <Tag size={16} className="text-primary sm:w-5 sm:h-5" />
                    {currentSale.date}
                  </div>
                </div>
                
                <Link href={`/shop/${currentSale.shopId}`} suppressHydrationWarning className="group flex items-center gap-2 sm:gap-4 px-4 py-2.5 sm:px-8 sm:py-5 bg-primary text-white font-black text-[9px] sm:text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-white hover:text-primary transition-all active:scale-95 shadow-2xl shadow-primary/40 shrink-0 self-start md:self-auto">
                  Now Visiting
                  <br className="hidden sm:block" />
                  {currentSale.shopName}
                  <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Indicators */}
          <div className="absolute top-8 right-8 flex flex-col gap-2 z-10">
            {sales.map((_: any, index: number) => (
              <button
                key={index}
                suppressHydrationWarning
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={clsx(
                  "w-1.5 transition-all duration-500 rounded-full",
                  index === currentIndex ? "h-12 bg-primary" : "h-3 bg-white/30 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
