"use client";

import React, { useEffect, useState } from "react";
import {
  Presentation,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Filter,
  Calendar,
  Plus,
  Tag,
  ExternalLink,
  Trash2,
  Upload,
  Cloud,
  X,
  AlertTriangle,
  RefreshCw,
  Megaphone,
  Eye,
  BarChart3,
  Edit2,
} from "lucide-react";
import {
  createMallAd,
  getPendingPromos,
  updatePromoStatus,
  deleteMallAd,
  updateMallAd,
  getAllMallAds,
  getLivePromosAction,
} from "@/app/actions/ads";
import { formatPHDate, phDayEnd, phDayStart, toPHDateInput } from "@/lib/ph-date";
import { ChatConfirmModal } from "@/components/chat/chat-ui";
import { useAuth } from "@/app/providers";
import clsx from "clsx";

const PRIORITY_CONFIG = {
  HIGH: {
    bg: "bg-red-500/10",
    text: "text-red-600",
    border: "border-red-500/20",
    dot: "bg-red-500",
  },
  MEDIUM: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  LOW: {
    bg: "bg-slate-400/10",
    text: "text-slate-500",
    border: "border-slate-400/20",
    dot: "bg-slate-400",
  },
};

type AdStatus = "DEFAULT" | "LIVE" | "SCHEDULED" | "EXPIRED";

/** Where a banner stands right now (drives the badges and the counts). */
function adStatus(ad: any): AdStatus {
  if (ad.isDefault) return "DEFAULT";
  const now = Date.now();
  if (new Date(ad.endDate).getTime() < now) return "EXPIRED";
  if (new Date(ad.startDate).getTime() > now) return "SCHEDULED";
  return "LIVE";
}

const STATUS_UI: Record<AdStatus, { label: string; badge: string; pill: string }> = {
  DEFAULT: {
    label: "Default · always shown",
    badge: "bg-emerald-600/90 text-white",
    pill: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/30",
  },
  LIVE: {
    label: "Live now",
    badge: "bg-emerald-500/90 text-white",
    pill: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/30",
  },
  SCHEDULED: {
    label: "Scheduled",
    badge: "bg-blue-500/90 text-white",
    pill: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/30",
  },
  EXPIRED: {
    label: "Expired",
    badge: "bg-zinc-600/90 text-white",
    pill: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:border-white/10",
  },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  imageUrl: "",
  linkUrl: "/public-view",
  priority: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
  startDate: "",
  endDate: "",
  isCloudStored: false,
  storageKey: "",
};

