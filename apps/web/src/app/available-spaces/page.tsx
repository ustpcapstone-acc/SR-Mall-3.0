"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatBox } from "@/components/chat-box";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  ShoppingBag,
  Loader2,
  ArrowLeft,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { getAreaSlots } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";
import clsx from "clsx";
import { AreaSlot } from "@srmall/database";
import SpaceDetailModal from "@/components/space-detail-modal";
import { LoginModal } from "@/components/login-modal";

export default function AvailableSpacesPage() {
  const { isAuthenticated, user } = useAuth();
  const [slots, setSlots] = useState<AreaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AreaSlot | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(null);
  const [chatRecipient, setChatRecipient] = useState<"shop" | "admin" | null>(null);
  const [chatInquirySlotId, setChatInquirySlotId] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    const res = await getAreaSlots();
    if (res.success && res.data) {
      // Filter for Available and Reserved per user preference in public view
      setSlots(res.data.filter(s => s.status === "AVAILABLE" || s.status === "RESERVED"));
    }
    setLoading(false);
  };

  const filteredSlots = slots.filter((slot) => {
    return slot.unit_id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
      <Navbar />

      {/* Header Section */}
      <section className="pt-32 pb-12 sm:pt-40 sm:pb-20 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-white/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-[120px] -z-0 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] -z-0 -translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <Link
            href="/public-view"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-all mb-8 group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Public View
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-primary/20">
                <LayoutGrid size={12} />
                Leasing Inventory
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-charcoal dark:text-white tracking-tighter leading-[0.9] uppercase">
                Available <br />
                <span className="text-slate-300 dark:text-zinc-800">
                  Spaces.
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                Explore our premium commercial units ready for your business. From boutique stalls to anchor spaces.
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
                  placeholder="Search unit IDs (e.g. A-101)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all shadow-sm"
                />
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
                Fetching Inventory...
              </p>
            </div>
          ) : filteredSlots.length > 0 ? (
            <>
              <div className="mb-10 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {filteredSlots.length} available units
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 lg:gap-10">
                {filteredSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={clsx(
                      "group relative bg-white dark:bg-zinc-900 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 cursor-pointer shadow-sm hover:shadow-2xl hover:-translate-y-2",
                    )}
                  >
                    <div className="aspect-[4/3] sm:aspect-[16/10] relative overflow-hidden bg-slate-100 dark:bg-black">
                      {slot.space_images && slot.space_images[0] ? (
                        <img
                          src={slot.space_images[0]}
                          alt={`Space ${slot.unit_id}`}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                          <ShoppingBag className="w-6 h-6 sm:w-12 sm:h-12 text-slate-200 dark:text-zinc-800 mb-2 sm:mb-4" />
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
                            Premium Unit <br />
                            Preview Pending
                          </p>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
                      
                      <div className="absolute top-2 sm:top-6 right-2 sm:right-6">
                        <div
                          className={clsx(
                            "backdrop-blur-xl px-2 sm:px-4 py-1 sm:py-2 rounded-full border text-[7px] sm:text-[9px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] transition-all shadow-2xl",
                            slot.status === "AVAILABLE"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : "bg-amber-500/20 border-amber-500/40 text-amber-400",
                          )}
                        >
                          {slot.status === "AVAILABLE" ? "Available" : "Reserved"}
                        </div>
                      </div>

                      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-8 right-3 sm:right-8">
                        <h4 className="text-base sm:text-3xl font-black text-white tracking-tighter uppercase leading-none">
                          Unit {slot.unit_id}
                        </h4>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                           <div className={clsx("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full", slot.status === "AVAILABLE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")}></div>
                           <p className="text-[7px] sm:text-[10px] font-bold text-white/70 uppercase tracking-widest">
                             Plaza Wing — Level 1
                           </p>
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
                        <div className="px-4 sm:px-8 py-2 sm:py-3 bg-white text-black text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-full shadow-3xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          Inquire Details
                        </div>
                      </div>
                    </div>

                    <div className="p-3 sm:p-8 flex items-center justify-between bg-white dark:bg-zinc-900/50">
                      <div className="space-y-0.5 sm:space-y-1.5">
                        <p className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                          Floor Area
                        </p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg sm:text-3xl font-black text-charcoal dark:text-white tracking-tighter">
                            {slot.sqm_size}
                          </p>
                          <span className="text-[9px] sm:text-xs font-black text-primary">SQM</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-right">
                         <span className="text-[7px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lease</span>
                         <span className="text-[8px] sm:text-xs font-black text-charcoal dark:text-white uppercase">Flexible</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-zinc-950 rounded-[3rem] border border-dashed border-slate-200 dark:border-white/10">
              <MapPin size={48} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tighter mb-2">
                No Spaces Found
              </h3>
              <p className="text-sm text-slate-400 font-medium">
                Try adjusting your search query.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-8 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Detail Modals */}
      {selectedSlot && (
        <SpaceDetailModal
          slot={selectedSlot as any}
          onClose={() => setSelectedSlot(null)}
          onLoginRequired={() => setIsLoginModalOpen(true)}
          onInquire={(unitId) => {
            setChatInitialShopName(`Leasing Inquiry for Unit ${unitId}`);
            setChatRecipient("admin");
            setChatInquirySlotId(unitId);
            setIsChatOpen(true);
            setSelectedSlot(null);
          }}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialShopName={chatInitialShopName}
        initialRecipient={chatRecipient}
        inquirySlotId={chatInquirySlotId}
      />

      <Footer />
    </div>
  );
}
