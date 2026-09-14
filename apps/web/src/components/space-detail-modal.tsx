"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AreaSlot } from "@srmall/database";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Square,
  Ruler,
  CreditCard,
  Send,
  MapPin,
  Clock,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { reserveSlotAction } from "@/app/actions/space-slot";
import { toast } from "sonner";

interface SpaceDetailModalProps {
  slot: AreaSlot;
  onClose: () => void;
  onInquire?: (unitId: string) => void;
  onLoginRequired?: () => void;
}

export default function SpaceDetailModal({
  slot,
  onClose,
  onInquire,
  onLoginRequired,
}: SpaceDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReserving, setIsReserving] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  // Images are now a native array in PostgreSQL
  const images: string[] = Array.isArray(slot.space_images)
    ? slot.space_images
    : [];

  const DEFAULT_FEATURES = [
    "Dynamic high-visibility frontage",
    "Enterprise-grade utility infrastructure",
    "Direct concierge & mall support access",
    "Climate-optimized spatial layout",
  ];

  const features: string[] =
    Array.isArray((slot as any).features) && (slot as any).features.length > 0
      ? (slot as any).features
      : DEFAULT_FEATURES;

  const handleInquiry = () => {
    if (onInquire) {
      onInquire(slot.unit_id);
    } else {
      // Fallback or default behavior
      router.push(
        `/messenger?recipient=admin&subject=Inquiry_for_${slot.unit_id}&unitId=${slot.id}`,
      );
      onClose();
    }
  };

  const handleReservation = async () => {
    if (!isAuthenticated || !user) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        router.push("/login");
      }
      return;
    }

    if (slot.status !== "AVAILABLE") {
      toast.error("Unit Unavailable", {
        description: "This unit has already been reserved or occupied.",
      });
      return;
    }

    try {
      setIsReserving(true);
      const res = await reserveSlotAction(
        slot.unit_id,
        user.id,
        user.name || "Anonymous User",
      );

      if (res.success) {
        toast.success("Interest Registered", {
          description: `Success! Our leasing team has been notified of your interest in Unit ${slot.unit_id}. We will contact you shortly.`,
          duration: 6000,
        });
        onClose();
      } else {
        toast.error("Request Interrupted", {
          description:
            res.error || "The reservation could not be processed at this time.",
        });
      }
    } catch (err) {
      toast.error("Network Error", {
        description:
          "Unable to reach the leasing server. Please check your connection.",
      });
    } finally {
      setIsReserving(false);
    }
  };

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-950 border-t sm:border border-slate-200 dark:border-white/10 rounded-t-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 flex flex-col md:flex-row max-h-[96vh] sm:max-h-[90vh]">
        {/* Mall Identity Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-orange-500 to-primary opacity-80" />
        <button
          onClick={onClose}
          className="absolute top-5 right-5 sm:top-8 sm:right-8 z-50 p-2.5 sm:p-3 text-slate-400 dark:text-white/40 hover:text-charcoal dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-all border border-slate-200 dark:border-white/10 backdrop-blur-md active:scale-95"
        >
          <X size={18} className="sm:w-5 sm:h-5" />
        </button>

        {/* Image Carousel Section */}
        <div className="relative w-full md:w-1/2 h-[350px] md:h-[650px] bg-black">
          {images.length > 0 ? (
            <>
              <img
                src={images[currentImageIndex]}
                alt={`${slot.unit_id} - View ${currentImageIndex + 1}`}
                className="w-full h-full object-cover transition-all duration-700 brightness-90 group-hover:brightness-100"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white bg-black/40 hover:bg-primary rounded-full transition-all border border-white/20 shadow-2xl backdrop-blur-xl"
                  >
                    <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white bg-black/40 hover:bg-primary rounded-full transition-all border border-white/20 shadow-2xl backdrop-blur-xl"
                  >
                    <ChevronRight size={20} className="sm:w-6 sm:h-6" />
                  </button>

                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 bg-black/40 px-4 py-2.5 rounded-full backdrop-blur-xl border border-white/10">
                    {images.map((_item: string, i: number) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          i === currentImageIndex
                            ? "bg-primary w-8"
                            : "bg-white/20 w-1.5 hover:bg-white/50 cursor-pointer"
                        }`}
                        onClick={() => setCurrentImageIndex(i)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-200 dark:text-white/10 gap-4 bg-slate-50 dark:bg-zinc-950">
              <Square size={64} strokeWidth={1} />
              <p className="text-[10px] font-black uppercase tracking-widest">
                No Visual Assets
              </p>
            </div>
          )}

          {/* Premium Status Badge */}
          <div className="absolute top-8 left-8 flex items-center gap-3 px-5 py-2.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                slot.status === "AVAILABLE"
                  ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"
                  : slot.status === "RESERVED"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase">
              {slot.status === "AVAILABLE"
                ? "Available"
                : slot.status === "RESERVED"
                  ? "Reserved"
                  : "Occupied"}
            </span>
          </div>
        </div>

        {/* Details Section */}
        <div className="flex-1 p-6 sm:p-10 lg:p-14 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-10">
            <div>
              <div className="flex items-center gap-3 text-primary mb-3">
                <MapPin size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-0.5">
                  Premier Business Hub
                </span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-charcoal dark:text-white tracking-tighter uppercase leading-[0.8] mb-10">
                Unit{" "}
                <span className="text-slate-200 dark:text-white/20">
                  {slot.unit_id}
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group bg-slate-50 dark:bg-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-white/10 hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 shadow-inner">
                  <div className="flex items-center gap-3 text-slate-400 dark:text-white/40 mb-2 sm:mb-3 group-hover:text-primary transition-colors">
                    <Ruler size={16} className="sm:w-4.5 sm:h-4.5" />
                    <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-[0.2em]">
                      Scale / Area
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white tracking-tight">
                    {slot.sqm_size}{" "}
                    <span className="text-xs sm:text-sm font-bold text-slate-300 dark:text-white/20">
                      SQM
                    </span>
                  </p>
                </div>

                <div className="group bg-slate-50 dark:bg-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-white/10 hover:border-emerald-500/20 dark:hover:border-white/20 transition-all duration-500 shadow-inner">
                  <div className="flex items-center gap-3 text-slate-400 dark:text-white/40 mb-2 sm:mb-3 group-hover:text-emerald-500 transition-colors">
                    <CreditCard size={16} className="sm:w-4.5 sm:h-4.5" />
                    <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-[0.2em]">
                      Base Rent
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white tracking-tight">
                    ₱{slot.base_rent.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-10 border-t border-slate-100 dark:border-white/5">
              <h4 className="text-[10px] font-black text-slate-300 dark:text-white/30 uppercase tracking-[0.4em]">
                Integrated Features
              </h4>
              <ul className="space-y-4">
                {features.map((feat, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-4 text-sm font-bold text-slate-600 dark:text-white/60 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(190,30,45,0.4)] group-hover:scale-150 transition-transform" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 space-y-4">
            {slot.status === "AVAILABLE" ? (
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleReservation}
                  disabled={isReserving}
                  className="w-full py-6 bg-charcoal dark:bg-white text-white dark:text-black hover:bg-primary dark:hover:bg-primary dark:hover:text-white font-black rounded-2xl transition-all shadow-xl dark:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] disabled:opacity-50 active:scale-95 uppercase tracking-widest text-xs"
                >
                  {isReserving
                    ? "Confirming Protocol..."
                    : "Secure Reservation"}
                </button>
                <button
                  onClick={handleInquiry}
                  className="w-full flex items-center justify-center gap-3 py-6 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-charcoal dark:text-white font-black rounded-2xl transition-all border border-slate-200 dark:border-white/10 group uppercase tracking-widest text-xs"
                >
                  <Send
                    size={18}
                    className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                  />
                  Request Executive Inquiry
                </button>
              </div>
            ) : (
              <div className="w-full py-8 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/5 flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-1">
                  <Clock size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-charcoal dark:text-white uppercase tracking-widest">
                    Verification Pending
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium max-w-[200px] leading-relaxed italic mx-auto">
                    This elite unit is currently under review for a new merchant
                    partnership.
                  </p>
                </div>
              </div>
            )}
            <p className="text-[8px] text-slate-400 dark:text-white/20 text-center mt-6 uppercase tracking-[0.3em] font-medium leading-loose">
              Lease operations subject to mall administration regulatory
              approval and verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