export default function AdScheduler() {
  const { user } = useAuth();
  const [mallAds, setMallAds] = useState<any[]>([]);
  const [pendingPromos, setPendingPromos] = useState<any[]>([]);
  const [livePromos, setLivePromos] = useState<any[]>([]);
  const [promoTab, setPromoTab] = useState<"pending" | "live">("pending");
  /** Reject a pending promo or take down a live one (with an optional reason). */
  const [promoAction, setPromoAction] = useState<{ promo: any; kind: "reject" | "takedown" } | null>(null);
  const [promoReason, setPromoReason] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [deleteAdTarget, setDeleteAdTarget] = useState<any>(null);
  const [deletingAd, setDeletingAd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [globalAds, approvals, live] = await Promise.all([
        getAllMallAds(),
        getPendingPromos(),
        getLivePromosAction(),
      ]);
      setMallAds(globalAds);
      setPendingPromos(approvals);
      setLivePromos(live);
    } catch (error) {
      showToast("Failed to fetch ad data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast(
        `File must be under 50MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        "error",
      );
      return;
    }
    setUploading(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const result = await getCloudStorageProvider().uploadFile(file, "ads");
      setFormData((prev) => ({
        ...prev,
        imageUrl: result.url,
        isCloudStored: true,
        storageKey: result.key,
      }));
      showToast("Media uploaded to cloud storage!", "success");
    } catch (error: any) {
      showToast(error.message || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateMallAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return showToast("Authentication required", "error");
    if (!formData.imageUrl)
      return showToast("Please upload media or enter a URL", "error");

    setPublishing(true);
    try {
      if (!formData.startDate || !formData.endDate) {
        showToast("Please select a valid date range", "error");
        setPublishing(false);
        return;
      }
      if (formData.endDate < formData.startDate) {
        showToast("The end date must be on or after the start date", "error");
        setPublishing(false);
        return;
      }

      const res = await createMallAd({
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl || "/public-view",
        priority: formData.priority,
        startDate: phDayStart(formData.startDate),
        endDate: phDayEnd(formData.endDate),
        adminId: user.id,
        storageKey: formData.storageKey || null,
      });

      if (res.success) {
        showToast("Global Ad Deployed Successfully!", "success");
        setIsModalOpen(false);
        setFormData(EMPTY_FORM);
        await fetchData();
      } else {
        showToast(
          "Deployment Failed: " + (res.error || "Internal error occurred"),
          "error",
        );
      }
    } catch (error: any) {
      showToast("Critical Error: " + error.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleEditAd = (ad: any) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || "",
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || "/public-view",
      priority: ad.priority,
      startDate: toPHDateInput(ad.startDate),
      endDate: toPHDateInput(ad.endDate),
      isCloudStored: !!ad.storageKey,
      storageKey: ad.storageKey || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    setPublishing(true);
    try {
      if (!formData.startDate || !formData.endDate) {
        showToast("Please select valid campaign dates", "error");
        setPublishing(false);
        return;
      }

      const isDefaultAd = !!editingAd.isDefault;
      if (!isDefaultAd && formData.endDate < formData.startDate) {
        showToast("The end date must be on or after the start date", "error");
        setPublishing(false);
        return;
      }
      const res = await updateMallAd(editingAd.id, {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl || "/public-view",
        priority: formData.priority,
        startDate: phDayStart(formData.startDate),
        endDate: isDefaultAd ? new Date("2099-12-31T23:59:59.000Z") : phDayEnd(formData.endDate),
        storageKey: formData.storageKey || null,
      });

      if (res.success) {
        showToast("Campaign Updated Successfully!", "success");
        setIsEditModalOpen(false);
        setEditingAd(null);
        setFormData(EMPTY_FORM);
        await fetchData();
      } else {
        showToast(
          "Update Failed: " + (res.error || "Internal error occurred"),
          "error",
        );
      }
    } catch (error: any) {
      showToast("Critical Error: " + error.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const confirmDeleteAd = async () => {
    if (!deleteAdTarget) return;
    setDeletingAd(true);
    try {
      const res = await deleteMallAd(deleteAdTarget.id);
      if (res.success) {
        showToast("Banner deleted", "success");
        fetchData();
      } else {
        showToast(res.error || "Couldn't delete the banner", "error");
      }
    } catch (error: any) {
      showToast("Error: " + error.message, "error");
    } finally {
      setDeletingAd(false);
      setDeleteAdTarget(null);
    }
  };

  const approvePromo = async (promo: any) => {
    const res = await updatePromoStatus(promo.id, "APPROVED");
    if (res.success) {
      showToast(
        new Date(promo.startDate).getTime() > Date.now() ? "Promo approved — it goes live on its start date" : "Promo approved & live!",
        "success",
      );
      fetchData();
    } else {
      showToast(res.error || "Couldn't approve the promo", "error");
    }
  };

  const confirmPromoAction = async () => {
    if (!promoAction) return;
    setPromoBusy(true);
    const res = await updatePromoStatus(promoAction.promo.id, "REJECTED", promoReason);
    setPromoBusy(false);
    if (res.success) {
      showToast(promoAction.kind === "takedown" ? "Promo taken down" : "Promo rejected", "success");
      setPromoAction(null);
      setPromoReason("");
      fetchData();
    } else {
      showToast(res.error || "Couldn't update the promo", "error");
    }
  };

  // ─── Shared Form Fields ───
  const renderFormFields = (
    onSubmit: (e: React.FormEvent) => void,
    isEdit = false,
  ) => (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Campaign Title *
          </label>
          <input
            required
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm"
            placeholder="e.g. Grand Holiday Sale..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Priority
          </label>
          <select
            required
            value={formData.priority}
            onChange={(e) =>
              setFormData({
                ...formData,
                priority: e.target.value as "HIGH" | "MEDIUM" | "LOW",
              })
            }
            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm"
          >
            <option value="HIGH">🔴 High — Showcase</option>
            <option value="MEDIUM">🟡 Medium — Standard</option>
            <option value="LOW">⚪ Low — Filler</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
          Description
        </label>
        <input
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm"
          placeholder="Short tagline for this campaign..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
          {formData.isCloudStored ? (
            <>
              <Cloud className="text-emerald-500" size={13} /> Cloud Stored
            </>
          ) : (
            "Media Asset URL *"
          )}
        </label>
        <div className="flex gap-2">
          <input
            required={!formData.isCloudStored}
            value={formData.imageUrl}
            onChange={(e) =>
              setFormData({ ...formData, imageUrl: e.target.value })
            }
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm disabled:opacity-60"
            placeholder={
              formData.isCloudStored
                ? "Stored in cloud — upload to replace"
                : "https://..."
            }
            disabled={formData.isCloudStored}
          />
          {!formData.isCloudStored && (
            <label className="flex items-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-xl cursor-pointer hover:bg-primary/20 transition-all shrink-0">
              {uploading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={15} />
                  <span className="text-xs font-bold hidden sm:inline">
                    Upload
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
          {formData.isCloudStored && (
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  imageUrl: "",
                  isCloudStored: false,
                  storageKey: "",
                }))
              }
              className="px-3 py-3 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-200 dark:border-red-900/30"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {formData.imageUrl && !formData.imageUrl.includes("http") === false && (
          <div className="mt-2 rounded-xl overflow-hidden h-24 border border-slate-200 dark:border-white/5">
            <img
              src={formData.imageUrl}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
          Click-Through URL
        </label>
        <input
          value={formData.linkUrl}
          onChange={(e) =>
            setFormData({ ...formData, linkUrl: e.target.value })
          }
          className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm"
          placeholder="/public-view"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Start Date *
          </label>
          <input
            required
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            End Date *
          </label>
          <input
            required
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none transition-all text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setIsModalOpen(false);
            setIsEditModalOpen(false);
            setFormData(EMPTY_FORM);
          }}
          className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={publishing}
          className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all"
        >
          {publishing
            ? isEdit
              ? "Updating..."
              : "Publishing..."
            : isEdit
              ? "Update Ad"
              : "Deploy Global Ad"}
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={clsx(
            "fixed top-24 right-8 z-[300] flex items-center gap-3 px-5 py-4 font-bold text-sm rounded-2xl shadow-2xl animate-fade-in-up",
            toast.type === "success"
              ? "bg-emerald-500 text-white shadow-emerald-500/30"
              : "bg-red-500 text-white shadow-red-500/30",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          {toast.msg}
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="min-h-screen bg-transparent p-4 lg:p-8 animate-fade-in-up max-w-[1600px] mx-auto space-y-8">
        {/* ─── HEADER ─── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-primary mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Megaphone size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">
                Advertisement Control v2.0
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-charcoal dark:text-white tracking-tight leading-none italic uppercase">
              Ad <span className="text-primary">Module</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg max-w-2xl leading-relaxed">
              Deploy mall-wide hero banners and approve tenant promotional
              submissions.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all"
            >
              <RefreshCw size={18} /> Refresh
            </button>
            <button
              onClick={() => {
                setFormData(EMPTY_FORM);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-3 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl transition-all shadow-xl shadow-primary/30 active:scale-95 whitespace-nowrap uppercase tracking-widest text-xs"
            >
              <Plus size={18} /> Create Mall-Wide Ad
            </button>
          </div>
        </div>

        {/* ─── STATS BAR ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Live Banners",
              value: mallAds.filter((a) => ["DEFAULT", "LIVE"].includes(adStatus(a))).length,
              icon: <Eye size={18} />,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "Scheduled",
              value: mallAds.filter((a) => adStatus(a) === "SCHEDULED").length,
              icon: <Calendar size={18} />,
              color: "text-blue-600",
              bg: "bg-blue-500/10",
            },
            {
              label: "Awaiting Review",
              value: pendingPromos.length,
              icon: <Clock size={18} />,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
            },
            {
              label: "Live Tenant Promos",
              value: livePromos.filter((p) => new Date(p.startDate).getTime() <= Date.now()).length,
              icon: <BarChart3 size={18} />,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {stat.label}
                </span>
                <div
                  className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    stat.bg,
                    stat.color,
                  )}
                >
                  {stat.icon}
                </div>
              </div>
              <p className="text-3xl font-black text-charcoal dark:text-white">
                {loading ? (
                  <span className="animate-pulse text-slate-200 dark:text-zinc-700">
                    —
                  </span>
                ) : (
                  stat.value
                )}
              </p>
            </div>
          ))}
        </div>

        {/* ─── GLOBAL HERO ADS ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center gap-3">
            <Presentation size={18} className="text-primary" />
            <div>
              <h2 className="font-black text-charcoal dark:text-white text-lg">
                Mall Banner Carousel
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Banners displayed on the homepage carousel
              </p>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-3xl overflow-hidden border border-slate-100 dark:border-white/5 animate-pulse"
                  >
                    <div className="aspect-[16/9] bg-slate-100 dark:bg-zinc-800" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 w-3/4 bg-slate-100 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-1/2 bg-slate-100 dark:bg-zinc-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : mallAds.length === 0 ? (
              <div className="py-20 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl text-center">
                <Megaphone
                  size={40}
                  className="mx-auto text-slate-300 dark:text-zinc-700 mb-4"
                />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4">
                  No Active Mall-Wide Ads
                </p>
                <button
                  onClick={() => {
                    setFormData(EMPTY_FORM);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary-hover transition-all"
                >
                  <Plus size={14} /> Create First Ad
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {mallAds.map((ad) => {
                  const pc =
                    PRIORITY_CONFIG[
                      ad.priority as keyof typeof PRIORITY_CONFIG
                    ] || PRIORITY_CONFIG.MEDIUM;
                  const status = adStatus(ad);
                  const ui = STATUS_UI[status];
                  return (
                    <div
                      key={ad.id}
                      className={clsx(
                        "group bg-slate-50 dark:bg-zinc-950 border rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-xl",
                        ad.isDefault
                          ? "border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/10"
                          : "border-slate-200 dark:border-white/5 hover:border-primary/40 hover:shadow-primary/10",
                      )}
                    >
                      <div className="aspect-[16/9] w-full bg-slate-200 dark:bg-zinc-800 overflow-hidden relative">
                        {ad.imageUrl?.match(/\.(mp4|webm|mov|ogg)$/i) ||
                        ad.imageUrl?.includes("/video/upload/") ? (
                          <video
                            src={ad.imageUrl}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            autoPlay
                            muted
                            loop
                          />
                        ) : (
                          <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        )}
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {/* Priority Badge */}
                        <div
                          className={clsx(
                            "absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md bg-black/40 text-white border-white/20",
                          )}
                        >
                          <span
                            className={clsx("w-1.5 h-1.5 rounded-full", pc.dot)}
                          />
                          {ad.priority}
                        </div>
                        {/* Status Badges */}
                        <div className={clsx("absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest shadow-md", ui.badge)}>
                          {status === "DEFAULT" && <ShieldCheck size={11} />}
                          {status === "DEFAULT" ? "Default" : ui.label}
                        </div>
                        {/* Action Buttons */}
                        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditAd(ad)}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-lg"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!ad.isDefault && (
                            <button
                              onClick={() => setDeleteAdTarget(ad)}
                              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-lg"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-charcoal dark:text-white text-base truncate">
                            {ad.title}
                          </h4>
                          {ad.isDefault && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20 shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mb-4 line-clamp-1">
                          {ad.description ||
                            "Global announcement for all mall visitors."}
                        </p>
                        <div className="flex items-center justify-between">
                          <span
                            className={clsx(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                              ui.pill,
                            )}
                          >
                            {ui.label}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} />{" "}
                            {status === "DEFAULT"
                              ? "Always active"
                              : status === "SCHEDULED"
                                ? `Starts ${formatPHDate(ad.startDate)}`
                                : status === "EXPIRED"
                                  ? `Ended ${formatPHDate(ad.endDate)}`
                                  : `Until ${formatPHDate(ad.endDate)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── PENDING TENANT PROMOS ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-amber-500" />
              <div>
                <h2 className="font-black text-charcoal dark:text-white text-lg">
                  Tenant Promo Pipeline
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Review & approve merchant promotion requests
                </p>
              </div>
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              {(
                [
                  { key: "pending", label: "Pending review", count: pendingPromos.length },
                  { key: "live", label: "Live & scheduled", count: livePromos.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setPromoTab(t.key)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                    promoTab === t.key ? "bg-white dark:bg-zinc-900 text-charcoal dark:text-white shadow-sm" : "text-slate-400 hover:text-charcoal dark:hover:text-white",
                  )}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={clsx("px-1.5 rounded-full", t.key === "pending" ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600")}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl border border-slate-100 dark:border-white/5 animate-pulse flex gap-4"
                  >
                    <div className="w-40 h-24 bg-slate-100 dark:bg-zinc-800 rounded-2xl shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 w-1/2 bg-slate-100 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-1/3 bg-slate-100 dark:bg-zinc-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : promoTab === "live" ? (
              livePromos.length === 0 ? (
                <div className="py-16 text-center">
                  <Megaphone size={40} className="mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                  <h4 className="font-bold text-charcoal dark:text-white mb-1">No live tenant promos</h4>
                  <p className="text-xs text-slate-400 font-medium">Approved promos show here until they end.</p>
                </div>
              ) : (
                livePromos.map((promo) => {
                  const scheduled = new Date(promo.startDate).getTime() > Date.now();
                  return (
                    <div
                      key={promo.id}
                      className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                    >
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="w-40 h-24 rounded-2xl bg-slate-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                          {promo.promoVideo ? (
                            <video src={promo.promoVideo} className="w-full h-full object-cover" autoPlay muted loop />
                          ) : (
                            <img src={promo.promoImage} alt={promo.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="space-y-2 min-w-0">
                          <h4 className="font-bold text-charcoal dark:text-white text-base truncate">{promo.title}</h4>
                          <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <Tag size={10} /> {promo.category} • {promo.tenant?.shopName || "Tenant"}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <Calendar size={10} /> {formatPHDate(promo.startDate)} — {formatPHDate(promo.endDate)}
                            </div>
                            <span
                              className={clsx(
                                "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest",
                                scheduled
                                  ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/30"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/30",
                              )}
                            >
                              {scheduled ? "Scheduled" : "Live now"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPromoReason("");
                          setPromoAction({ promo, kind: "takedown" });
                        }}
                        className="px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-transparent transition-all shrink-0 self-end md:self-auto"
                      >
                        Take down
                      </button>
                    </div>
                  );
                })
              )
            ) : pendingPromos.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle
                  size={40}
                  className="mx-auto text-emerald-400 mb-3"
                />
                <h4 className="font-bold text-charcoal dark:text-white mb-1">
                  All Caught Up!
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  No pending promotion requests from tenants.
                </p>
              </div>
            ) : (
              pendingPromos.map((promo) => {
                const ended = new Date(promo.endDate).getTime() < Date.now();
                return (
                <div
                  key={promo.id}
                  className="group bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="w-40 h-24 rounded-2xl bg-slate-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                      {promo.promoVideo ? (
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
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h4 className="font-bold text-charcoal dark:text-white text-base truncate">
                        {promo.title}
                      </h4>
                      <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                        <Tag size={10} /> {promo.category} •{" "}
                        {promo.tenant?.shopName || "Tenant"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar size={10} />{" "}
                          {formatPHDate(promo.startDate)} — {formatPHDate(promo.endDate)}
                        </div>
                        {ended ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest">
                            Ended — can&apos;t go live
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200 dark:border-amber-900/30 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                            <Clock size={10} /> Awaiting Review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                    <button
                      onClick={() => {
                        setPromoReason(ended ? "The campaign dates have already passed." : "");
                        setPromoAction({ promo, kind: "reject" });
                      }}
                      className="px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-transparent transition-all"
                    >
                      Reject
                    </button>
                    {!ended && (
                      <button
                        onClick={() => approvePromo(promo)}
                        className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-hover hover:scale-105 shadow-lg shadow-primary/20 transition-all"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {deleteAdTarget && (
        <ChatConfirmModal
          title="Delete this banner?"
          message={`"${deleteAdTarget.title}" will be removed from the homepage carousel and its media deleted. This can't be undone.`}
          confirmLabel="Delete banner"
          busy={deletingAd}
          onCancel={() => setDeleteAdTarget(null)}
          onConfirm={confirmDeleteAd}
        />
      )}

      {promoAction && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !promoBusy && setPromoAction(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 p-6 space-y-4 animate-fade-in-up">
            <div>
              <h3 className="text-lg font-black text-charcoal dark:text-white">
                {promoAction.kind === "takedown" ? "Take down this promo?" : "Reject this promo?"}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                &ldquo;{promoAction.promo.title}&rdquo; by {promoAction.promo.tenant?.shopName || "the tenant"}
                {promoAction.kind === "takedown" ? " will be removed from the site right away." : " won't be published."} The tenant is notified.
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reason (optional, sent to the tenant)</span>
              <textarea
                value={promoReason}
                onChange={(e) => setPromoReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="e.g. The image is low quality — please upload a clearer version."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-charcoal dark:text-white rounded-xl border border-slate-200 dark:border-white/5 focus:border-primary outline-none text-sm resize-none"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={promoBusy}
                onClick={() => setPromoAction(null)}
                className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={promoBusy}
                onClick={confirmPromoAction}
                className="flex-1 py-3 text-xs font-bold text-white bg-red-500 rounded-xl uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {promoBusy ? "Saving…" : promoAction.kind === "takedown" ? "Take down" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-charcoal/40 dark:bg-black/80 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 p-8 animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Plus size={18} className="text-primary" /> Create Global Mall
                Ad
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {renderFormFields(handleCreateMallAd, false)}
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-charcoal/40 dark:bg-black/80 backdrop-blur-md"
            onClick={() => {
              setIsEditModalOpen(false);
              setFormData(EMPTY_FORM);
            }}
          />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 p-8 animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Edit2 size={18} className="text-primary" /> Edit Ad Campaign
              </h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setFormData(EMPTY_FORM);
                }}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {editingAd?.isDefault && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Default Mall Banner:</strong> This banner is permanent and will always stay active in the Mall Banner Carousel. You can freely customize its title, text, priority, and media.
                </span>
              </div>
            )}
            {renderFormFields(handleUpdateAd, true)}
          </div>
        </div>
      )}
    </>
  );
}
