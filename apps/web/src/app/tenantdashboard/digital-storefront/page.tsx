"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Store,
  Camera,
  Save,
  Phone,
  MapPin,
  CheckCircle,
  UploadCloud,
  Trash2,
  Loader2,
  ShoppingBag,
  Eye,
  X,
  Plus,
  Tag,
  ImageIcon,
} from "lucide-react";
import { DigitalStorefront, StoreProduct } from "@/types/storefront";
import {
  updateStorefrontAction,
  getStorefrontAction,
} from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { ShopCard } from "@/components/shop-card";

const PLACEHOLDERS = [
  "/images/logo/gudget.jpg",
  "/images/logo/gudget2.jpg",
  "/images/logo/gudget3.webp",
  "/images/logo/logoshop.jpg",
];

const STORE_CATEGORIES = [
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

const getSafeUrl = (url: string | null | undefined, index: number) => {
  if (!url || url.startsWith("blob:") || url.includes("placeholder")) {
    if (index === 0) return "/images/logo/logoshop.jpg";
    return PLACEHOLDERS[(index - 1) % PLACEHOLDERS.length];
  }
  return url;
};

const getGalleryUrls = (galleryUrls: string[] | null | undefined): string[] =>
  Array.isArray(galleryUrls) ? galleryUrls : [];

export default function DigitalStorefrontPage() {
  const { user, isAuthenticated, login } = useAuth();

  const [profile, setProfile] = useState<Partial<DigitalStorefront>>({
    shop_name: "",
    unit_id: "",
    is_open: true,
    description: "",
    logo_url: null,
    gallery_urls: [],
    products: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "identity" | "gallery" | "catalog" | "postsales"
  >("identity");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      login(
        "00000000-0000-0000-0000-000000000001",
        "Demo Tenant",
        "tenant@mock.com",
      );
    }
  }, [isAuthenticated, login]);

  useEffect(() => {
    async function loadData() {
      if (user?.id) {
        const res = await getStorefrontAction(user.id);
        if (res.success && res.data) setProfile(res.data);
        setLoading(false);
      }
    }
    if (isAuthenticated) loadData();
  }, [user?.id, isAuthenticated]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (uploading) {
      showToast("Please wait for the image to finish uploading.", "error");
      return;
    }
    setSaving(true);
    const res = await updateStorefrontAction(user.id, profile);
    if (res.success && res.data) {
      setProfile(res.data);
      showToast(
        "Storefront synced! Changes are now live on the public directory.",
        "success",
      );
    } else {
      showToast("Sync failed: " + (res.error || "Unknown error"), "error");
    }
    setSaving(false);
  };

  const uploadFileToServer = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "storefront");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      return data.url;
    } catch (err: any) {
      showToast("Image upload failed: " + err.message, "error");
      return null;
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "gallery_urls",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFileToServer(file);
      if (url) urls.push(url);
    }
    setUploading(false);
    if (urls.length === 0) return;
    if (field === "logo_url") {
      updateField("logo_url", urls[0]);
    } else {
      setProfile((prev) => ({
        ...prev,
        gallery_urls: [...(prev.gallery_urls || []), ...urls],
      }));
    }
  };

  const updateField = (field: keyof DigitalStorefront, value: any) =>
    setProfile((prev) => ({ ...prev, [field]: value }));

  const addProduct = () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 11);
    const p: StoreProduct = {
      id,
      name: "",
      description: "",
      price: "",
      image_url: "",
    };
    setProfile((prev) => ({
      ...prev,
      products: [...(prev.products || []), p],
    }));
  };

  const updateProduct = (
    i: number,
    field: keyof StoreProduct,
    value: string,
  ) => {
    setProfile((prev) => {
      const updated = [...(prev.products || [])];
      if (updated[i]) {
        updated[i] = { ...updated[i], [field]: value };
      }
      return { ...prev, products: updated };
    });
  };

  const removeProduct = (i: number) => {
    setProfile((prev) => {
      const updated = [...(prev.products || [])];
      updated.splice(i, 1);
      return { ...prev, products: updated };
    });
  };

  const handleProductImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFileToServer(file);
    setUploading(false);
    if (url) updateProduct(index, "image_url", url);
  };

  const addPostSale = () => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const p = { id, title: "", image_url: "", date: new Date().toISOString() };
    setProfile(prev => ({ ...prev, post_sales: [...(prev.post_sales || []), p] }));
  };

  const updatePostSale = (i: number, field: string, value: string) => {
    setProfile(prev => {
      const updated = [...(prev.post_sales || [])];
      if (updated[i]) { updated[i] = { ...updated[i], [field]: value }; }
      return { ...prev, post_sales: updated };
    });
  };

  const removePostSale = (i: number) => {
    setProfile(prev => {
      const updated = [...(prev.post_sales || [])];
      updated.splice(i, 1);
      return { ...prev, post_sales: updated };
    });
  };

  const handlePostSaleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFileToServer(file);
    setUploading(false);
    if (url) updatePostSale(index, "image_url", url);
  };

  const galleryUrls = getGalleryUrls(profile.gallery_urls);
  const previewShop: DigitalStorefront = {
    id: "preview",
    shop_name: profile.shop_name || "Your Shop Name",
    unit_id: profile.unit_id || "L1-XXX",
    is_open: profile.is_open ?? true,
    description: profile.description || "Your brand bio goes here.",
    logo_url: getSafeUrl(profile.logo_url, 0),
    gallery_urls: galleryUrls.length
      ? galleryUrls.map((u, i) => getSafeUrl(u, i + 1))
      : PLACEHOLDERS,
  };

  const TABS = [
    { id: "identity", label: "Brand Identity", icon: Store },
    { id: "gallery", label: "Gallery", icon: ImageIcon },
    { id: "catalog", label: "Products", icon: ShoppingBag },
    { id: "postsales", label: "Post Sales", icon: Tag },
  ] as const;

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Loading storefront...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-24 lg:pb-0">
      {/* Hidden file inputs */}
      <input
        type="file"
        hidden
        ref={logoInputRef}
        accept="image/*"
        onChange={(e) => handleImageUpload(e, "logo_url")}
      />
      <input
        type="file"
        hidden
        multiple
        ref={galleryInputRef}
        accept="image/*"
        onChange={(e) => handleImageUpload(e, "gallery_urls")}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-4 sm:right-8 z-[300] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-xs font-bold animate-fade-in-up ${toast.type === "success" ? "bg-emerald-500 shadow-emerald-500/30" : "bg-red-500 shadow-red-500/30"}`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={15} />
          ) : (
            <X size={15} />
          )}
          {toast.msg}
          <button
            onClick={() => setToast(null)}
            className="ml-1 opacity-70 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Mobile Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 lg:hidden">
          <div className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-charcoal dark:text-white uppercase tracking-widest">
                  Live Preview
                </span>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-charcoal rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              <ShopCard shop={previewShop} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10 space-y-6">
        {/* ── Page Header ── */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-[0.3em] mb-1">
              Store Management
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal dark:text-white tracking-tight leading-none">
              Digital Storefront
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
              Manage your brand identity, gallery, and products.
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile: Preview button */}
            <button
              onClick={() => setPreviewOpen(true)}
              className="lg:hidden flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 shadow-sm"
            >
              <Eye size={14} /> Preview
            </button>

            {/* Status Toggle */}
            <button
              onClick={() => updateField("is_open", !profile.is_open)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border font-black text-xs transition-all ${profile.is_open ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-600" : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-500"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${profile.is_open ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-slate-400"}`}
              />
              <span className="hidden sm:inline">
                {profile.is_open ? "Open" : "Closed"}
              </span>
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60"
            >
              {uploading ? (
                <><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Uploading...</span><span className="sm:hidden">...</span></>
              ) : saving ? (
                <><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Saving...</span><span className="sm:hidden">Saving</span></>
              ) : (
                <><Save size={14} /><span className="hidden sm:inline">Save & Sync</span><span className="sm:hidden">Save</span></>
              )}
            </button>
          </div>
        </div>

        {/* ── Editor + Preview Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Editor */}
          <div className="lg:col-span-8 space-y-4">
            {/* Tab Bar — icon-only on mobile, labeled on sm+ */}
            <div className="flex items-center gap-1 p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex-1 min-w-[44px] flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-slate-500 hover:text-charcoal dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <tab.icon size={15} className="shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: Brand Identity ── */}
            {activeTab === "identity" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden animate-fade-in">
                {/* Logo + Name section — stacks vertically on mobile */}
                <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-5 border-b border-slate-100 dark:border-white/5">
                  {/* Logo Upload — centered on mobile */}
                  <div className="flex items-center gap-4">
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="relative group shrink-0 cursor-pointer"
                    >
                      <div
                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-dashed border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-primary ${profile.logo_url ? "border-solid" : ""}`}
                      >
                        {profile.logo_url ? (
                          <img
                            src={getSafeUrl(profile.logo_url, 0)}
                            className="w-full h-full object-cover group-hover:opacity-70 transition-opacity"
                            alt="Logo"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <Camera size={20} className="mx-auto mb-1 text-slate-400 group-hover:text-primary transition-colors" />
                            <p className="text-[9px] font-black text-slate-400 uppercase leading-snug">Logo</p>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/20 rounded-2xl pointer-events-none">
                        <UploadCloud size={18} className="text-primary" />
                      </div>
                      <span className="absolute -bottom-2 -right-2 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                        {profile.logo_url ? "Change" : "Upload"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                        Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rizal Fashion Hub"
                        value={profile.shop_name || ""}
                        onChange={(e) => updateField("shop_name", e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Description — full width below */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Brand Bio / Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe your store to customers..."
                      value={profile.description || ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Unit + Contact + Category */}
                <div className="p-4 sm:p-6 lg:p-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                        <MapPin size={11} /> Unit / Location
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. L1-105"
                          value={profile.unit_id || ""}
                          onChange={(e) => updateField("unit_id", e.target.value)}
                          className="w-full px-4 py-3 pr-16 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-black text-charcoal dark:text-white uppercase tracking-widest placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                          SYNCED
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                        <Phone size={11} /> Contact Number
                      </label>
                      <input
                        type="text"
                        placeholder="+63 9XX XXX XXXX"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-charcoal dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Store Category */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <Tag size={11} /> Store Category
                    </label>
                    <select
                      value={profile.category || "Fashion"}
                      onChange={(e) => updateField("category", e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                    >
                      {STORE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                      This helps customers find your store in the mall directory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Gallery ── */}
            {activeTab === "gallery" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm p-5 sm:p-6 lg:p-8 animate-fade-in space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-charcoal dark:text-white text-sm">
                      Store Gallery
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Upload photos of your store space and products
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-slate-400">
                    {profile.gallery_urls?.length || 0} / 10
                  </span>
                </div>

                {/* Upload Zone */}
                <div
                  onClick={() => galleryInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 sm:p-10 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 bg-white dark:bg-zinc-800 shadow-md rounded-2xl flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud size={22} />
                  </div>
                  <p className="text-sm font-black text-charcoal dark:text-white">
                    Click to upload photos
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Supports JPG, PNG, WEBP · Max 10 images
                  </p>
                </div>

                {/* Gallery Grid */}
                {(profile.gallery_urls || []).length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {(profile.gallery_urls || []).map(
                      (url: string, i: number) => (
                        <div
                          key={i}
                          className="group/img relative aspect-square bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-hidden"
                        >
                          <img
                            src={getSafeUrl(url, i + 1)}
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500"
                            alt="Gallery"
                          />
                          <button
                            onClick={() => {
                              const newGallery = (
                                profile.gallery_urls || []
                              ).filter((_: string, idx: number) => idx !== i);
                              updateField("gallery_urls", newGallery);
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-lg"
                          >
                            <Trash2 size={11} />
                          </button>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                      ),
                    )}
                    {/* Empty slots */}
                    {Array.from({
                      length: Math.max(
                        0,
                        3 - (profile.gallery_urls?.length || 0),
                      ),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="aspect-square bg-slate-50 dark:bg-zinc-900 rounded-xl border border-dashed border-slate-200 dark:border-white/5"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Product Catalog ── */}
            {activeTab === "catalog" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm p-5 sm:p-6 lg:p-8 animate-fade-in space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-charcoal dark:text-white text-sm">
                      Product Catalog
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Showcase your top items on the public directory
                    </p>
                  </div>
                  <button
                    onClick={addProduct}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                  >
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {profile.products?.map((product, index) => (
                    <div
                      key={product.id}
                      className="group relative p-4 sm:p-5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col sm:flex-row gap-4"
                    >
                      <button
                        onClick={() => removeProduct(index)}
                        className="absolute top-3 right-3 w-6 h-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                      >
                        <X size={11} />
                      </button>

                      {/* Product Image */}
                      <label className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-all group/img mx-auto sm:mx-0">
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleProductImageUpload(e, index)}
                        />
                        {product.image_url ? (
                          <img
                            src={getSafeUrl(product.image_url, index + 2)}
                            className="w-full h-full object-cover group-hover/img:opacity-70 transition-opacity"
                            alt="Product"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <Camera
                              size={18}
                              className="mx-auto text-slate-300 group-hover/img:text-primary transition-colors"
                            />
                            <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                              Photo
                            </p>
                          </div>
                        )}
                      </label>

                      {/* Fields */}
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                              Product Name
                            </label>
                            <input
                              type="text"
                              value={product.name}
                              onChange={(e) =>
                                updateProduct(index, "name", e.target.value)
                              }
                              placeholder="e.g. Leather Jacket"
                              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                              <Tag size={9} /> Price
                            </label>
                            <input
                              type="text"
                              value={product.price}
                              onChange={(e) =>
                                updateProduct(index, "price", e.target.value)
                              }
                              placeholder="₱ 0.00"
                              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black text-primary focus:outline-none focus:border-primary transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Description
                          </label>
                          <textarea
                            value={product.description}
                            onChange={(e) =>
                              updateProduct(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            rows={2}
                            placeholder="Brief product description..."
                            className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary transition-all resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!profile.products || profile.products.length === 0) && (
                    <div className="py-14 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl text-center">
                      <ShoppingBag
                        size={36}
                        className="mx-auto text-slate-200 dark:text-zinc-700 mb-3"
                      />
                      <p className="text-sm font-black text-slate-400">
                        No products listed
                      </p>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        Add products to showcase them on your public storefront
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Post Sales ── */}
            {activeTab === "postsales" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm p-5 sm:p-6 lg:p-8 animate-fade-in space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-charcoal dark:text-white text-sm">
                      Shop Sales & Promos
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Post your latest sales, discounts, or announcements
                    </p>
                  </div>
                  <button
                    onClick={addPostSale}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                  >
                    <Plus size={13} /> Add Post
                  </button>
                </div>

                <div className="space-y-4">
                  {profile.post_sales?.map((post, index) => (
                    <div
                      key={post.id}
                      className="group relative p-4 sm:p-5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col sm:flex-row gap-4"
                    >
                      <button
                        onClick={() => removePostSale(index)}
                        className="absolute top-3 right-3 w-6 h-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                      >
                        <X size={11} />
                      </button>

                      {/* Post Image */}
                      <label className="shrink-0 w-full sm:w-40 h-32 sm:h-auto rounded-2xl bg-white dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-all group/img mx-auto sm:mx-0">
                        <input
                          type="file"
                          hidden
                          accept="image/*,video/*"
                          onChange={(e) => handlePostSaleImageUpload(e, index)}
                        />
                        {post.image_url ? (
                          post.image_url.startsWith("data:video") || post.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video
                              src={post.image_url}
                              autoPlay
                              muted
                              loop
                              playsInline
                              className="w-full h-full object-cover group-hover/img:opacity-70 transition-opacity"
                            />
                          ) : (
                            <img
                              src={post.image_url}
                              className="w-full h-full object-cover group-hover/img:opacity-70 transition-opacity"
                              alt="Post Sale"
                            />
                          )
                        ) : (
                          <div className="text-center p-2">
                            <Camera
                              size={18}
                              className="mx-auto text-slate-300 group-hover/img:text-primary transition-colors"
                            />
                            <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                              Media
                            </p>
                          </div>
                        )}
                      </label>

                      {/* Fields */}
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Sale Title / Announcement
                          </label>
                          <input
                            type="text"
                            value={post.title}
                            onChange={(e) =>
                              updatePostSale(index, "title", e.target.value)
                            }
                            placeholder="e.g. 50% OFF Summer Sale!"
                            className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!profile.post_sales || profile.post_sales.length === 0) && (
                    <div className="py-14 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl text-center">
                      <Tag
                        size={36}
                        className="mx-auto text-slate-200 dark:text-zinc-700 mb-3"
                      />
                      <p className="text-sm font-black text-slate-400">
                        No posts yet
                      </p>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        Add a post to show your shop sales on the main directory
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Live Preview (Desktop Only) ── */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-8 space-y-4">
              {/* Preview Label */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 bg-charcoal dark:bg-zinc-900 border border-white/5 rounded-2xl">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                  Live Public Preview
                </span>
              </div>

              {/* Preview Card */}
              <div className="bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-white/10 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-[-28px] rotate-45 bg-primary text-white text-[9px] font-black px-8 py-1 shadow uppercase tracking-widest">
                  Draft
                </div>
                <div className="scale-95 hover:scale-100 transition-transform duration-500 origin-top">
                  <ShopCard shop={previewShop} />
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${profile.is_open ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"}`}
                >
                  <Store size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-charcoal dark:text-white">
                    {profile.is_open ? "Store is Open" : "Store is Closed"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Public visibility:{" "}
                    <span
                      className={
                        profile.is_open ? "text-emerald-500" : "text-slate-400"
                      }
                    >
                      {profile.is_open ? "Active" : "Hidden"}
                    </span>
                  </p>
                </div>
              </div>

              {/* DB Status */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <Loader2
                  size={16}
                  className="text-emerald-500 animate-spin-slow"
                />
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    PostgreSQL Active
                  </p>
                  <p className="text-[9px] text-emerald-600/60 font-medium">
                    Real-time persistence enabled
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
