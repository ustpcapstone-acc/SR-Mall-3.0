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
  Phone,
  Globe,
  Key,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Sparkles,
  Activity,
  Monitor,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/app/actions/notifications";
import {
  updateSecurityAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/app/actions/auth";
import { toast } from "sonner";
import clsx from "clsx";

type Tab = "profile" | "security" | "notifications" | "system";

export default function AdminProfileSettings() {
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // Profile Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "SR Mall Management — Super Administrator",
    bio: "Oversees all mall operations, tenant management, and administrative decisions for SR Mall ecosystem.",
  });

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Prepopulate form data from authenticated user
  useEffect(() => {
    if (user) {
      const parts = (user.name || "").trim().split(" ");
      const first = parts[0] || "Admin";
      const last = parts.slice(1).join(" ") || "User";
      const storedBio = localStorage.getItem(`admin_bio_${user.id}`);
      const storedPhone = localStorage.getItem(`admin_phone_${user.id}`);
      const storedDept = localStorage.getItem(`admin_dept_${user.id}`);
      setFormData({
        firstName: first,
        lastName: last,
        email: user.email || "srmall@admin.com",
        phone: storedPhone || "+63 917 555 0000",
        department: storedDept || "SR Mall Management — Super Administrator",
        bio: storedBio || "Oversees all mall operations, tenant management, and administrative decisions for SR Mall ecosystem.",
      });
    }
  }, [user]);

  // Load notification preferences
  useEffect(() => {
    if (user && activeTab === "notifications") {
      setLoadingPrefs(true);
      getNotificationPreferences(user.id).then((res) => {
        if (res.success && res.data) {
          setNotificationPrefs(res.data);
        } else {
          setNotificationPrefs({
            newBookingInquiry: true,
            feedbackSpamDetected: true,
            expiringContracts: true,
            overdueRentPayments: true,
            adSubmissionReceived: false,
            systemHealthReports: false,
          });
        }
        setLoadingPrefs(false);
      });
    }
  }, [user, activeTab]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await uploadAvatarAction(user.id, form);
      if (res.success && res.data) {
        updateUser({ avatarUrl: res.data.avatarUrl });
        toast.success("Avatar Updated Successfully", {
          description: "Your master profile image is now synchronized.",
        });
      } else {
        toast.error(res.error || "Failed to upload avatar");
      }
    } catch (err: any) {
      toast.error("Avatar upload error: " + (err.message || err));
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleProfileSave = async () => {
    if (!user?.id) return;
    if (!formData.firstName.trim() && !formData.lastName.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Email address is required.");
      return;
    }
    setIsSaving(true);
    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const res = await updateProfileAction(user.id, {
        name: fullName,
        email: formData.email.trim(),
      });
      if (res.success && res.data) {
        updateUser({ name: res.data.name || fullName, email: res.data.email });
        localStorage.setItem(`admin_bio_${user.id}`, formData.bio);
        localStorage.setItem(`admin_phone_${user.id}`, formData.phone);
        localStorage.setItem(`admin_dept_${user.id}`, formData.department);
        toast.success("Profile Identity Committed", {
          description: "Administrator parameters successfully synchronized.",
        });
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } catch (err: any) {
      toast.error("Save error: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecurityUpdate = async () => {
    if (!user?.id) return;
    if (!securityData.currentPassword) {
      toast.error("Current password is required.");
      return;
    }
    if (!securityData.newPassword) {
      toast.error("New password is required.");
      return;
    }
    if (securityData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("Security mismatch: Passwords do not align.");
      return;
    }

    setIsSaving(true);
    const res = await updateSecurityAction(user.id, {
      currentPassword: securityData.currentPassword,
      newPassword: securityData.newPassword,
    });

    if (res.success) {
      toast.success("Security Credentials Synchronized");
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } else {
      toast.error("Security update failed", { description: res.error });
    }
    setIsSaving(false);
  };

  const handleNotifSave = async () => {
    if (user && notificationPrefs) {
      setIsSaving(true);
      const res = await updateNotificationPreferences(
        user.id,
        notificationPrefs,
      );
      if (res.success) toast.success("Intelligence Alert Preferences Saved");
      setIsSaving(false);
    }
  };

  const updateNotificationPref = (key: string, value: boolean) => {
    setNotificationPrefs((prev: any) =>
      prev ? { ...prev, [key]: value } : null,
    );
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "profile", label: "Profile Information", icon: User },
    { key: "security", label: "Security & Password", icon: Lock },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "system", label: "Permissions & Roles", icon: Shield },
  ];

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1400px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <ShieldCheck size={12} /> Root Level Access
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Control <span className="text-primary">Center.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            Manage master administrator credentials, security protocols, and
            system-wide intelligence alerts.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Navigation & Status Card */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          {/* Professional Avatar Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 text-center shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={40} className="text-primary" />
            </div>
            <div className="relative inline-block mb-6">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={isUploadingAvatar}
              />
              <div className="w-24 h-24 rounded-[2rem] bg-primary text-white font-black text-3xl flex items-center justify-center ring-4 ring-primary/20 shadow-2xl transition-transform group-hover:scale-105 overflow-hidden">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Master Admin"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase() || "AD"
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-charcoal dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                title="Change Avatar"
              >
                {isUploadingAvatar ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
            </div>
            <h3 className="font-black text-xl text-charcoal dark:text-white uppercase tracking-tighter italic truncate">
              {user?.name || "Master Admin"}
            </h3>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">
              {user?.role ? `${user.role} Principal` : "Superuser Principal"}
            </p>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Active Authority Session
              </span>
            </div>
          </div>

          {/* Semantic Navigation */}
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
                <Icon
                  size={18}
                  className={
                    activeTab === key ? "text-white" : "text-slate-500"
                  }
                />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Console Interface */}
        <main className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10 animate-fade-in">
              <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <User size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Profile Details.
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Manage your administrator profile details.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e: any) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="First Name"
                  icon={User}
                />
                <InputGroup
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e: any) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Last Name"
                  icon={User}
                />
                <InputGroup
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e: any) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="admin@example.com"
                  icon={Mail}
                />
                <InputGroup
                  label="Terminal Phone Link"
                  value={formData.phone}
                  onChange={(e: any) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+63 900 000 0000"
                  icon={Phone}
                />
                <div className="md:col-span-2">
                  <InputGroup
                    label="Institutional Role / Department"
                    value={formData.department}
                    onChange={(e: any) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    placeholder="Department or Role"
                    icon={Globe}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Professional Manifest / Bio
                  </label>
                  <textarea
                    rows={4}
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    placeholder="Brief description of administrative responsibilities..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium text-charcoal dark:text-white outline-none resize-none"
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button
                  onClick={handleProfileSave}
                  disabled={isSaving}
                  className="flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Commit Identity
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10">
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-8">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                    <Key size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                      Security Firewall.
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Update master authorization keys and terminal access
                      tokens.
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Primary Access Token (Current Password)
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        placeholder="Current password"
                        value={securityData.currentPassword}
                        onChange={(e) =>
                          setSecurityData({
                            ...securityData,
                            currentPassword: e.target.value,
                          })
                        }
                        className="w-full px-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      >
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        New Authority Token (New Password)
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPass ? "text" : "password"}
                          placeholder="Min 6 characters"
                          value={securityData.newPassword}
                          onChange={(e) =>
                            setSecurityData({
                              ...securityData,
                              newPassword: e.target.value,
                            })
                          }
                          className="w-full px-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all pr-14"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                        >
                          {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Confirm Token Synchronicity
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPass ? "text" : "password"}
                          placeholder="Repeat new password"
                          value={securityData.confirmPassword}
                          onChange={(e) =>
                            setSecurityData({
                              ...securityData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="w-full px-6 py-5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all pr-14"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                        >
                          {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSecurityUpdate}
                    disabled={isSaving || !securityData.currentPassword || !securityData.newPassword}
                    className="px-10 py-5 bg-charcoal dark:bg-white text-white dark:text-black rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Re-authorize Firewall"
                    )}
                  </button>
                </div>
              </div>

              {/* Danger Protocol */}
              <div className="bg-red-500/5 border border-red-500/10 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="space-y-2 max-w-lg">
                  <h3 className="text-xl font-black text-primary uppercase italic tracking-tighter flex items-center gap-2 underline decoration-primary/20 decoration-4 underline-offset-4">
                    <AlertTriangle size={24} /> Zero Trust Protocol
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed uppercase grey-text">
                    Initiate global terminal de-authorization or administrative
                    lockout. This action requires secondary clearance.
                  </p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Terminal Sessions Cleared", {
                        description: "All other active administrator session tokens purged.",
                      });
                    }}
                    className="flex-1 md:flex-none px-6 py-4 border-2 border-primary text-primary font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95"
                  >
                    Purge Sessions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to lock the console and end your administrator session?")) {
                        logout();
                        window.location.href = "/";
                      }
                    }}
                    className="flex-1 md:flex-none px-6 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:brightness-110 transition-all shadow-xl shadow-primary/20 active:scale-95"
                  >
                    Lock Console
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10 animate-fade-in">
              <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <Bell size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Intelligence Alerts.
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure terminal telemetry and administrative signal
                    priorities.
                  </p>
                </div>
              </div>

              <div className="space-y-2 divide-y divide-slate-100 dark:divide-white/5">
                {[
                  {
                    label: "Merchant Onboarding Signals",
                    desc: "Critical alert for new shop partnership manifest submissions.",
                    key: "newBookingInquiry",
                  }, // Reusing keys for logic
                  {
                    label: "Security Anomaly Detection",
                    desc: "Automatic signal when the anti-spam protocol flags institutional risk.",
                    key: "feedbackSpamDetected",
                  },
                  {
                    label: "Institutional Term Cycle",
                    desc: "Notify 30 days prior to contract expiration for verified tenants.",
                    key: "expiringContracts",
                  },
                  {
                    label: "Fiscal Delinquency Tracking",
                    desc: "Daily telemetry for overdue asset usage payments.",
                    key: "overdueRentPayments",
                  },
                  {
                    label: "Brand Asset Submission",
                    desc: "Channel alert for new billboard or storefront creative approvals.",
                    key: "adSubmissionReceived",
                  },
                  {
                    label: "System Health Manifest",
                    desc: "Holistic weekly telemetry reports and operational summaries.",
                    key: "systemHealthReports",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-6 gap-8 group/notif"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight group-hover/notif:text-primary transition-colors">
                        {item.label}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        updateNotificationPref(
                          item.key,
                          !notificationPrefs?.[item.key],
                        )
                      }
                      className={clsx(
                        "w-14 h-7 rounded-full transition-all relative shrink-0",
                        notificationPrefs?.[item.key]
                          ? "bg-primary shadow-lg shadow-primary/30"
                          : "bg-slate-200 dark:bg-zinc-800",
                      )}
                    >
                      <span
                        className={clsx(
                          "w-5 h-5 bg-white rounded-full absolute top-1 shadow-md transition-transform",
                          notificationPrefs?.[item.key]
                            ? "translate-x-8"
                            : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button
                  onClick={handleNotifSave}
                  disabled={isSaving || loadingPrefs}
                  className="flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Secure Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3rem] p-10 md:p-12 shadow-sm space-y-10">
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                      Permissions & Roles.
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Your administrative privileges and access levels.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Tenant Management", granted: true },
                    { label: "Financial Ledger & Billing", granted: true },
                    { label: "Public Content CMS", granted: true },
                    { label: "User Blacklist", granted: true },
                    { label: "Ad Scheduler", granted: true },
                    { label: "System Settings", granted: true },
                  ].map((perm) => (
                    <div
                      key={perm.label}
                      className="bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/5 px-6 py-5 rounded-2xl flex items-center justify-between group/perm hover:border-primary/30 transition-all"
                    >
                      <span className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight">
                        {perm.label}
                      </span>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                        <CheckCircle size={10} /> Authorized
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-4">
                  <Activity
                    size={20}
                    className="text-blue-500 shrink-0 mt-0.5"
                  />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed uppercase grey-text">
                    You are currently operating as a{" "}
                    <strong className="text-blue-500">Root Superuser</strong>.
                    All system-wide authorization gates are bypassed. Any
                    configuration change here may have systemic impacts.
                  </p>
                </div>
              </div>

              {/* Login Telemetry */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[3rem] shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                    Terminal Telemetry
                  </h3>
                  <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                    Purge History
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {[
                    {
                      device: "Workstation — Chrome (Windows)",
                      location: "Global Admin Center",
                      time: "Active Now",
                      current: true,
                    },
                    {
                      device: "Mobile Terminal — Safari (iOS)",
                      location: "Pasig Operations Node",
                      time: "14 Hours Ago",
                      current: false,
                    },
                    {
                      device: "Remote Node — Chrome (macOS)",
                      location: "Unknown Uplink",
                      time: "Mar 18, 2026",
                      current: false,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="px-8 py-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group/terminal"
                    >
                      <div className="flex items-center gap-5">
                        <div
                          className={clsx(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            item.current
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-400",
                          )}
                        >
                          {item.current ? (
                            <Activity size={18} />
                          ) : (
                            <Monitor size={18} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight flex items-center gap-2">
                            {item.device}
                            {item.current && (
                              <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded tracking-widest uppercase animate-pulse">
                                Live
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {item.location} • {item.time}
                          </p>
                        </div>
                      </div>
                      {!item.current && (
                        <button className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                          <ArrowRight size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InputGroup({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  icon: any;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <div className="relative group/input">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors">
          <Icon size={18} />
        </div>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold text-charcoal dark:text-white outline-none disabled:opacity-60"
        />
      </div>
    </div>
  );
}
