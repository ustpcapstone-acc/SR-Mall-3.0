"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  Megaphone,
  PlusCircle,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  LogOut,
  Store,
  Camera,
  Loader2,
  Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";
import { MerchantApplicationModal } from "@/components/merchant-application-modal";
import { createLostAndFoundItem, getLostAndFoundItems } from "@/app/actions/lost-and-found";
import { uploadAvatarAction } from "@/app/actions/auth";
import { ChatBox } from "@/components/chat-box";

export default function LostAndFoundPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"found" | "lost" | "report">("found");
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  
  const [foundItems, setFoundItems] = useState<any[]>([]);
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({
    type: "FOUND" as "LOST" | "FOUND",
    title: "",
    date: "",
    location: "",
    imageUrl: ""
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadItems = async () => {
    setIsLoadingItems(true);
    const foundRes = await getLostAndFoundItems("FOUND");
    if (foundRes.success && foundRes.data) {
      setFoundItems(foundRes.data);
    }
    const lostRes = await getLostAndFoundItems("LOST");
    if (lostRes.success && lostRes.data) {
      setLostItems(lostRes.data);
    }
    setIsLoadingItems(false);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    } else {
      loadItems();
    }
  }, [isAuthenticated, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // reusing avatar action for simple image upload
      const res = await uploadAvatarAction(user.id, formData);
      if (res.success && res.data) {
        setReportForm({ ...reportForm, imageUrl: res.data.avatarUrl });
        toast.success("Image Uploaded");
      }
    } catch(err) {
      toast.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createLostAndFoundItem({
      type: reportForm.type,
      title: reportForm.title,
      date: reportForm.date,
      location: reportForm.location,
      imageUrl: reportForm.imageUrl,
      userId: user?.id,
    });
    if (res.success) {
      toast.success("Report Submitted", { description: "We have received your report." });
      setReportForm({ type: "FOUND", title: "", date: "", location: "", imageUrl: "" });
      setActiveTab(reportForm.type === "FOUND" ? "found" : "lost");
      loadItems();
    } else {
      toast.error("Failed to submit", { description: res.error });
    }
    setIsSubmitting(false);
  };

  if (!isAuthenticated) return null;

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
                Lost &{" "}
                <span className="text-slate-300 dark:text-zinc-800">
                  Found.
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-lg">
                Report lost items, or find something you misplaced in the mall.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                  Mall Services
                </p>
                <div className="px-5 py-2 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs font-black text-primary uppercase tracking-widest italic">
                    Assistance Desk
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
                  { id: "found", label: "Found Items", icon: Package },
                  { id: "lost", label: "Lost Items", icon: Search },
                  { id: "report", label: "Report Item", icon: Megaphone },
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
                
                {/* Found Items Tab */}
                {activeTab === "found" && (
                  <div className="flex-1 animate-fade-in">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Found Items
                      </h2>
                    </div>
                    
                    <div className="space-y-4">
                      {isLoadingItems ? (
                        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-primary" size={32}/></div>
                      ) : foundItems.length > 0 ? (
                        foundItems.map((item) => (
                          <div key={item.id} className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center hover:border-primary/30 transition-all">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt={item.title} className="w-24 h-24 rounded-2xl object-cover shrink-0 bg-white" />
                            )}
                            <div className="space-y-2 flex-1">
                              <h3 className="text-lg font-black text-charcoal dark:text-white tracking-tight">{item.title}</h3>
                              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><MapPin size={14}/> {item.location}</span>
                                <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(item.date).toLocaleDateString()}</span>
                                {item.time && <span className="flex items-center gap-1.5"><Clock size={14}/> {item.time}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-3 shrink-0">
                              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg">
                                {item.status}
                              </span>
                              <button 
                                onClick={() => {
                                  setChatMessage(`Hello! I would like to claim the found item: ${item.title}`);
                                  setIsChatOpen(true);
                                }}
                                className="text-xs font-black text-charcoal dark:text-white uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2"
                              >
                                Claim <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-20 text-center text-slate-400">
                          <Package size={48} className="mx-auto mb-4 opacity-20" />
                          <p className="text-sm font-bold uppercase tracking-widest">No found items reported.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lost Items Tab */}
                {activeTab === "lost" && (
                  <div className="flex-1 animate-fade-in">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-orange-500 rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Lost Items
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {isLoadingItems ? (
                        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" size={32}/></div>
                      ) : lostItems.length > 0 ? (
                        lostItems.map((item) => (
                          <div key={item.id} className="p-6 bg-orange-50 dark:bg-orange-950/10 rounded-3xl border border-orange-100 dark:border-orange-900/20 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt={item.title} className="w-24 h-24 rounded-2xl object-cover shrink-0 bg-white" />
                            )}
                            <div className="space-y-2 flex-1">
                              <h3 className="text-lg font-black text-charcoal dark:text-white tracking-tight">{item.title}</h3>
                              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><MapPin size={14}/> {item.location}</span>
                                <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(item.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-3 shrink-0">
                              <span className="px-3 py-1 bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                {item.status}
                              </span>
                              <button 
                                onClick={() => {
                                  setChatMessage(`Hello! I have information regarding the lost item: ${item.title}`);
                                  setIsChatOpen(true);
                                }}
                                className="text-xs font-black text-charcoal dark:text-white uppercase tracking-widest hover:text-orange-500 transition-colors flex items-center gap-2"
                              >
                                Provide Info <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-20 text-center text-slate-400">
                          <Search size={48} className="mx-auto mb-4 opacity-20" />
                          <p className="text-sm font-bold uppercase tracking-widest">No lost items reported.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Report Tab */}
                {activeTab === "report" && (
                  <div className="flex-1 animate-fade-in">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="w-1.5 h-8 bg-blue-500 rounded-full"></div>
                      <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                        Report Item
                      </h2>
                    </div>

                    <div className="max-w-2xl">
                      <form className="space-y-6" onSubmit={handleReportSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2 col-span-full">
                            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                              Report Type
                            </label>
                            <select 
                              value={reportForm.type}
                              onChange={e => setReportForm({...reportForm, type: e.target.value as any})}
                              className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all">
                              <option value="lost">I lost something</option>
                              <option value="found">I found something</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2 col-span-full">
                            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                              Item Description
                            </label>
                            <input
                              type="text"
                              required
                              value={reportForm.title}
                              onChange={e => setReportForm({...reportForm, title: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                              placeholder="E.g. Black leather wallet with ID"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                              Date
                            </label>
                            <input
                              type="date"
                              required
                              value={reportForm.date}
                              onChange={e => setReportForm({...reportForm, date: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                              Location
                            </label>
                            <input
                              type="text"
                              required
                              value={reportForm.location}
                              onChange={e => setReportForm({...reportForm, location: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-black border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-charcoal dark:text-white focus:outline-none focus:border-primary transition-all"
                              placeholder="E.g. Food Court"
                            />
                          </div>

                          <div className="space-y-2 col-span-full">
                            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-1">
                              Image (Optional)
                            </label>
                            <div className="flex items-center gap-4">
                              {reportForm.imageUrl && (
                                <img src={reportForm.imageUrl} className="w-16 h-16 rounded-xl object-cover" />
                              )}
                              <label className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors text-xs font-bold">
                                {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                                Upload Image
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="pt-8">
                          <button
                            type="submit"
                            disabled={isSubmitting || uploadingImage}
                            className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                          >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />} 
                            Submit Report
                          </button>
                        </div>
                      </form>
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
      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialRecipient="admin"
        initialMessage={chatMessage}
      />
    </div>
  );
}
