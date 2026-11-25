"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Save,
  Image as ImageIcon,
  Layout,
  Type,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { getSiteConfig, updateSiteConfig } from "@/app/actions/site-config";

export default function SiteEditorPage() {
  const { user, isAuthenticated } = useAuth();

  const [config, setConfig] = useState<any>({
    heroTitle: "",
    heroSubtitle: "",
    heroBadge: "",
    heroBgUrl: "",
    heroOverlayDark: 40,
    primaryBtnText: "",
    isMaintenance: false,
    defaultAdTitle: "",
    defaultAdDesc: "",
    defaultAdImage: "",
    defaultAdCta: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const heroBgInputRef = useRef<HTMLInputElement>(null);
  const adImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      const data = await getSiteConfig();
      if (data) {
        setConfig(data);
      }
      setLoading(false);
    }
    if (isAuthenticated && user?.role === "ADMIN") {
      loadData();
    } else if (isAuthenticated && user?.role !== "ADMIN") {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateSiteConfig(config);
    if (res.success) {
      alert("Global Site Configuration synced successfully! Changes are live.");
    } else {
      alert("Sync Failed. Please try again.");
    }
    setSaving(false);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "heroBgUrl" | "defaultAdImage",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const convertToBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    };

    try {
      const base64Url = await convertToBase64(file);
      setConfig((prev: any) => ({ ...prev, [field]: base64Url }));
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  };

  const updateField = (field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 text-center">
          Loading Global Config...
        </p>
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="p-5 sm:p-10 text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-red-500">Access Denied</h1>
        <p>You do not have permission to configure global site variables.</p>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-14 animate-fade-in-up max-w-[1600px] mx-auto space-y-12">
      <input
        type="file"
        hidden
        ref={heroBgInputRef}
        accept="image/*"
        onChange={(e) => handleImageUpload(e, "heroBgUrl")}
      />
      <input
        type="file"
        hidden
        ref={adImageInputRef}
        accept="image/*"
        onChange={(e) => handleImageUpload(e, "defaultAdImage")}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 dark:border-white/5 pb-10">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-charcoal dark:text-white">
            Site Editor
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-xl">
            Modify the hardcoded defaults for the Public Directory. Changes are
            instantly pushed to the main frontend.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-4 px-12 py-5 bg-primary text-white hover:scale-105 active:scale-95 disabled:grayscale disabled:scale-100 rounded-3xl font-semibold text-sm transition-all shadow-2xl shadow-primary/30"
        >
          {saving ? (
            <>
              <Loader2 size={24} className="animate-spin" /> Pushing Config...
            </>
          ) : (
            <>
              <Save size={24} /> Publish Changes
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Mall Hero Section */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl shadow-xs p-6 sm:p-12 space-y-10">
          <h2 className="font-semibold text-charcoal dark:text-white flex items-center gap-3 text-xl tracking-tight">
            <Layout size={24} className="text-primary" /> Landing Page Hero
          </h2>

          <div className="space-y-6">
            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Hero Floating Badge
              </label>
              <input
                type="text"
                value={config?.heroBadge || ""}
                onChange={(e) => updateField("heroBadge", e.target.value)}
                placeholder="e.g. Professional Mall Management System"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-sm font-bold shadow-xs"
              />
            </div>

            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Main Hero Title
              </label>
              <textarea
                value={config?.heroTitle || ""}
                onChange={(e) => updateField("heroTitle", e.target.value)}
                rows={2}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-lg font-semibold shadow-xs resize-none tracking-tight"
              ></textarea>
            </div>

            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Hero Subtitle
              </label>
              <textarea
                value={config?.heroSubtitle || ""}
                onChange={(e) => updateField("heroSubtitle", e.target.value)}
                rows={3}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-sm font-medium shadow-xs resize-none"
              ></textarea>
            </div>

            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Primary Button Text
              </label>
              <input
                type="text"
                value={config?.primaryBtnText || ""}
                onChange={(e) => updateField("primaryBtnText", e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-sm font-bold shadow-xs"
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <ImageIcon size={14} /> Hero Background Image
                </label>
                <button
                  onClick={() => heroBgInputRef.current?.click()}
                  className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold"
                >
                  Change
                </button>
              </div>
              {config?.heroBgUrl && (
                <div className="w-full aspect-video rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-inner">
                  <img
                    src={config.heroBgUrl}
                    className="w-full h-full object-cover"
                    alt="Hero Bg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Default Ad Banner Section */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl shadow-xs p-6 sm:p-12 space-y-10">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-charcoal dark:text-white flex items-center gap-3 text-xl tracking-tight">
              <Type size={24} className="text-primary" /> Default Ad Fallback
            </h2>
            <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">
              Fallback Only
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            This is the default ad campaign (e.g. "Luxe Summer Sale") that
            perfectly renders when no active Mall Ads are scheduled by admins.
          </p>

          <div className="space-y-6">
            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Campaign Title
              </label>
              <input
                type="text"
                value={config?.defaultAdTitle || ""}
                onChange={(e) => updateField("defaultAdTitle", e.target.value)}
                placeholder="e.g. Luxe Summer Sale"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-xl font-semibold shadow-xs tracking-tight"
              />
            </div>

            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Ad Description
              </label>
              <textarea
                value={config?.defaultAdDesc || ""}
                onChange={(e) => updateField("defaultAdDesc", e.target.value)}
                rows={3}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-sm font-medium shadow-xs resize-none"
              ></textarea>
            </div>

            <div className="group/field">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Call-to-Action Text
              </label>
              <input
                type="text"
                value={config?.defaultAdCta || ""}
                onChange={(e) => updateField("defaultAdCta", e.target.value)}
                placeholder="e.g. View Directory"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl focus:border-primary focus:outline-hidden text-sm font-bold shadow-xs"
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <ImageIcon size={14} /> Campaign Background
                </label>
                <button
                  onClick={() => adImageInputRef.current?.click()}
                  className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold"
                >
                  Upload Replace
                </button>
              </div>

              <div
                onClick={() => adImageInputRef.current?.click()}
                className="w-full aspect-21/9 rounded-2xl overflow-hidden border-[3px] border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/30 flex items-center justify-center cursor-pointer group/upload relative"
              >
                {config?.defaultAdImage ? (
                  <>
                    <img
                      src={config.defaultAdImage}
                      className="w-full h-full object-cover group-hover/upload:opacity-50 transition-opacity"
                      alt="Ad Campaign Bg"
                    />
                    <div className="absolute opacity-0 group-hover/upload:opacity-100 transition-opacity flex flex-col items-center text-white drop-shadow-md">
                      <UploadCloud size={32} className="mb-2" />
                      <span className="text-xs font-semibold">
                        Replace Media
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-400 group-hover/upload:text-primary transition-colors">
                    <UploadCloud size={32} className="mx-auto mb-2" />
                    <span className="text-xs font-semibold">
                      Push Visual Cover
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
