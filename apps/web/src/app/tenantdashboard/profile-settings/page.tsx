"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Lock,
  Bell,
  Shield,
  Save,
  Camera,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Mail,
  Store,
  Building,
  Info,
  Key,
  Clock,
  ShieldCheck,
  Bookmark,
  Loader2,
  Sparkles,
  Activity,
  Monitor,
  Globe,
  Phone,
  ArrowRight,
  AppWindow,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import {
  getTenantProfileAction,
  updateTenantProfileAction,
  deactivateTenantTerminalAction,
} from "@/app/actions/tenant";
import { updateSecurityAction } from "@/app/actions/auth";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/app/actions/notifications";
import { toast } from "sonner";
import clsx from "clsx";

type Tab = "profile" | "business" | "security" | "notifications";

export default function TenantProfileSettings() {
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security pass visibility
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    shopName: "",
    description: "",
    logoUrl: "",
  });

  const [meta, setMeta] = useState({
    unitId: "",
    status: "",
  });

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = useState({
    overdueRentPayments: true,
    feedbackSpamDetected: true,
    newBookingInquiry: true,
    adSubmissionReceived: false,
  });

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      const [res, notifRes] = await Promise.all([
        getTenantProfileAction(user!.id),
        getNotificationPreferences(user!.id).catch(() => ({
          success: false,
          data: null,
        })),
      ]);

      if (res.success && res.data) {
        setFormData({
          name: res.data.name || "",
          email: res.data.email || "",
          shopName: res.data.shopName || "",
          description: res.data.description || "",
          logoUrl: res.data.logoUrl || "",
        });
        setMeta({
          unitId: res.data.unitId,
          status: res.data.status,
        });
      }

      if (notifRes.success && notifRes.data) {
        setNotificationPrefs({
          overdueRentPayments: notifRes.data.overdueRentPayments ?? true,
          feedbackSpamDetected: notifRes.data.feedbackSpamDetected ?? true,
          newBookingInquiry: notifRes.data.newBookingInquiry ?? true,
          adSubmissionReceived: notifRes.data.adSubmissionReceived ?? false,
        });
      }
    } catch (err) {
      toast.error("Terminal telemetry synchronization failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploadingLogo(true);
    try {
      const { uploadAvatarAction } = await import("@/app/actions/auth");
      const uploadData = new FormData();
      uploadData.append("file", file);

      const res = await uploadAvatarAction(user.id, uploadData);
      if (res.success && res.data?.avatarUrl) {
        const newLogo = res.data.avatarUrl;
        setFormData((prev) => ({ ...prev, logoUrl: newLogo }));
        await updateTenantProfileAction(user.id, { logoUrl: newLogo });
        updateUser({ avatarUrl: newLogo });
        toast.success("Merchant Brand Logo Synchronized");
      } else {
        toast.error("Upload Failed", {
          description: res.error || "Could not upload image",
        });
      }
    } catch (err: any) {
      toast.error("Upload Error", {
        description: err?.message || "File upload failed",
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    const res = await updateTenantProfileAction(user.id, formData);
    if (res.success) {
      updateUser({ name: formData.name, email: formData.email });
      toast.success("Merchant Identity Synchronized");
      loadProfileData();
    } else {
      toast.error("Process Failure", { description: res.error });
    }
    setIsSaving(false);
  };

  const handleSaveNotifications = async () => {
    if (!user?.id) return;
    setIsSavingNotifs(true);
    try {
      const res = await updateNotificationPreferences(user.id, notificationPrefs);
      if (res.success) {
        toast.success("Telemetry Alert Preferences Synchronized");
      } else {
        toast.error("Preferences Update Failed", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Telemetry Error", {
        description: err?.message || "Failed to update preferences",
      });
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleSecurityUpdate = async () => {
    if (!user?.id) return;
    if (!securityData.currentPassword) {
      toast.error("Active authentication key is required");
      return;
    }
    if (!securityData.newPassword) {
      toast.error("New terminal token is required");
      return;
    }
    if (securityData.newPassword.length < 6) {
      toast.error("New token must be at least 6 characters long");
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("Access keys do not match");
      return;
    }

    setIsSaving(true);
    const res = await updateSecurityAction(user.id, {
      currentPassword: securityData.currentPassword,
      newPassword: securityData.newPassword,
    });

    if (res.success) {
      toast.success("Security Protocol Re-authorized");
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } else {
      toast.error("Security sync failed", { description: res.error });
    }
    setIsSaving(false);
  };

  const handleTerminalDeactivation = async () => {
    if (!user?.id) return;
    if (
      confirm(
        "CRITICAL WARNING: This will permanently deactivate your merchant terminal and freeze all integrated services. Proceed with de-authorization?",
      )
    ) {
      const res = await deactivateTenantTerminalAction(user.id);
      if (res.success) {
        toast.warning("Terminal Suspended. Initializing Global Sign-out...");
        setTimeout(() => {
          logout();
          window.location.href = "/";
        }, 2000);
      }
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "profile", label: "Principal Identity", icon: User },
    { key: "business", label: "Merchant Console", icon: Store },
    { key: "security", label: "Security Firewall", icon: Lock },
    { key: "notifications", label: "Telemetry Alerts", icon: Bell },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse">
            <AppWindow size={20} />
          </div>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">
          Synchronizing Console...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1400px] mx-auto">
      {/* Hidden Logo Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleLogoUpload}
        disabled={isUploadingLogo}
      />

      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
            <ShieldCheck size={12} /> Status: Verified Partner
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Console <span className="text-primary">Settings.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            Authorized merchant configuration portal. Manage business identity,
            security keys, and system telemetry.
          </p>
        </div>
        <button
          onClick={loadProfileData}
          className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm active:scale-95"
          title="Refresh Settings"
        >
          <Monitor size={20} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Secondary Console Navigation */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          {/* Boutique Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[3rem] p-10 text-center shadow-sm relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
              <Store size={120} className="text-primary" />
            </div>
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 rounded-[1.75rem] bg-primary text-white font-black text-4xl flex items-center justify-center ring-8 ring-primary/10 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    className="w-full h-full object-cover"
                    alt={formData.shopName || "Store logo"}
                  />
                ) : (
                  formData.shopName ? formData.shopName.charAt(0).toUpperCase() : "B"
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-charcoal dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                title="Upload Store Logo"
              >
                {isUploadingLogo ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
            </div>
            <h3 className="font-black text-2xl text-charcoal dark:text-white uppercase tracking-tighter italic leading-tight truncate">
              {formData.shopName || "Boutique"}
            </h3>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">
              Allocation: {meta.unitId || "Unit -"}
            </p>

            <div className="mt-8 pt-8 border-t border-slate-50 dark:border-white/5">
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {meta.status || "ACTIVE"} TERMINAL
                </span>
              </div>
            </div>
          </div>

          {/* Console Tabs */}
          <nav className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-3 shadow-sm space-y-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                  activeTab === key
                    ? "bg-primary text-white shadow-xl shadow-primary/25 translate-x-1"
                    : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-charcoal dark:hover:text-white",
                )}
              >
                <div
                  className={clsx(
                    "p-2 rounded-xl transition-colors",
                    activeTab === key
                      ? "bg-white/20"
                      : "bg-slate-100 dark:bg-zinc-800",
                  )}
                >
                  <Icon size={16} />
                </div>
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Interface */}
        <main className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-sm space-y-12 animate-fade-in">
              <div className="flex items-center gap-5 border-b border-slate-100 dark:border-white/5 pb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <User size={28} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Principal Identity.
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">
                    Verify your legal and professional contact parameters.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Full Authorized Name
                  </label>
                  <div className="relative group/input">
                    <User
                      size={18}
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                    />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold text-charcoal dark:text-white outline-none placeholder:text-slate-300"
                      placeholder="Principal Name"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Professional Telemetry Link (Email)
                  </label>
                  <div className="relative group/input">
                    <Mail
                      size={18}
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                    />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold text-charcoal dark:text-white outline-none"
                      placeholder="comms@boutique.com"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button
                  onClick={handleUpdateProfile}
                  disabled={isSaving}
                  className="flex items-center gap-4 px-12 py-5 bg-primary text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  Commit Principal Update
                </button>
              </div>
            </div>
          )}

          {activeTab === "business" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-sm space-y-12 animate-fade-in">
              <div className="flex items-center gap-5 border-b border-slate-100 dark:border-white/5 pb-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                  <Store size={28} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Merchant Manifest.
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">
                    Refine your public presentation and brand positioning.
                  </p>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Commercial Brand Identity
                  </label>
                  <input
                    type="text"
                    value={formData.shopName}
                    onChange={(e) =>
                      setFormData({ ...formData, shopName: e.target.value })
                    }
                    className="w-full px-8 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-3xl focus:ring-4 focus:ring-primary/10 transition-all text-sm font-black text-charcoal dark:text-white outline-none"
                    placeholder="Boutique Name"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Mission / Store Description
                  </label>
                  <textarea
                    rows={5}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-8 py-6 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-[2rem] focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium text-charcoal dark:text-white outline-none resize-none leading-relaxed italic"
                    placeholder="Define your boutique's presence..."
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Asset Uplink (Logo URL)
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="text-[10px] font-black text-primary hover:underline flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingLogo ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Camera size={12} />
                      )}
                      Upload Image File
                    </button>
                  </div>
                  <div className="relative group/input">
                    <Globe
                      size={18}
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                    />
                    <input
                      type="text"
                      value={formData.logoUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, logoUrl: e.target.value })
                      }
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all text-[11px] font-medium text-slate-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button
                  onClick={handleUpdateProfile}
                  disabled={isSaving}
                  className="flex items-center gap-4 px-12 py-5 bg-primary text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Push Manifest Update
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-sm space-y-12">
                <div className="flex items-center gap-5 border-b border-slate-100 dark:border-white/5 pb-10">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                    <Key size={28} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                      Security Firewall.
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                      Manage terminal authentication keys and access protocols.
                    </p>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Active Authentication Key
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={securityData.currentPassword}
                        onChange={(e) =>
                          setSecurityData({
                            ...securityData,
                            currentPassword: e.target.value,
                          })
                        }
                        className="w-full px-8 py-5 pr-16 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-charcoal dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors cursor-pointer"
                      >
                        {showCurrentPass ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        New Terminal Token
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPass ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={securityData.newPassword}
                          onChange={(e) =>
                            setSecurityData({
                              ...securityData,
                              newPassword: e.target.value,
                            })
                          }
                          className="w-full px-8 py-5 pr-16 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-charcoal dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors cursor-pointer"
                        >
                          {showNewPass ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Confirm Security Token
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPass ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={securityData.confirmPassword}
                          onChange={(e) =>
                            setSecurityData({
                              ...securityData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="w-full px-8 py-5 pr-16 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-charcoal dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors cursor-pointer"
                        >
                          {showConfirmPass ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSecurityUpdate}
                    disabled={isSaving || !securityData.currentPassword}
                    className="px-12 py-5 bg-charcoal dark:bg-white text-white dark:text-black rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Authorize Firewall Sync"
                    )}
                  </button>
                </div>
              </div>

              {/* Kill Switch Protocol */}
              <div className="bg-red-500/5 border border-red-500/10 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-primary uppercase italic tracking-tighter flex items-center gap-2 underline decoration-primary/20 decoration-4 underline-offset-4">
                    <AlertTriangle size={24} /> Termination Protocol
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed uppercase grey-text max-w-md">
                    Synchronous de-authorization of boutique terminal. This will
                    freeze all digital storefront services instantly.
                  </p>
                </div>
                <button
                  onClick={handleTerminalDeactivation}
                  className="w-full md:w-auto px-10 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-widest rounded-[1.5rem] hover:bg-red-700 transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  Deactivate Terminal
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-sm space-y-12 animate-fade-in">
              <div className="flex items-center gap-5 border-b border-slate-100 dark:border-white/5 pb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <Bell size={28} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Telemetry Alerts.
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">
                    Manage how the system pushes critical operational signals to
                    your terminal.
                  </p>
                </div>
              </div>

              <div className="space-y-2 divide-y divide-slate-100 dark:divide-white/5">
                {[
                  {
                    key: "overdueRentPayments" as const,
                    label: "Fiscal Due Dates",
                    desc: "Critical alerts for upcoming monthly lease and utility synchronizations.",
                  },
                  {
                    key: "feedbackSpamDetected" as const,
                    label: "Shopper Engagement Manifest",
                    desc: "Instant push signals when a shopper leaves feedback for your store.",
                  },
                  {
                    key: "newBookingInquiry" as const,
                    label: "Intelligent Messenger Hub",
                    desc: "Real-time telemetry for incoming shopper inquiries and requests.",
                  },
                  {
                    key: "adSubmissionReceived" as const,
                    label: "Campaign Life-cycle",
                    desc: "Alerts for scheduled ad banner activation and terminal release.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-8 gap-10 group/alert"
                  >
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-charcoal dark:text-white uppercase tracking-tight group-hover/alert:text-primary transition-colors">
                        {item.label}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed uppercase grey-text">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={clsx(
                        "w-14 h-7 rounded-full relative shrink-0 transition-colors shadow-lg cursor-pointer",
                        notificationPrefs[item.key]
                          ? "bg-primary shadow-primary/25"
                          : "bg-slate-200 dark:bg-zinc-800 shadow-black/10",
                      )}
                      title={`Toggle ${item.label}`}
                    >
                      <span
                        className={clsx(
                          "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md",
                          notificationPrefs[item.key] ? "right-1" : "left-1",
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifs}
                  className="flex items-center gap-4 px-12 py-5 bg-primary text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingNotifs ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Commit Telemetry Settings
                </button>
              </div>

              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-3xl flex items-start gap-5">
                <Info size={24} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase leading-relaxed tracking-wider">
                  Strategic Alert: These telemetry settings are localized to
                  your terminal session. Critical system maintenance signals
                  bypass these filters.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
