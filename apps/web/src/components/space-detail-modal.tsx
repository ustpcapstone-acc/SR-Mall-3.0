"use client";

import { useEffect, useState } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { reserveSlotAction } from "@/app/actions/space-slot";
import { toast } from "sonner";
import { announceSlotChange } from "@/lib/slot-live";

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
  // Confirmation step before the reservation is actually submitted
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Live status: flips to RESERVED/OCCUPIED if someone else got the unit first
  const [status, setStatus] = useState<string>(slot.status);
  // Follow live updates from the page (someone else reserved it while open)
  useEffect(() => setStatus(slot.status), [slot.status]);
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
      router.push(`/public-view?recipient=admin&unit=${encodeURIComponent(slot.unit_id)}`);
      onClose();
    }
  };

  // Step 1: checks, then show the confirmation dialog (nothing is submitted yet)
  const handleReservation = () => {
    if (!isAuthenticated || !user) {
      if (onLoginRequired) onLoginRequired();
      else toast.error("Please log in to reserve a unit.");
      return;
    }
    if (status !== "AVAILABLE") {
      toast.error("Unit unavailable", {
        description: "This unit has already been reserved or occupied.",
      });
      return;
    }
    setAgreed(false);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  // Step 2: the customer confirmed → submit
  const submitReservation = async () => {
    if (!user || !agreed) return;
    setIsReserving(true);
    setConfirmError(null);
    try {
      const res: any = await reserveSlotAction(slot.unit_id, user.id, user.name || "Customer");
      if (res.success) {
        setStatus("RESERVED");
        // Update this tab's lists right away (other tabs get it via realtime)
        announceSlotChange({ id: slot.id, status: "RESERVED", tenant_id: user.id });
        setConfirmOpen(false);
        toast.success(`Unit ${slot.unit_id} reserved`, {
          description: "It's held for you for 24 hours. The leasing team will contact you to confirm.",
          duration: 7000,
        });
        onClose();
      } else {
        if (res.code === "UNAVAILABLE" && res.status) {
          setStatus(res.status);
          announceSlotChange({ id: slot.id, status: res.status, tenant_id: null });
        }
        setConfirmError(res.error || "The reservation could not be processed right now.");
      }
    } catch {
      setConfirmError("Couldn't reach the server. Check your connection and try again.");
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
                status === "AVAILABLE"
                  ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"
                  : status === "RESERVED"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase">
              {status === "AVAILABLE"
                ? "Available"
                : status === "RESERVED"
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
                      Rent
                    </span>
                  </div>
                  {/* Rent is private — quoted by the leasing team, never shown publicly. */}
                  <p className="text-lg sm:text-xl font-black text-charcoal dark:text-white tracking-tight">
                    On request
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Ask the leasing team for a quote.</p>
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
            {status === "AVAILABLE" ? (
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleReservation}
                  disabled={isReserving}
                  className="w-full py-6 bg-charcoal dark:bg-white text-white dark:text-black hover:bg-primary dark:hover:bg-primary dark:hover:text-white font-black rounded-2xl transition-all shadow-xl dark:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] disabled:opacity-50 active:scale-95 uppercase tracking-widest text-xs"
                >
                  Secure Reservation
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

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isReserving && setConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-title"
            className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl p-7 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Confirm reservation</p>
              <h2 id="reserve-title" className="mt-1 text-xl font-black text-charcoal dark:text-white">
                Reserve Unit {slot.unit_id}?
              </h2>
            </div>

            <dl className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-white/5 text-sm">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</dt>
                <dd className="font-bold text-charcoal dark:text-white">{slot.unit_id}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Floor</dt>
                <dd className="font-bold text-charcoal dark:text-white capitalize">{slot.floor || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Size</dt>
                <dd className="font-bold text-charcoal dark:text-white">{slot.sqm_size} sqm</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rent</dt>
                <dd className="font-bold text-charcoal dark:text-white">On request</dd>
              </div>
            </dl>

            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <Clock size={16} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  The unit is held for you for <strong>24 hours</strong>, then released automatically if it isn&apos;t confirmed.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                <span>The leasing team reviews your request and contacts you. This is not yet a lease contract.</span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-slate-400" />
                <span>You can have one active reservation at a time.</span>
              </li>
            </ul>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#BE1E2D]"
              />
              <span className="text-sm text-charcoal dark:text-white">
                I understand and want to reserve Unit {slot.unit_id}.
              </span>
            </label>

            {confirmError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-red-600 text-xs font-bold"
              >
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {confirmError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isReserving}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReservation}
                disabled={!agreed || isReserving || status !== "AVAILABLE"}
                className="flex-1 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isReserving && <Loader2 size={14} className="animate-spin" />}
                {isReserving ? "Reserving…" : "Confirm reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
