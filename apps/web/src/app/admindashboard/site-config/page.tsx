"use client";

import React, { useEffect, useState } from "react";
import {
  Layout,
  Type,
  Image as ImageIcon,
  ToggleLeft,
  Save,
  RefreshCcw,
  Monitor,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";

export default function SiteConfigCMS() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  // Local Draft State
  const [draft, setDraft] = useState<any>({
    heroTitle: "",
    heroSubtitle: "",
    heroBgUrl: "",
    heroOverlayDark: 40,
    primaryBtnText: "",
    isMaintenance: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { getSiteConfig } = await import("@/app/actions/site-config");
      const data = await getSiteConfig();
      if (data) {
        setConfig(data);
        setDraft(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { updateSiteConfig } = await import("@/app/actions/site-config");
      await updateSiteConfig(draft);
      setConfig(draft);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center animate-pulse font-bold text-xs text-slate-400">
        Initializing CMS Engine...
      </div>
    );

  return (
    <div className="p-8 lg:p-10 animate-fade-in-up max-w-[1600px] mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-charcoal dark:text-white">
            Site Settings
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage branding, headlines, and system maintenance mode from a
            central dashboard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDraft(config)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-white border border-slate-100 dark:border-white/5 rounded-xl font-bold text-xs hover:border-primary transition-all"
          >
            <RefreshCcw size={14} /> Revert to Live
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white border border-transparent rounded-xl font-bold text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCcw size={14} className="animate-spin" /> Publishing...
              </>
            ) : (
              <>
                <Save size={14} /> Publish Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Editor Controls */}
        <div className="space-y-8 h-fit">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-4xl shadow-xs p-8 space-y-8">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-white/5">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Type size={18} />
              </div>
              <h3 className="font-semibold text-charcoal dark:text-white text-xs">
                Hero Section Content
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">
                  Main Headline
                </label>
                <textarea
                  rows={2}
                  value={draft.heroTitle}
                  onChange={(e) =>
                    setDraft({ ...draft, heroTitle: e.target.value })
                  }
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-2xl focus:border-primary focus:outline-hidden transition-colors text-sm font-bold text-charcoal dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">
                  Sub-headline Description
                </label>
                <textarea
                  rows={3}
                  value={draft.heroSubtitle}
                  onChange={(e) =>
                    setDraft({ ...draft, heroSubtitle: e.target.value })
                  }
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-2xl focus:border-primary focus:outline-hidden transition-colors text-sm font-medium text-slate-500 dark:text-slate-300 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={draft.primaryBtnText}
                    onChange={(e) =>
                      setDraft({ ...draft, primaryBtnText: e.target.value })
                    }
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-2xl focus:border-primary focus:outline-hidden transition-colors text-sm font-bold text-charcoal dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">
                    Background Overlay (Darkness)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={draft.heroOverlayDark}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        heroOverlayDark: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-10 mt-2 accent-primary"
                  />
                  <div className="flex justify-between text-xs font-bold text-slate-400 mt-1">
                    <span>Clear</span>
                    <span>{draft.heroOverlayDark}% intensity</span>
                    <span>Solid</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-4xl shadow-xs p-8 space-y-6">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-white/5">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
                <ToggleLeft size={18} />
              </div>
              <h3 className="font-semibold text-charcoal dark:text-white text-xs">
                System & Maintenance
              </h3>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg text-amber-500">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-charcoal dark:text-white">
                    Maintenance Mode
                  </h4>
                  <p className="text-xs font-medium text-slate-500">
                    Shut down public access for all visitors.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setDraft({ ...draft, isMaintenance: !draft.isMaintenance })
                }
                className={`w-14 h-8 rounded-full transition-colors relative ${draft.isMaintenance ? "bg-primary" : "bg-slate-300"}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${draft.isMaintenance ? "left-7" : "left-1"}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Display */}
        <div className="space-y-6 flex flex-col items-center">
          <div className="flex items-center gap-4 bg-charcoal dark:bg-zinc-900 p-1.5 rounded-full border border-white/5 shadow-2xl mb-2">
            <button
              onClick={() => setViewMode("desktop")}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "desktop" ? "bg-white text-charcoal" : "text-white/50 hover:text-white"}`}
            >
              <Monitor size={16} /> Desktop View
            </button>
            <button
              onClick={() => setViewMode("mobile")}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "mobile" ? "bg-white text-charcoal" : "text-white/50 hover:text-white"}`}
            >
              <Smartphone size={16} /> Mobile Preview
            </button>
          </div>

          <div
            className={`relative transition-all duration-500 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl ${viewMode === "desktop" ? "aspect-video w-full" : "w-[375px] h-[667px]"}`}
          >
            {/* Dynamic Content Engine (Mini-Clone of Public-View) */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700"
              style={{
                backgroundImage: `url(${draft.heroBgUrl || "https://images.unsplash.com/photo-1519642918688-7e43b19245d8?auto=format&fit=crop&q=80&w=2000"})`,
              }}
            >
              <div
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{ opacity: draft.heroOverlayDark / 100 }}
              />

              <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center text-center px-10">
                <div className="space-y-4 max-w-xl">
                  <span className="inline-block px-4 py-1.5 bg-primary/20 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/20 animate-fade-in shadow-xl">
                    {draft.isMaintenance
                      ? "⚠️ SYSTEM OFFLINE"
                      : "SR-MANAGE CONTENT PREVIEW"}
                  </span>
                  <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight leading-tight text-white drop-shadow-2xl">
                    {draft.heroTitle}
                  </h1>
                  <p className="text-xs md:text-sm text-slate-200 font-medium leading-relaxed opacity-80 line-clamp-3">
                    {draft.heroSubtitle}
                  </p>

                  {!draft.isMaintenance && (
                    <div className="pt-4 flex justify-center">
                      <button className="px-8 py-4 bg-primary text-white text-xs font-semibold rounded-full shadow-2xl">
                        {draft.primaryBtnText}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Maintenance Overlay in Preview */}
            {draft.isMaintenance && (
              <div className="absolute inset-0 bg-charcoal flex flex-col items-center justify-center p-10 z-20">
                <div className="w-16 h-16 bg-primary/20 text-primary rounded-3xl flex items-center justify-center mb-6 border border-primary/30">
                  <AlertTriangle size={32} />
                </div>
                <h2 className="font-display text-2xl font-semibold text-white mb-2 tracking-tight">
                  System Under Maintenance
                </h2>
                <p className="text-xs text-slate-400 font-medium text-center leading-loose">
                  The public view will be hidden until you toggle this setting
                  off and republish.
                </p>
              </div>
            )}

            <div className="absolute top-6 left-6 flex items-center gap-2 bg-charcoal/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/10 text-xs font-bold z-30">
              <Eye size={12} /> {isSaving ? "Synching..." : "Live Preview"}
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex items-start gap-3 w-full max-w-lg">
            <CheckCircle size={18} className="text-blue-500 shrink-0" />
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
              You are editing a draft. Changes will only take effect on the
              production Public-View once you click the{" "}
              <span className="text-primary font-semibold">Publish Changes</span>{" "}
              button.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
