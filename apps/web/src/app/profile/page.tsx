"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions/auth";
import { supabase } from "@/utils/supabase";
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Camera,
  Store,
  MapPin,
  Heart,
  ShoppingBag,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Lock,
  ChevronRight,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";
import { MerchantApplicationModal } from "@/components/merchant-application-modal";

export default function ProfilePage() {
  const { isAuthenticated, user, updateUser, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "general" | "security" | "favorites"
  >("general");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Favorites state moved to top level
  const [allShops, setAllShops] = useState<any[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [isLoadingFavs, setIsLoadingFavs] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    } else if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: "",
      });
    }
  }, [isAuthenticated, user, router]);

  // Load favorites and shops
  useEffect(() => {
    const loadFavoritesData = async () => {
      const saved = JSON.parse(
        localStorage.getItem("sr_mall_favorites") || "[]",
      );
      setFavIds(saved);

      setIsLoadingFavs(true);
      try {
        const { getAllStorefrontsAction } =
          await import("@/app/actions/tenant");
        const res = await getAllStorefrontsAction();
        if (res.success && res.data) {
          setAllShops(res.data);
        }
      } catch (err) {
        console.error("Failed to load shop data");
      } finally {
        setIsLoadingFavs(false);
      }
    };

    loadFavoritesData();
    window.addEventListener("favorites-updated", loadFavoritesData);
    return () =>
      window.removeEventListener("favorites-updated", loadFavoritesData);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await updateProfileAction(user.id, {
        name: formData.name,
        email: formData.email,
      });

      if (res.success && res.data) {
        if (formData.email !== user.email) {
          // Sync with Supabase Auth to ensure Google/Email logins match
          const { error: sbError } = await supabase.auth.updateUser({ email: formData.email });
          if (sbError) {
            toast.error("Auth Sync Error", { description: "Profile updated but auth sync failed: " + sbError.message });
          } else {
            toast.success("Verification Email Sent", { description: "Please check your new email to verify the change." });
          }
        }

        updateUser({
          name: res.data.name || "",
          email: res.data.email,
        });
        toast.success("Identity Updated", {
          description: "Your profile has been synchronized successfully.",
        });
      } else {
        toast.error("Update Failed", {
          description: res.error || "Check your details and try again.",
        });
      }
    } catch (err) {
      toast.error("Sync Error", {
        description: "Failed to reach the mall management servers.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = (shopId: string) => {
    const filtered = favIds.filter((id) => id !== shopId);
    localStorage.setItem("sr_mall_favorites", JSON.stringify(filtered));
    setFavIds(filtered);
    window.dispatchEvent(new Event("favorites-updated"));
    toast.success("Gallery Updated", {
      description: "Item removed from your curated collection.",
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingImage(true);
    try {
      const { uploadAvatarAction } = await import("@/app/actions/auth");
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await uploadAvatarAction(user.id, formData);
      if (res.success && res.data) {
        updateUser({
          ...user,
          avatarUrl: res.data.avatarUrl
        } as any);
        toast.success("Profile Image Updated");
      } else {
        toast.error("Upload Failed", { description: res.error });
      }
    } catch (err) {
      toast.error("Error", { description: "Failed to upload image." });
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!isAuthenticated) return null;

  const favoriteShops = allShops.filter((s) => favIds.includes(s.id));

  return (
    <div
      className={clsx(
        "min-h-screen",
        "bg-slate-50",
        "dark:bg-black",
        "selection:bg-primary",
        "selection:text-white",
      )}
    >
      <Navbar />

      <main className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:gap-3 transition-all"
              >
                <ArrowLeft size={14} /> Back to Mall
              </Link>
              <h1 className="text-4xl sm:text-6xl font-black text-charcoal dark:text-white tracking-tighter uppercase leading-none">
                My{" "}
                <span className="text-slate-300 dark:text-zinc-800">
                  Profile.
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-lg">
                Manage your identity, security, and curated mall experiences.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                  Membership Rank
                </p>
                <div className="px-5 py-2 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs font-black text-primary uppercase tracking-widest italic">
                    SR Elite Club
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Controls */}
            <aside className="lg:col-span-1 flex flex-col gap-4">
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center font-black text-3xl shadow-2xl shadow-primary/30 ring-4 ring-primary/10 overflow-hidden relative">
                      {(user as any)?.avatarUrl ? (
                        <img src={(user as any).avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        user?.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <label className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-charcoal dark:bg-white text-white dark:text-black flex items-center justify-center border-4 border-white dark:border-zinc-900 hover:scale-110 transition-transform cursor-pointer">
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} />
                      {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    </label>
                  </div>
                  <h3 className="text-lg font-black text-charcoal dark:text-white text-center line-clamp-1">
                    {user?.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-1 text-center truncate w-full">
                    {user?.email}
                  </p>

                  <div className="mt-6 flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-600 rounded-full border border-green-100 dark:border-green-900/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Active Individual
                    </span>
                  </div>
                </div>

                {/* Decorative Accents */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-12 translate-x-12"></div>
              </div>

              <nav className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-[2rem] p-3 border border-slate-100 dark:border-white/5 shadow-sm">
                {[
                  { id: "general", label: "Identity Settings", icon: User },
                  { id: "security", label: "Safe & Secure", icon: Lock },
                  { id: "favorites", label: "My Favorites", icon: Heart },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={clsx(
                      "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border",
                      activeTab === tab.id
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105 z-10"
                        : "bg-transparent text-slate-500 dark:text-zinc-500 border-transparent hover:bg-white dark:hover:bg-white/5",
                    )}
                  >
                    <tab.icon
                      size={16}
                      className={
                        activeTab === tab.id ? "text-white" : "text-slate-400"
                      }
                    />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-4 px-8 py-5 rounded-[2rem] bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-100 dark:border-red-900/20 hover:bg-red-600 hover:text-white transition-all group/logout shadow-sm hover:shadow-red-200 dark:shadow-none"
              >
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-900 group-hover/logout:bg-red-500 flex items-center justify-center transition-all">
                  <LogOut size={18} className="group-hover/logout:text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">
                    Sign Out
                  </p>
                  <p className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">
                    Terminate Session
                  </p>
                </div>
              </button>

              {(user?.role === "CUSTOMER" || user?.role === "USER") && (
                <button
                  onClick={() => setIsMerchantModalOpen(true)}
                  className="w-full flex items-center gap-4 px-8 py-6 rounded-[2.5rem] bg-primary text-white hover:bg-primary-hover transition-all group/partner shadow-xl shadow-primary/20 active:scale-95 mt-4"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center transition-all">
                    <Store size={18} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">
                      Become a Partner
                    </p>
                    <p className="text-[9px] font-bold opacity-80 uppercase tracking-tighter text-white/70">
                      Join the Ecosystem
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="ml-auto opacity-40 group-hover:translate-x-1 transition-transform"
                  />
                </button>
              )}
            </aside>

            {/* Main Interactive Canvas */}
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 sm:p-12 border border-slate-100 dark:border-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none min-h-[600px] flex flex-col">
                {/* Tab Contents */}
                {activeTab === "general" && (
                  <form
                    onSubmit={handleUpdateProfile}
                    className="flex-1 animate-fade-in"
                  >
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Identity Management
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                          Full Legal Name
                        </label>
                        <div className="relative group/input">
                          <User
                            size={18}
                            className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                          />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                            placeholder="E.g. Alexander Richards"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                          Email Address
                        </label>
                        <div className="relative group/input">
                          <Mail
                            size={18}
                            className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                          />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                email: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                            placeholder="alex@example.com"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const { error } = await supabase.auth.signInWithOAuth({
                              provider: 'google',
                              options: {
                                redirectTo: `${window.location.origin}/auth/callback`,
                                flowType: 'pkce',
                              }
                            });
                            if (error) {
                              toast.error("Connection Failed", { description: error.message });
                            }
                          }}
                          className="mt-2 text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          Link Google (Gmail) Account
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                          Contact Protocol
                        </label>
                        <div className="relative group/input">
                          <Phone
                            size={18}
                            className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-primary transition-colors"
                          />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                            placeholder="+63 900 000 0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                          Access Tier
                        </label>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-2xl py-4 px-6 text-xs font-black text-primary uppercase tracking-widest border border-slate-200 dark:border-white/5">
                          Verified {user?.role || "CUSTOMER"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-3xl flex items-start gap-4">
                      <Shield size={20} className="text-primary mt-1" />
                      <div>
                        <h4 className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight">
                          Identity Verification
                        </h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                          Updating your primary email frequency requires
                          re-validation of your communication protocols. Ensure
                          your information is legally accurate.
                        </p>
                      </div>
                    </div>

                    <div className="pt-16 mt-auto flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center gap-3 px-12 py-5 bg-charcoal dark:bg-white text-white dark:text-black rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-primary dark:hover:bg-primary dark:hover:text-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          <Save size={20} />
                        )}
                        Sync Profile Changes
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === "security" && (
                  <div className="flex-1 animate-fade-in">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-blue-500 rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Vault Security
                      </h2>
                    </div>

                    <div className="space-y-8 max-w-xl">
                      <div className="p-8 bg-slate-50 dark:bg-black/40 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between mb-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                              Primary Channel
                            </p>
                            <h4 className="text-sm font-bold text-charcoal dark:text-white uppercase tracking-widest">
                              Master Key Password
                            </h4>
                          </div>
                          <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm border border-slate-100 dark:border-white/10 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Lock size={20} />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-8">
                          Update your cryptographic access token to maintain
                          unauthorized access protection.
                        </p>
                        <button className="w-full py-4 bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl text-[10px] font-black text-charcoal dark:text-white uppercase tracking-widest hover:border-blue-500 transition-all">
                          Request Recovery Sequence
                        </button>
                      </div>

                      <div className="p-8 bg-red-50 dark:bg-red-950/20 rounded-[2.5rem] border border-red-100 dark:border-red-900/10">
                        <div className="flex items-center gap-4 mb-4">
                          <AlertCircle
                            className="text-red-500 shrink-0"
                            size={24}
                          />
                          <h4 className="text-sm font-black text-red-600 uppercase tracking-widest leading-none">
                            Termination Zone
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic mb-8">
                          Permanently purging your SR Mall record will result in
                          total loss of history, analytics, and curated
                          experiences.
                        </p>
                        <button className="inline-flex items-center gap-3 text-[10px] font-black text-red-500 uppercase tracking-[0.2em] hover:text-red-700 transition-all">
                          Initiate Global Deletion <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "favorites" && (
                  <div className="flex-1 animate-fade-in">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Personal Gallery
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {isLoadingFavs ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4">
                          <Loader2
                            className="animate-spin text-primary"
                            size={40}
                          />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Synchronizing Gallery...
                          </p>
                        </div>
                      ) : favoriteShops.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-slate-50/50 dark:bg-black/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/5 space-y-6">
                          <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-3xl mx-auto flex items-center justify-center text-slate-200 dark:text-white/5 shadow-inner border border-slate-100 dark:border-white/10">
                            <Heart size={40} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tighter">
                              Your curation is empty.
                            </p>
                            <p className="text-xs text-slate-400 font-medium">
                              Heart your favorite shops in the directory to add
                              them here.
                            </p>
                          </div>
                          <Link
                            href="/#directory"
                            className="inline-flex items-center gap-3 px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-xl shadow-primary/20"
                          >
                            Explore Directory <ArrowRight size={14} />
                          </Link>
                        </div>
                      ) : (
                        favoriteShops.map((shop) => (
                          <div
                            key={shop.id}
                            className="group/shop flex flex-col bg-white dark:bg-zinc-800 rounded-3xl overflow-hidden border border-slate-100 dark:border-white/5 hover:border-primary transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 relative"
                          >
                            <Link
                              href={`/shop/${shop.id}`}
                              className="absolute inset-0 z-0"
                            ></Link>
                            <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-black p-4 flex items-center justify-center relative z-0">
                              <img
                                src={shop.logo_url || "/images/placeholder.jpg"}
                                alt={shop.shop_name}
                                className="h-20 w-auto object-contain drop-shadow-lg group-hover/shop:scale-110 transition-transform duration-500"
                              />
                            </div>
                            <div className="p-5 flex-1 relative z-10 bg-white dark:bg-zinc-800">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                  {shop.category}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveFavorite(shop.id);
                                  }}
                                  className="p-1.5 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-lg opacity-0 group-hover/shop:opacity-100 transition-all hover:scale-110"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <h4 className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight truncate mb-1">
                                {shop.shop_name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <MapPin size={10} /> Unit {shop.unit_id}
                              </p>
                            </div>
                            <div className="px-5 py-3 border-t border-slate-50 dark:border-white/5 flex items-center justify-between relative z-10 bg-white dark:bg-zinc-800">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                                View House Profile
                              </span>
                              <ArrowRight
                                size={12}
                                className="text-slate-300 group-hover/shop:translate-x-1 group-hover/shop:text-primary transition-all"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <MerchantApplicationModal
        isOpen={isMerchantModalOpen}
        onClose={() => setIsMerchantModalOpen(false)}
      />
    </div>
  );
}
