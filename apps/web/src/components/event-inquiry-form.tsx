"use client";

import { optimizedImage } from "@/lib/media";
import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Megaphone,
  Mic2,
  Ticket,
  Wifi,
  X,
} from "lucide-react";
import clsx from "clsx";
import { submitInquiryAction } from "@/app/actions/inquiry";
import { LoginModal } from "./login-modal";

const FEATURES = [
  { icon: Wifi, label: "Connectivity" },
  { icon: Mic2, label: "Stage and sound" },
  { icon: Megaphone, label: "Promo package" },
  { icon: CalendarClock, label: "Reply within 12 to 24 hours" },
] as const;

const FIELD =
  "w-full rounded-xl border border-[#E6DED7] bg-white px-4 py-3 text-sm font-medium text-[#21191B] outline-hidden transition-all placeholder:text-[#A79E98] focus:border-[#C51D30] focus:ring-4 focus:ring-[#C51D30]/10 dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:placeholder:text-slate-500";

const FIELD_LABEL =
  "mb-2 block text-[13px] font-medium text-[#6F6468] dark:text-slate-400";

/** Turns *wrapped words* into the red italic accent used by the venue heading. */
function renderEmphasis(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={i} className="italic text-[#C51D30]">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export const EventInquiryForm = ({
  isAuthenticated,
  user,
  eyebrow,
  title,
  description,
  imageUrl,
  imageAlt,
}: {
  isAuthenticated: boolean;
  user?: any;
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
}) => {
  const eyebrowText = eyebrow?.trim() || "Venue booking";
  const headingText = title?.trim() || "Plan your next *big*\n*day* here.";
  const descriptionText =
    description?.trim() ||
    "Esports nights, sports meets, fitness events, trade shows and community gatherings. Tell us what you're planning and the events team gets back to you.";
  const [eventType, setEventType] = useState("Esports & Gaming Events");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventTypes = [
    "Esports & Gaming Events",
    "Mini Sports Competitions",
    "Fitness & Active Events",
    "Trade Shows & Exhibitions",
    "Community Gatherings",
  ];

  // Preview the selected image without touching the upload payload.
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const pickImage = (file: File | undefined | null) => {
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      setSubmitMessage({
        type: "error",
        message: "You must be logged in to submit an inquiry.",
      });
      return;
    }

    if (!eventDate || !eventTime) {
      setSubmitMessage({
        type: "error",
        message: "Please select both date and time.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    let imageUrl = "";
    let storageKey = "";

    if (imageFile) {
      try {
        const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
        const storage = getCloudStorageProvider();
        const uploadResult = await storage.uploadFile(imageFile, "inquiries");
        imageUrl = uploadResult.url;
        storageKey = uploadResult.key;
      } catch (err) {
        setSubmitMessage({
          type: "error",
          message: "Failed to upload the image. Please try again or remove it.",
        });
        setIsSubmitting(false);
        return;
      }
    }

    const result = await submitInquiryAction({
      userId: user.id,
      eventType: eventType,
      eventDate: new Date(eventDate),
      eventTime: eventTime,
      message: message,
      imageUrl: imageUrl || undefined,
      storageKey: storageKey || undefined,
    });

    if (result.success) {
      setSubmitMessage({
        type: "success",
        message: "Inquiry submitted! Please check your messages for updates.",
      });
      setEventDate("");
      setEventTime("");
      setMessage("");
      setImageFile(null);
      setEventType(eventTypes[0]);
    } else {
      setSubmitMessage({
        type: "error",
        message: result.error || "Failed to submit inquiry.",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="relative mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] lg:gap-10 xl:gap-12">
        {/* ── Left: venue information ───────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-[#C51D30]">
            {eyebrowText}
          </p>

          <h2 className="mt-3 whitespace-pre-line font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight text-[#21191B] dark:text-white">
            {renderEmphasis(headingText)}
          </h2>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#6F6468] dark:text-slate-400">
            {descriptionText}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2.5 rounded-xl border border-[#EFE9E2] bg-white px-4 py-3 shadow-[0_2px_8px_-4px_rgba(33,25,27,0.12)] dark:border-white/10 dark:bg-zinc-900"
              >
                <feature.icon
                  size={17}
                  strokeWidth={1.7}
                  className="shrink-0 text-[#C51D30]"
                  aria-hidden
                />
                <span className="text-[13.5px] font-semibold leading-snug text-[#21191B] dark:text-slate-200">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.4rem] border border-[#EFE9E2] bg-[#EFE9E2] shadow-[0_18px_40px_-28px_rgba(33,25,27,0.4)] dark:border-white/10 dark:bg-zinc-900">
            {/* Set in CMS → General Settings; the built-in picture is the fallback. */}
            <img
              src={optimizedImage(imageUrl?.trim() || "/images/storefront_hero_placeholder_2_1774159273401.png", 1200)}
              alt={(imageUrl?.trim() && imageAlt?.trim()) || "SR Mall venue space"}
              loading="lazy"
              decoding="async"
              className="h-56 w-full object-cover sm:h-64 lg:h-76"
            />
          </div>
        </div>

        {/* ── Right: reservation form card ──────────────────────────────── */}
        <div className="rounded-3xl border border-[#EFE9E2] bg-white p-5 shadow-[0_30px_70px_-42px_rgba(33,25,27,0.45)] dark:border-white/10 dark:bg-zinc-900 sm:p-7">
          {submitMessage && (
            <div
              role="status"
              className={clsx(
                "mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 animate-fade-in",
                submitMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
              )}
            >
              {submitMessage.type === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              )}
              <p className="text-[13px] font-medium leading-relaxed">
                {submitMessage.message}
              </p>
            </div>
          )}

          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDD2C6] bg-[#FAF7F3] px-6 py-16 text-center dark:border-white/10 dark:bg-zinc-950">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C51D30]/10 text-[#C51D30]">
                <Ticket size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#21191B] dark:text-white">
                Log in to send an inquiry
              </h3>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#6F6468] dark:text-slate-400">
                We use your verified SR Mall account so the events team can
                reply with updates.
              </p>
              <button
                suppressHydrationWarning
                onClick={() => setIsLoginModalOpen(true)}
                className="mt-6 rounded-full bg-[#C51D30] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C51D30]/25 transition-all hover:bg-[#A8172A] hover:shadow-xl active:scale-[0.99]"
              >
                Log in to continue
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {/* Kind of event */}
              <div>
                <p className={FIELD_LABEL}>Kind of event</p>
                <div className="flex flex-wrap gap-2.5">
                  {eventTypes.map((type) => (
                    <button
                      suppressHydrationWarning
                      key={type}
                      type="button"
                      onClick={() => setEventType(type)}
                      aria-pressed={eventType === type}
                      className={clsx(
                        "rounded-full border px-3 py-2 text-[12px] font-semibold leading-none transition-all",
                        eventType === type
                          ? "border-[#C51D30] bg-[#C51D30] text-white shadow-xs shadow-[#C51D30]/25"
                          : "border-[#E6DED7] bg-white text-[#4A4144] hover:border-[#C51D30]/40 hover:text-[#C51D30] dark:border-white/10 dark:bg-zinc-950 dark:text-slate-300 dark:hover:border-[#C51D30]/40",
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and time */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="event-date" className={FIELD_LABEL}>
                    Date
                  </label>
                  <input
                    suppressHydrationWarning
                    id="event-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={FIELD}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="event-time" className={FIELD_LABEL}>
                    Time
                  </label>
                  <input
                    suppressHydrationWarning
                    id="event-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className={FIELD}
                    required
                  />
                </div>
              </div>

              {/* Additional information */}
              <div>
                <label htmlFor="event-message" className={FIELD_LABEL}>
                  Anything we should know? (optional)
                </label>
                <textarea
                  id="event-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Expected guests, setup, equipment..."
                  className={clsx(FIELD, "min-h-[108px] resize-y leading-relaxed")}
                />
              </div>

              {/* Event image attachment */}
              <div>
                <label htmlFor="event-image" className={FIELD_LABEL}>
                  Poster or reference image (optional)
                </label>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Add an image"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    pickImage(e.dataTransfer.files?.[0]);
                  }}
                  className={clsx(
                    "relative cursor-pointer overflow-hidden rounded-2xl border border-dashed outline-hidden transition-colors focus-visible:ring-4 focus-visible:ring-[#C51D30]/15",
                    isDragging
                      ? "border-[#C51D30] bg-[#F8E9E4]"
                      : "border-[#DDD2C6] bg-[#F4EEE6] hover:border-[#C51D30]/50 dark:border-white/15 dark:bg-zinc-950",
                  )}
                >
                  {previewUrl ? (
                    <>
                      <img
                        src={previewUrl}
                        alt="Selected event reference"
                        className="h-48 w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-linear-to-t from-black/65 to-transparent px-4 pb-3 pt-8 text-white">
                        <span className="min-w-0 truncate text-xs font-medium">
                          {imageFile?.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
                          Change
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearImage();
                        }}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="flex h-44 flex-col items-center justify-center gap-2 sm:h-56 lg:h-60">
                      <ImagePlus
                        size={22}
                        strokeWidth={1.6}
                        className="text-[#8B7F76] dark:text-slate-400"
                        aria-hidden
                      />
                      <span className="text-sm font-medium text-[#6F6468] dark:text-slate-300">
                        Add an image
                      </span>
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    id="event-image"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => pickImage(e.target.files?.[0])}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#C51D30] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#C51D30]/25 transition-all hover:bg-[#A8172A] hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:py-4"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send inquiry</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};
