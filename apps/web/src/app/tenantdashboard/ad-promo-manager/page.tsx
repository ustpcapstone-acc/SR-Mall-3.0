"use client";

import React, { useState, useEffect } from "react";
import {
  Presentation,
  UploadCloud,
  Calendar,
  Clock,
  CheckCircle,
  ShieldAlert,
  Loader2,
  Tag,
  Trash2,
  Plus,
  X,
  Megaphone,
  TrendingUp,
  Eye,
  BarChart3,
  ImageIcon,
  Video,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import {
  createTenantPromo,
  getPromosByTenant,
  deletePromo,
  getTenantByUserId,
} from "@/app/actions/ads";
import { getCloudStorageProvider } from "@/lib/cloud-storage";
import clsx from "clsx";

const CATEGORIES = [
  "Fashion",
  "Electronics",
  "Food & Dining",
  "Health & Beauty",
  "School Supplies",
  "Play Area",
  "Services",
  "Home & Lifestyle",
  "Entertainment",
  "Mall Events",
  "Others",
];

function Toast({
  toast,
  onClose,
}: {
  toast: { msg: string; type: "success" | "error" } | null;
  onClose: () => void;
}) {
  if (!toast) return null;
  return (
    <div
      className={`fixed top-6 right-4 sm:right-8 z-[300] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-xs font-bold animate-fade-in-up max-w-xs ${toast.type === "success" ? "bg-emerald-500 shadow-emerald-500/30" : "bg-red-500 shadow-red-500/30"}`}
    >
      {toast.type === "success" ? (
        <CheckCircle size={14} />
      ) : (
        <ShieldAlert size={14} />
      )}
      <span className="flex-1">{toast.msg}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-1">
        <X size={13} />
      </button>
    </div>
  );
}

export default function AdPromoManager() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fashion");
  const today = new Date().toISOString().split("T")[0];
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(futureDate);
  const [promoImage, setPromoImage] = useState("");
  const [promoVideo, setPromoVideo] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [storageKey, setStorageKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (user?.id) {
      fetchPromos();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchPromos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const tenant = await getTenantByUserId(user.id);
      if (tenant) {
        setPromos(await getPromosByTenant(tenant.id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(
        `File must be under 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        "error",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await getCloudStorageProvider().uploadFile(
        file,
        "tenant-promos",
      );
      const type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      setMediaType(type);
      if (type === "VIDEO") {
        setPromoVideo(result.url);
        setPromoImage("");
      } else {
        setPromoImage(result.url);
        setPromoVideo("");
      }
      setStorageKey(result.key);
      showToast("Media uploaded successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !user?.id ||
      !title ||
      !startDate ||
      !endDate ||
      (!promoImage && !promoVideo)
    )
      return;
    setIsSubmitting(true);
    try {
      const tenant = await getTenantByUserId(user.id);
      if (!tenant) {
        showToast("No tenant profile found. Contact admin.", "error");
        return;
      }
      await createTenantPromo({
        tenantId: tenant.id,
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        promoImage: mediaType === "IMAGE" ? promoImage : undefined,
        promoVideo: mediaType === "VIDEO" ? promoVideo : undefined,
        mediaType,
        storageKey,
      });
      setTitle("");
      setDescription("");
      setCategory("Fashion");
      setStartDate(today);
      setEndDate(futureDate);
      setPromoImage("");
      setPromoVideo("");
      setStorageKey("");
      fetchPromos();
      showToast("Promotion submitted! Awaiting admin review.", "success");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Delete this promotion? The uploaded media will also be removed.",
      )
    )
      return;
    await deletePromo(id);
    fetchPromos();
    showToast("Promotion deleted.", "success");
  };

  // Stats
  const live = promos.filter((p) => p.status === "APPROVED").length;
  const pending = promos.filter((p) => p.status === "PENDING").length;
  const rejected = promos.filter((p) => p.status === "REJECTED").length;

  const hasMedia = !!(promoImage || promoVideo);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-24 lg:pb-0">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10 space-y-6">
        {/* ── Header ── */}
        <div>
          <p className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-[0.3em] mb-1">
            Marketing
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white tracking-tight leading-none">
            Ad &amp; Promo Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
            Submit promotional banners for display across SR Mall.
          </p>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: "Total Campaigns",
              value: promos.length,
              icon: BarChart3,
              iconBg: "bg-slate-100 dark:bg-zinc-800 text-slate-500",
            },
            {
              label: "Live Now",
              value: live,
              icon: Megaphone,
              iconBg: "bg-emerald-500/10 text-emerald-500",
            },
            {
              label: "Pending Review",
              value: pending,
              icon: Clock,
              iconBg: "bg-amber-500/10 text-amber-500",
            },
            {
              label: "Rejected",
              value: rejected,
              icon: ShieldAlert,
              iconBg: "bg-red-500/10 text-primary",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex items-center gap-3"
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}
              >
                <s.icon size={16} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-charcoal dark:text-white leading-none">
                  {loading ? "—" : s.value}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Grid: Form + History ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Submit Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden h-fit"
          >
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Plus size={16} />
              </div>
              <div>
                <h2 className="font-black text-sm text-charcoal dark:text-white">
                  New Promo Request
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  Submit for admin approval
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Promo Title *
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="e.g. 50% Off Flash Sale"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your promotion..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                    <Calendar size={10} /> Start
                  </label>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                    <Calendar size={10} /> End
                  </label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Media Upload */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Banner Media *
                </label>
                <div className="relative border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden min-h-[140px] group hover:border-primary transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  {hasMedia ? (
                    <div className="relative w-full h-full min-h-[140px]">
                      {mediaType === "VIDEO" ? (
                        <video
                          src={promoVideo}
                          className="absolute inset-0 w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                        />
                      ) : (
                        <img
                          src={promoImage}
                          alt="Preview"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-center text-white">
                          <UploadCloud size={22} className="mx-auto mb-1" />
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            Change Media
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                        {mediaType === "VIDEO" ? (
                          <Video size={10} />
                        ) : (
                          <ImageIcon size={10} />
                        )}{" "}
                        {mediaType}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary mb-2 transition-colors">
                        <UploadCloud size={20} />
                      </div>
                      <p className="text-xs font-bold text-charcoal dark:text-white">
                        Click to upload
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Image or Video · Max 50MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !hasMedia || !title}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Megaphone size={15} />
                )}
                {isSubmitting ? "Submitting..." : "Submit Promotion"}
              </button>

              <p className="text-[9px] text-slate-400 font-medium text-center leading-relaxed">
                Your promotion will go live after admin approval. Usually
                reviewed within 24 hours.
              </p>
            </div>
          </form>

          {/* Campaign History */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm text-charcoal dark:text-white">
                Campaign History
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {promos.length} total
              </span>
            </div>

            {loading ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl p-12 text-center">
                <Loader2
                  className="mx-auto text-primary animate-spin mb-3"
                  size={28}
                />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Loading campaigns...
                </p>
              </div>
            ) : promos.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl p-14 text-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Presentation className="text-slate-300" size={28} />
                </div>
                <p className="font-black text-charcoal dark:text-white text-sm">
                  No promotions yet
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1 max-w-xs mx-auto">
                  Submit your first promotional banner using the form. It will
                  appear here after submission.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {promos.map((promo) => {
                  const isExpired = new Date(promo.endDate) < new Date();
                  return (
                    <div
                      key={promo.id}
                      className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex gap-4 p-4 sm:p-5">
                        {/* Thumbnail */}
                        <div className="w-20 h-16 sm:w-28 sm:h-20 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                          {promo.mediaType === "VIDEO" ? (
                            <video
                              src={promo.promoVideo}
                              className="w-full h-full object-cover"
                              autoPlay
                              muted
                              loop
                            />
                          ) : (
                            <img
                              src={promo.promoImage}
                              alt={promo.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <h4 className="font-black text-sm text-charcoal dark:text-white truncate">
                                {promo.title}
                              </h4>
                              {promo.description && (
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                                  {promo.description}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-zinc-800 px-2 py-1 rounded-lg uppercase tracking-wide">
                              {promo.category}
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                            <Calendar size={9} />
                            {new Date(promo.startDate).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}{" "}
                            —{" "}
                            {new Date(promo.endDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                            {isExpired && (
                              <span className="ml-1 text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">
                                Expired
                              </span>
                            )}
                          </p>

                          {/* Status + Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            {promo.status === "APPROVED" && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800/30 text-[9px] font-black uppercase tracking-widest">
                                <CheckCircle size={10} /> Live
                              </span>
                            )}
                            {promo.status === "PENDING" && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/30 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                <Clock size={10} /> Under Review
                              </span>
                            )}
                            {promo.status === "REJECTED" && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-900/20 text-primary border border-red-100 dark:border-red-800/30 text-[9px] font-black uppercase tracking-widest">
                                <ShieldAlert size={10} /> Rejected
                              </span>
                            )}
                            <div className="flex-1" />
                            <button
                              onClick={() => handleDelete(promo.id)}
                              className="p-2 text-slate-300 hover:text-primary hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title="Delete promotion"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
