"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  ShoppingBag,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Store,
} from "lucide-react";
import Link from "next/link";
import { getPublicAreaSlots } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";
import clsx from "clsx";
import { AreaSlot } from "@srmall/database";
import SpaceDetailModal from "@/components/space-detail-modal";
import { ReservationStepper } from "@/components/reservation-stepper";
import { mergeSlotPatch, slotAccess, useLiveSlots } from "@/lib/slot-live";
import { toast } from "sonner";
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

  const fetchSlots = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getPublicAreaSlots();
    if (res.success && res.data) {
      // Filter for Available and Reserved per user preference in public view
      setSlots(res.data.filter(s => s.status === "AVAILABLE" || s.status === "RESERVED"));
    }
    if (!silent) setLoading(false);
  };

  // Live: a unit someone just reserved flips to Pending here without a reload.
  useLiveSlots(
    (patch) => setSlots((prev) => mergeSlotPatch(prev as any, patch) as any),
    () => fetchSlots(true),
  );

  const filteredSlots = slots.filter((slot) => {
    return slot.unit_id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
      <Navbar />

      {/* Header Section */}
      <section className="pt-32 pb-12 sm:pt-40 sm:pb-20 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-white/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-[120px] z-0 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] z-0 -translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-primary transition-all mb-8 group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Public View
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-charcoal dark:text-white tracking-tight leading-[1.05]">
                Available <br />
                <span className="text-slate-500 dark:text-slate-400">
                  Spaces
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
                  className="w-full bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-primary transition-all shadow-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reservation process */}
      <section className="pt-10 sm:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-4xl border border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-950 p-5 sm:p-7 shadow-xs">
            {isAuthenticated && user?.role === "TENANT" && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-500/20 dark:bg-amber-500/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Store size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Cannot reserve — already a tenant
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                    Your account already holds a tenant unit. A tenant can only
                    reserve one unit, so additional reservations are disabled.
                    Contact mall administration if you need a different space.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Simple 3-step process
                </p>
                <h2 className="text-lg sm:text-xl font-semibold text-charcoal dark:text-white tracking-tight">
                  How reservation works
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Submit your business permit, wait for the admin&apos;s document
                review, then receive the approval.
              </p>
            </div>
            <ReservationStepper current={1} />
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
              <p className="text-sm font-semibold text-slate-400">
                Fetching Inventory...
              </p>
            </div>
          ) : filteredSlots.length > 0 ? (
            <>
              <div className="mb-10 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400">
                  Showing {filteredSlots.length} available units
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 lg:gap-10">
                {filteredSlots.map((slot, idx) => {
                  const access = slotAccess(slot as any, user?.id);
                  return (
                  <div
                    key={slot.id}
                    onClick={() =>
                      access.open
                        ? setSelectedSlot(slot)
                        : toast.info(
                          slot.status === "RESERVED"
                            ? `Unit ${slot.unit_id} is pending: another customer reserved it first. It's released automatically if it isn't confirmed within 2 days.`
                            : `Unit ${slot.unit_id} is already occupied.`,
                        )
                    }
                    aria-disabled={!access.open}
                    className={clsx(
                      "group relative bg-white dark:bg-zinc-900 rounded-[1.25rem] sm:rounded-4xl border border-slate-100 dark:border-white/5 overflow-hidden transition-all duration-700 shadow-xs",
                      access.open ? "cursor-pointer hover:shadow-2xl hover:-translate-y-2" : "cursor-not-allowed opacity-75 grayscale-35",
                    )}
                  >
                    <div className="aspect-4/3 sm:aspect-16/10 relative overflow-hidden bg-slate-100 dark:bg-black">
                      {slot.space_images && slot.space_images[0] ? (
                        <img
                          src={slot.space_images[0]}
                          alt={`Space ${slot.unit_id}`}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 bg-linear-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                          <ShoppingBag className="w-6 h-6 sm:w-12 sm:h-12 text-slate-200 dark:text-zinc-800 mb-2 sm:mb-4" />
                          <p className="text-xs font-semibold text-slate-300 text-center">
                            Premium Unit <br />
                            Preview Pending
                          </p>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
                      
                      <div className="absolute top-2 sm:top-6 right-2 sm:right-6">
                        <div
                          className={clsx(
                            "backdrop-blur-xl px-2 sm:px-4 py-1 sm:py-2 rounded-full border text-xs font-semibold transition-all shadow-2xl",
                            slot.status === "AVAILABLE"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : access.mine
                                ? "bg-yellow-400/25 border-yellow-400/60 text-yellow-300"
                                : "bg-amber-500/20 border-amber-500/40 text-amber-400",
                          )}
                        >
                          {access.label}
                        </div>
                      </div>

                      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-8 right-3 sm:right-8">
                        <h4 className="text-base sm:text-3xl font-semibold text-white tracking-tight leading-none">
                          Unit {slot.unit_id}
                        </h4>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                           <div className={clsx("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full", slot.status === "AVAILABLE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")}></div>
                           <p className="text-xs font-bold text-white/70">
                             Plaza Wing — Level 1
                           </p>
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
                        <div className="px-4 sm:px-8 py-2 sm:py-3 bg-white text-black text-xs font-semibold rounded-full shadow-3xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          Inquire Details
                        </div>
                      </div>
                    </div>

                    <div className="p-3 sm:p-8 flex items-center justify-between bg-white dark:bg-zinc-900/50">
                      <div className="space-y-0.5 sm:space-y-1.5">
                        <p className="text-xs font-semibold text-slate-400">
                          Floor Area
                        </p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg sm:text-3xl font-semibold text-charcoal dark:text-white tracking-tight">
                            {slot.sqm_size}
                          </p>
                          <span className="text-xs font-semibold text-primary">SQM</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-right">
                         <span className="text-xs font-bold text-slate-400">Lease</span>
                         <span className="text-xs font-semibold text-charcoal dark:text-white">Flexible</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-zinc-950 rounded-[3rem] border border-dashed border-slate-200 dark:border-white/10">
              <MapPin size={48} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-semibold text-charcoal dark:text-white tracking-tight mb-2">
                No Spaces Found
              </h3>
              <p className="text-sm text-slate-400 font-medium">
                Try adjusting your search query.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-8 text-primary font-semibold text-xs hover:underline"
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
          slot={(slots.find((s) => s.id === selectedSlot.id) || selectedSlot) as any}
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

      <ChatLauncher hidden={isChatOpen} />

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
