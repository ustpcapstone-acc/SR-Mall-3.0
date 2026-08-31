"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getPublicViewConfigAction,
  updatePublicViewConfigAction,
  getAllCarouselItemsAction,
  createCarouselItemAction,
  updateCarouselItemAction,
  deleteCarouselItemAction,
  toggleCarouselItemAction,
} from "@/app/actions/cms";
import { getLostAndFoundItems, updateLostAndFoundItemStatus, createLostAndFoundItem } from "@/app/actions/lost-and-found";
import { getApprovedEventsWithImagesAction, updateInquiryImageAction, deleteInquiryAction, updateEventInfoAction } from "@/app/actions/inquiry";
import { Info } from "lucide-react";
import { getAllPostSalesAction, deleteAdminPostSaleAction, updateAdminPostSaleAction } from "@/app/actions/tenant";
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Settings,
  Layout,
  Monitor,
  Layers,
  Save,
  X,
  ChevronRight,
  Sparkles,
  Globe,
  Calendar as CalendarIcon,
  Search,
} from "lucide-react";
import clsx from "clsx";

interface CarouselItem {
  id: string;
  adminId: string | null;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  priority: number;
  startDate: Date | null;
  endDate: Date | null;
  storageKey?: string | null;
}

interface PublicViewConfig {
  logoUrl: string | null;
  companyName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBgUrl: string | null;
  heroBadge: string | null;
  heroOverlayDark: number;
  aboutTitle: string | null;
  aboutDescription: string | null;
  aboutImageUrl: string | null;
  videoTitle: string | null;
  videoDescription: string | null;
  featuredVideoUrl: string | null;
  contactTitle: string | null;
  contactDescription: string | null;
}

export default function PublicViewCMSPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const [config, setConfig] = useState<PublicViewConfig>({
    logoUrl: "",
    companyName: "SR MALL",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    heroTitle: "",
    heroSubtitle: "",
    heroBgUrl: "",
    heroBadge: "",
    heroOverlayDark: 50,
    aboutTitle: "",
    aboutDescription: "",
    aboutImageUrl: "",
    videoTitle: "",
    videoDescription: "",
    featuredVideoUrl: "",
    contactTitle: "",
    contactDescription: "",
  });

  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [isCarouselModalOpen, setIsCarouselModalOpen] = useState(false);
  const [editingCarouselItem, setEditingCarouselItem] =
    useState<CarouselItem | null>(null);
  const [carouselForm, setCarouselForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    priority: 0,
    isActive: true,
    storageKey: "",
  });

  const [approvedEvents, setApprovedEvents] = useState<any[]>([]);
  const [allPostSales, setAllPostSales] = useState<any[]>([]);
  const [lostAndFoundItems, setLostAndFoundItems] = useState<any[]>([]);

  const [isLostFoundModalOpen, setIsLostFoundModalOpen] = useState(false);
  const [lostFoundForm, setLostFoundForm] = useState({
    type: "FOUND" as "LOST" | "FOUND",
    title: "",
    description: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    imageUrl: "",
  });

  const [isEventInfoModalOpen, setIsEventInfoModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventInfoForm, setEventInfoForm] = useState({
    fbAccount: "",
    contactNumber: "",
  });

  const openEventInfoModal = (ev: any) => {
    setEditingEventId(ev.id);
    setEventInfoForm({
      fbAccount: ev.fbAccount || "",
      contactNumber: ev.contactNumber || "",
    });
    setIsEventInfoModalOpen(true);
  };

  const handleUpdateEventInfo = async () => {
    if (!editingEventId) return;
    try {
      const res = await updateEventInfoAction(
        editingEventId,
        eventInfoForm.fbAccount,
        eventInfoForm.contactNumber
      );
      if (res.success) {
        showToast("Event info updated successfully", "success");
        setApprovedEvents((prev) =>
          prev.map((ev) =>
            ev.id === editingEventId
              ? { ...ev, fbAccount: eventInfoForm.fbAccount, contactNumber: eventInfoForm.contactNumber }
              : ev
          )
        );
        setIsEventInfoModalOpen(false);
      } else {
        showToast(res.error || "Failed to update info", "error");
      }
    } catch (e) {
      showToast("Error updating event info", "error");
    }
  };

  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configData, carouselData, eventsData, lostFoundData] = await Promise.all([
          getPublicViewConfigAction(),
          getAllCarouselItemsAction(),
          getApprovedEventsWithImagesAction(),
          getLostAndFoundItems(),
        ]);

        if (configData) {
          setConfig((prev) => ({
            ...prev,
            ...configData,
            companyName: configData.companyName || "SR MALL",
          }));
        }

        setCarouselItems(carouselData || []);
        if (eventsData?.success) {
          setApprovedEvents(eventsData.data || []);
        }
        if (lostFoundData?.success) {
          setLostAndFoundItems(lostFoundData.data || []);
        }
        const postSalesData = await getAllPostSalesAction();
        if (postSalesData?.success) {
          setAllPostSales(postSalesData.data || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConfigChange = (
    field: keyof PublicViewConfig,
    value: string | number,
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    field: keyof PublicViewConfig,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "web-cms");

      handleConfigChange(field, result.url);
      showToast("Asset uploaded and synchronized", "success");
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Failed to upload media asset", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCarouselUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "carousel");

      setCarouselForm((prev) => ({
        ...prev,
        imageUrl: result.url,
        storageKey: result.key,
      }));
      showToast("Carousel asset synchronized", "success");
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Failed to upload carousel media", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEventImageUpload = async (
    eventId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "inquiries");

      const updateResult = await updateInquiryImageAction(eventId, result.url, result.key);
      if (updateResult.success) {
        setApprovedEvents((prev) =>
          prev.map((ev) => (ev.id === eventId ? { ...ev, imageUrl: result.url, storageKey: result.key } : ev))
        );
        showToast("Event image updated successfully", "success");
      } else {
        showToast("Failed to update event image in DB", "error");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Failed to upload event media", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to completely delete this event inquiry?")) return;

    setIsSaving(true);
    try {
      const result = await deleteInquiryAction(id);
      if (result.success) {
        setApprovedEvents((prev: any[]) => prev.filter((ev: any) => ev.id !== id));
        showToast("Event purged successfully", "success");
      } else {
        showToast("Failed to delete event", "error");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      showToast("Failed to purge event", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePostSale = async (tenantId: string, saleId: string) => {
    if (!confirm("Are you sure you want to delete this tenant's post sale?")) return;
    setIsSaving(true);
    try {
      const result = await deleteAdminPostSaleAction(tenantId, saleId);
      if (result.success) {
        setAllPostSales((prev: any[]) => prev.filter((s: any) => s.id !== saleId));
        showToast("Post sale deleted successfully", "success");
      } else {
        showToast("Failed to delete post sale", "error");
      }
    } catch (error) {
      console.error("Error deleting post sale:", error);
      showToast("Failed to delete post sale", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePostSaleImage = async (tenantId: string, saleId: string, currentTitle: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "postsales");

      const updateResult = await updateAdminPostSaleAction(tenantId, saleId, result.url, currentTitle);
      if (updateResult.success) {
        setAllPostSales((prev: any[]) =>
          prev.map((s: any) => (s.id === saleId ? { ...s, image_url: result.url } : s))
        );
        showToast("Post sale media updated", "success");
      } else {
        showToast("Failed to update post sale media", "error");
      }
    } catch (error) {
      console.error("Error updating media:", error);
      showToast("Failed to upload media", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await updatePublicViewConfigAction(config);
      showToast("Global configuration synchronized!", "success");
    } catch (error) {
      console.error("Error saving config:", error);
      showToast("Failed to save configuration", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsSaving(true);
    try {
      const res = await updateLostAndFoundItemStatus(id, newStatus);
      if (res.success) {
        setLostAndFoundItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
        );
        showToast("Status updated", "success");
      } else {
        showToast("Failed to update status", "error");
      }
    } catch (error) {
      showToast("Error updating status", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLostFoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "lostfound");
      setLostFoundForm(prev => ({ ...prev, imageUrl: result.url }));
      showToast("Media uploaded", "success");
    } catch(err) {
      showToast("Upload failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLostFound = async () => {
    setIsSaving(true);
    try {
      const res = await createLostAndFoundItem({
        ...lostFoundForm,
      });
      if (res.success && res.data) {
        setLostAndFoundItems(prev => [res.data, ...prev]);
        setIsLostFoundModalOpen(false);
        setLostFoundForm({ type: "FOUND", title: "", description: "", location: "", date: new Date().toISOString().split("T")[0], imageUrl: "" });
        showToast("Item posted successfully!", "success");
      } else {
        showToast(res.error || "Failed to post item", "error");
      }
    } catch (e) {
      showToast("Error creating item", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const openCarouselModal = (item: CarouselItem | null = null) => {
    setEditingCarouselItem(item);
    setCarouselForm({
      title: item?.title || "",
      description: item?.description || "",
      imageUrl: item?.imageUrl || "",
      linkUrl: item?.linkUrl || "",
      priority: item?.priority || 0,
      isActive: item?.isActive ?? true,
      storageKey: item?.storageKey || "",
    });
    setIsCarouselModalOpen(true);
  };

  const closeCarouselModal = () => {
    setIsCarouselModalOpen(false);
    setEditingCarouselItem(null);
  };

  const handleCreateCarouselItem = async () => {
    setIsSaving(true);
    try {
      const newItem = await createCarouselItemAction(carouselForm);
      setCarouselItems((prev: any[]) => [...prev, newItem]);
      closeCarouselModal();
      showToast("Billboard item deployed!", "success");
    } catch (error) {
      console.error("Error creating carousel item:", error);
      showToast("Failed to deploy carousel item", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCarouselItem = async () => {
    if (!editingCarouselItem) return;

    setIsSaving(true);
    try {
      const updatedItem = await updateCarouselItemAction(
        editingCarouselItem.id,
        carouselForm,
      );
      setCarouselItems((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingCarouselItem.id ? updatedItem : item,
        ),
      );
      closeCarouselModal();
      showToast("Billboard content updated!", "success");
    } catch (error) {
      console.error("Error updating carousel item:", error);
      showToast("Failed to update billboard", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCarouselItem = async (id: string) => {
    if (!confirm("Are you sure you want to purge this content?")) return;

    setIsSaving(true);
    try {
      await deleteCarouselItemAction(id);
      setCarouselItems((prev: any[]) => prev.filter((item: any) => item.id !== id));
      showToast("Content purged from system", "success");
    } catch (error) {
      console.error("Error deleting carousel item:", error);
      showToast("Failed to purge content", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCarouselItem = async (id: string) => {
    setIsSaving(true);
    try {
      const updatedItem = await toggleCarouselItemAction(id);
      setCarouselItems((prev: any[]) =>
        prev.map((item: any) => (item.id === id ? updatedItem : item)),
      );
      showToast(
        updatedItem.isActive ? "Segment is now live" : "Segment archived",
        "success",
      );
    } catch (error) {
      console.error("Error toggling carousel item:", error);
      showToast("Visibility toggle failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={20} className="text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
          Initializing Command Center...
        </p>
      </div>
    );
  }

  const navItems = [
    {
      id: "general",
      label: "General Identity",
      icon: Globe,
      desc: "Naming & Contact",
    },
    {
      id: "postsales",
      label: "Shop Sales Monitoring",
      icon: Monitor,
      desc: "Manage Tenant Sales Posts",
    },
    {
      id: "content",
      label: "Brand Narratives",
      icon: Layers,
      desc: "About & Video",
    },
    { id: "carousel", label: "Billboards", icon: Layout, desc: "Ad Sliders" },
    { id: "events", label: "Upcoming Events", icon: CalendarIcon, desc: "Approved Event Images" },
    { id: "lostfound", label: "Lost & Found", icon: Search, desc: "Manage reported items" },
  ];

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <Sparkles size={12} /> System Administrator v3.2
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Content <span className="text-primary">Management.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-xl text-lg">
            Synchronize your public presence. Manage imagery, narratives, and
            digital billboards from a centralized command center.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="/public-view"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all border border-slate-200 dark:border-white/5 shadow-sm active:scale-95"
          >
            <ExternalLink size={16} /> Live Preview
          </a>
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-4 bg-charcoal dark:bg-white text-white dark:text-charcoal font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-charcoal/20 dark:shadow-white/10 hover:scale-[1.02] transition-all disabled:opacity-50 active:scale-95"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Deploy Changes
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        {/* Sidebar Navigation */}
        <aside className="xl:col-span-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                "w-full flex items-center gap-4 p-5 rounded-3xl transition-all border text-left active:scale-[0.98]",
                activeTab === item.id
                  ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                  : "bg-white/50 dark:bg-white/5 border-transparent text-slate-500 hover:bg-white dark:hover:bg-white/10 hover:border-slate-200 dark:hover:border-white/10",
              )}
            >
              <item.icon
                size={20}
                className={clsx(
                  activeTab === item.id ? "opacity-100" : "opacity-40",
                )}
              />
              <div>
                <p className="font-black text-[11px] uppercase tracking-widest leading-none">
                  {item.label}
                </p>
                <p
                  className={clsx(
                    "text-[10px] font-medium mt-1 uppercase opacity-60",
                    activeTab === item.id ? "text-white/80" : "text-slate-400",
                  )}
                >
                  {item.desc}
                </p>
              </div>
              {activeTab === item.id && (
                <ChevronRight size={16} className="ml-auto opacity-60" />
              )}
            </button>
          ))}

          <div className="mt-12 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle size={18} />
              <span className="font-black text-[10px] uppercase tracking-widest">
                Global Warning
              </span>
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400/80 font-bold leading-relaxed uppercase">
              Changes deployed here reflect instantly on the public website.
              Preview your changes before final synchronization.
            </p>
          </div>
        </aside>

        {/* Dynamic Workspace */}
        <main className="xl:col-span-9 animate-fade-in">
          {activeTab === "general" && (
            <div className="space-y-10">
              <SectionHeader
                icon={Globe}
                title="Identity & Connectivity"
                sub="Define how the world sees and contacts your brand."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Logo Upload Panel */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 p-8 rounded-[2.5rem] shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">
                    Brand Mark (Logo)
                  </p>
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 bg-slate-100 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center overflow-hidden group relative">
                      {config.logoUrl ? (
                        <img
                          src={config.logoUrl}
                          className="w-full h-full object-contain p-4 transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-slate-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <Plus size={24} className="text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload("logoUrl", e)}
                        />
                      </label>
                    </div>
                    <div className="flex-1 space-y-4">
                      <input
                        type="text"
                        placeholder="Public Resource URL"
                        value={config.logoUrl ?? ""}
                        onChange={(e) =>
                          handleConfigChange("logoUrl", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm font-bold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <p className="text-[10px] items-center gap-2 flex text-slate-400 font-bold uppercase tracking-widest leading-none">
                        <Sparkles size={12} className="text-primary" />{" "}
                        Preferred Format: 512x512 Transparent PNG
                      </p>
                    </div>
                  </div>
                </div>

                <InputGroup label="Entity Name" icon={Settings}>
                  <input
                    value={config.companyName ?? ""}
                    onChange={(e) =>
                      handleConfigChange("companyName", e.target.value)
                    }
                    className="cms-input"
                    placeholder="SR MALL"
                  />
                </InputGroup>

                <InputGroup label="Administrative Email" icon={Globe}>
                  <input
                    value={config.contactEmail ?? ""}
                    onChange={(e) =>
                      handleConfigChange("contactEmail", e.target.value)
                    }
                    className="cms-input"
                    placeholder="jerickaradilla76@gmail.com"
                  />
                </InputGroup>

                <InputGroup label="Connectivity Line" icon={Monitor}>
                  <input
                    value={config.contactPhone ?? ""}
                    onChange={(e) =>
                      handleConfigChange("contactPhone", e.target.value)
                    }
                    className="cms-input"
                    placeholder="+63 900 000 0000"
                  />
                </InputGroup>

                <div className="md:col-span-2">
                  <InputGroup label="Global Headquarter Address" icon={Layers}>
                    <textarea
                      value={config.contactAddress ?? ""}
                      onChange={(e) =>
                        handleConfigChange("contactAddress", e.target.value)
                      }
                      className="cms-input min-h-[100px] resize-none"
                      placeholder="Floor 4, SR Mall Complex..."
                    />
                  </InputGroup>
                </div>
              </div>
            </div>
          )}

          {activeTab === "postsales" && (
            <div className="space-y-10">
              <SectionHeader
                icon={Monitor}
                title="Shop Sales Monitoring"
                sub="Manage tenant promotional posts and sales announcements."
              />

              <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm">
                {allPostSales.length === 0 ? (
                  <div className="py-20 text-center">
                    <Monitor size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">
                      No Active Posts
                    </h3>
                    <p className="text-slate-500 mt-2 font-medium">
                      Tenants haven't posted any sales yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allPostSales.map((sale: any) => (
                      <div key={sale.id} className="group relative bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
                        <div className="aspect-video relative overflow-hidden bg-black/5">
                          {sale.image_url && (sale.image_url.startsWith("data:video") || sale.image_url.match(/\.(mp4|webm|ogg)$/i)) ? (
                            <video src={sale.image_url} className="w-full h-full object-cover" autoPlay muted loop />
                          ) : sale.image_url ? (
                            <img src={sale.image_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center">
                              <ImageIcon size={32} className="text-slate-400" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-white/10">
                            {sale.shopName}
                          </div>

                          {/* Admin Media Update */}
                          <label className="absolute top-3 right-3 p-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30">
                            <ImageIcon size={14} />
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => handleUpdatePostSaleImage(sale.tenantId, sale.id, sale.title, e)}
                            />
                          </label>
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <h4 className="font-black text-charcoal dark:text-white uppercase tracking-tight text-sm mb-2">{sale.title}</h4>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {new Date(sale.date || new Date()).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handleDeletePostSale(sale.tenantId, sale.id)}
                              className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                              title="Delete Post"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "content" && (
            <div className="space-y-12">
              <div className="space-y-10">
                <SectionHeader
                  icon={Globe}
                  title="About Our Vision"
                  sub="Tell the story behind the mall."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
                      Visionary Asset
                    </p>
                    <div className="aspect-[4/5] bg-slate-100 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center overflow-hidden relative group">
                      {config.aboutImageUrl ? (
                        <img
                          src={config.aboutImageUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-slate-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <Edit size={24} className="text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleImageUpload("aboutImageUrl", e)
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-6">
                    <InputGroup label="Section Headline" icon={Layers}>
                      <input
                        value={config.aboutTitle ?? ""}
                        onChange={(e) =>
                          handleConfigChange("aboutTitle", e.target.value)
                        }
                        className="cms-input"
                        placeholder="Our Legacy"
                      />
                    </InputGroup>
                    <InputGroup label="Narrative Text" icon={Globe}>
                      <textarea
                        value={config.aboutDescription ?? ""}
                        onChange={(e) =>
                          handleConfigChange("aboutDescription", e.target.value)
                        }
                        className="cms-input min-h-[220px] resize-none"
                        placeholder="Since 1995..."
                      />
                    </InputGroup>
                  </div>
                </div>
              </div>

              <div className="space-y-10 pt-10 border-t border-slate-100 dark:border-white/5">
                <SectionHeader
                  icon={Monitor}
                  title="Media Engagement"
                  sub="Configure your featured cinematic asset."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 p-8 rounded-[2.5rem] shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">
                      Cinematic Asset (Video)
                    </p>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-48 aspect-video bg-slate-100 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center overflow-hidden group relative">
                        <video
                          key={config.featuredVideoUrl || "default"}
                          src={config.featuredVideoUrl || "/vid/Download.mp4"}
                          className="w-full h-full object-cover"
                          controls
                        />
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <Plus size={24} className="text-white" />
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload("featuredVideoUrl", e)}
                          />
                        </label>
                      </div>
                      <div className="flex-1 space-y-4 w-full">
                        <InputGroup label="Cinema URL (Direct Video Link)" icon={Globe}>
                          <input
                            value={config.featuredVideoUrl ?? ""}
                            onChange={(e) =>
                              handleConfigChange("featuredVideoUrl", e.target.value)
                            }
                            className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm font-bold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="https://..."
                          />
                        </InputGroup>
                      </div>
                    </div>
                  </div>

                  <InputGroup label="Engagement Title" icon={Sparkles}>
                    <input
                      value={config.videoTitle ?? ""}
                      onChange={(e) =>
                        handleConfigChange("videoTitle", e.target.value)
                      }
                      className="cms-input"
                      placeholder="Discover Excellence"
                    />
                  </InputGroup>
                  <div className="md:col-span-1">
                    <InputGroup label="Contextual Subtext" icon={Layers}>
                      <input
                        value={config.videoDescription ?? ""}
                        onChange={(e) =>
                          handleConfigChange("videoDescription", e.target.value)
                        }
                        className="cms-input"
                        placeholder="A cinematic look at our latest developments."
                      />
                    </InputGroup>
                  </div>
                </div>
              </div>

              <div className="space-y-10 pt-10 border-t border-slate-100 dark:border-white/5">
                <SectionHeader
                  icon={Globe}
                  title="Footer Context"
                  sub="Information shown at the base of your site."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputGroup label="Footer Headline" icon={Layers}>
                    <input
                      value={config.contactTitle ?? ""}
                      onChange={(e) =>
                        handleConfigChange("contactTitle", e.target.value)
                      }
                      className="cms-input"
                      placeholder="Connect with Us"
                    />
                  </InputGroup>
                  <InputGroup label="Sign-off Message" icon={Globe}>
                    <input
                      value={config.contactDescription ?? ""}
                      onChange={(e) =>
                        handleConfigChange("contactDescription", e.target.value)
                      }
                      className="cms-input"
                      placeholder="Visit us daily from 10am to 10pm."
                    />
                  </InputGroup>
                </div>
              </div>
            </div>
          )}

          {activeTab === "carousel" && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <SectionHeader
                  icon={Layout}
                  title="Digital Billboards"
                  sub="Manage high-priority advertising banners."
                />
                <button
                  onClick={() => openCarouselModal()}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus size={16} /> New Asset
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                {carouselItems.length === 0 ? (
                  <div className="md:col-span-2 2xl:col-span-3 py-32 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] bg-white/50 dark:bg-white/5">
                    <ImageIcon
                      size={48}
                      className="text-slate-300 mx-auto mb-6"
                    />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                      No Active Billboards Found
                    </p>
                  </div>
                ) : (
                  carouselItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-xl transition-all"
                    >
                      <div className="aspect-[16/9] relative">
                        <img
                          src={item.imageUrl}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button
                            onClick={() => handleToggleCarouselItem(item.id)}
                            className={clsx(
                              "p-2.5 rounded-xl backdrop-blur-xl transition-all shadow-lg",
                              item.isActive
                                ? "bg-emerald-500 text-white"
                                : "bg-white/20 text-white",
                            )}
                          >
                            {item.isActive ? (
                              <Eye size={16} />
                            ) : (
                              <EyeOff size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => openCarouselModal(item)}
                            className="p-2.5 bg-white/20 backdrop-blur-xl text-white rounded-xl shadow-lg hover:bg-white/40 transition-all"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                        <div className="absolute bottom-4 left-4">
                          <span className="px-3 py-1 bg-charcoal text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                            {item.priority} Priority
                          </span>
                        </div>
                      </div>
                      <div className="p-8 space-y-2">
                        <h4 className="font-black text-charcoal dark:text-white uppercase tracking-tight line-clamp-1">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="pt-4 flex items-center justify-between">
                          <span
                            className={clsx(
                              "text-[10px] font-black uppercase tracking-widest",
                              item.isActive
                                ? "text-emerald-500"
                                : "text-slate-400",
                            )}
                          >
                            ● {item.isActive ? "Live Status" : "Draft Mode"}
                          </span>
                          <button
                            onClick={() => handleDeleteCarouselItem(item.id)}
                            className="text-red-500 opacity-40 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-xl"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div className="space-y-10">
              <SectionHeader
                icon={CalendarIcon}
                title="Upcoming Events"
                sub="Manage images for approved upcoming events."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {approvedEvents.length === 0 ? (
                  <div className="md:col-span-2 p-10 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-3xl flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No approved events found.
                  </div>
                ) : (
                  approvedEvents.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                          {ev.eventType}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {new Date(ev.eventDate).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => openEventInfoModal(ev)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Edit Event Info"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tight mb-6">
                        {ev.eventName || ev.eventType}
                      </h3>
                      <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-zinc-800 rounded-3xl overflow-hidden relative group">
                        {ev.imageUrl ? (
                          <img
                            src={ev.imageUrl}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <ImageIcon size={32} className="mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              No Image Provided
                            </span>
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm">
                          <div className="flex flex-col items-center">
                            <Plus size={24} className="text-white mb-2" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                              {ev.imageUrl ? "Update Image" : "Upload Image"}
                            </span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleEventImageUpload(ev.id, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "lostfound" && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <SectionHeader
                  icon={Search}
                  title="Lost & Found"
                  sub="Manage reported lost and found items."
                />
                <button
                  onClick={() => setIsLostFoundModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus size={16} /> New Item
                </button>
              </div>

              <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm">
                {lostAndFoundItems.length === 0 ? (
                  <div className="py-20 text-center">
                    <Search size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">
                      No Items Reported
                    </h3>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lostAndFoundItems.map((item: any) => (
                      <div key={item.id} className="group relative bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
                        <div className="aspect-video relative overflow-hidden bg-black/5">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center">
                              <ImageIcon size={32} className="text-slate-400" />
                            </div>
                          )}
                          <div className={clsx(
                            "absolute top-3 left-3 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-white/10",
                            item.type === "LOST" ? "bg-orange-500" : "bg-primary"
                          )}>
                            {item.type}
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <h4 className="font-black text-charcoal dark:text-white uppercase tracking-tight text-sm mb-1">{item.title}</h4>
                          <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4">{item.location} • {new Date(item.date).toLocaleDateString()}</p>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {item.status}
                            </span>
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                              className="bg-slate-100 dark:bg-zinc-700 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-bold px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="LOOKING">Looking</option>
                              <option value="RESOLVED">Resolved</option>
                              <option value="UNCLAIMED">Unclaimed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Carousel Modal */}
      {isCarouselModalOpen && (
        <div className="fixed inset-0 bg-charcoal/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                  Billboard <span className="text-primary">Architect.</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                  Configure asset visual and priority.
                </p>
              </div>
              <button
                onClick={closeCarouselModal}
                className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Billboard Title" icon={Layers}>
                  <input
                    value={carouselForm.title}
                    onChange={(e) =>
                      setCarouselForm((prev: any) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="cms-input"
                  />
                </InputGroup>
                <InputGroup label="Display Priority" icon={Plus}>
                  <input
                    type="number"
                    value={carouselForm.priority}
                    onChange={(e) =>
                      setCarouselForm((prev: any) => ({
                        ...prev,
                        priority: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="cms-input"
                  />
                </InputGroup>
                <div className="md:col-span-2">
                  <InputGroup label="Narrative Text" icon={Globe}>
                    <textarea
                      value={carouselForm.description}
                      onChange={(e) =>
                        setCarouselForm((prev: any) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="cms-input min-h-[80px] resize-none"
                    />
                  </InputGroup>
                </div>
                <div className="md:col-span-2">
                  <InputGroup label="Visual Asset URL" icon={Monitor}>
                    <div className="flex gap-4">
                      <input
                        value={carouselForm.imageUrl}
                        onChange={(e) =>
                          setCarouselForm((prev: any) => ({
                            ...prev,
                            imageUrl: e.target.value,
                          }))
                        }
                        className="cms-input flex-1"
                        placeholder="https://..."
                      />
                      <label className="shrink-0 p-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/20 transition-all">
                        <ImageIcon size={20} />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleCarouselUpload}
                        />
                      </label>
                    </div>
                  </InputGroup>
                </div>
                <InputGroup label="Action Link" icon={Sparkles}>
                  <input
                    value={carouselForm.linkUrl}
                    onChange={(e) =>
                      setCarouselForm((prev: any) => ({
                        ...prev,
                        linkUrl: e.target.value,
                      }))
                    }
                    className="cms-input"
                    placeholder="/offers"
                  />
                </InputGroup>
                <div className="flex items-center gap-3 pt-8">
                  <div
                    onClick={() =>
                      setCarouselForm((prev: any) => ({
                        ...prev,
                        isActive: !prev.isActive,
                      }))
                    }
                    className={clsx(
                      "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors",
                      carouselForm.isActive ? "bg-emerald-500" : "bg-slate-300",
                    )}
                  >
                    <div
                      className={clsx(
                        "w-4 h-4 bg-white rounded-full transition-transform",
                        carouselForm.isActive
                          ? "translate-x-6"
                          : "translate-x-0",
                      )}
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status: {carouselForm.isActive ? "Live" : "Hidden"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-4">
              <button
                onClick={closeCarouselModal}
                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-charcoal transition-all"
              >
                Discard Changes
              </button>
              <button
                onClick={
                  editingCarouselItem
                    ? handleUpdateCarouselItem
                    : handleCreateCarouselItem
                }
                disabled={isSaving}
                className="flex-[2] py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Deploy Billboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Info Modal */}
      {isEventInfoModalOpen && (
        <div className="fixed inset-0 bg-charcoal/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                  Event <span className="text-primary">Info.</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                  Add Join Event Info
                </p>
              </div>
              <button
                onClick={() => setIsEventInfoModalOpen(false)}
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <InputGroup label="FB Account URL/Name" icon={Globe}>
                <input
                  value={eventInfoForm.fbAccount}
                  onChange={(e) =>
                    setEventInfoForm((prev) => ({
                      ...prev,
                      fbAccount: e.target.value,
                    }))
                  }
                  className="cms-input"
                  placeholder="e.g. fb.com/events"
                />
              </InputGroup>
              <InputGroup label="Contact Number" icon={Monitor}>
                <input
                  value={eventInfoForm.contactNumber}
                  onChange={(e) =>
                    setEventInfoForm((prev) => ({
                      ...prev,
                      contactNumber: e.target.value,
                    }))
                  }
                  className="cms-input"
                  placeholder="e.g. 09123456789"
                />
              </InputGroup>
            </div>

            <div className="p-8 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-4">
              <button
                onClick={() => setIsEventInfoModalOpen(false)}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-charcoal transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateEventInfo}
                className="flex-[2] py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Save Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost and Found Modal */}
      {isLostFoundModalOpen && (
        <div className="fixed inset-0 bg-charcoal/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2rem] sm:rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 md:p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                  Post <span className="text-primary">Item.</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                  Report a lost or found item.
                </p>
              </div>
              <button
                onClick={() => setIsLostFoundModalOpen(false)}
                className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 md:p-10 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Type" icon={Layers}>
                  <select 
                    value={lostFoundForm.type}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, type: e.target.value as "LOST" | "FOUND" }))}
                    className="cms-input"
                  >
                    <option value="FOUND">Found Item</option>
                    <option value="LOST">Lost Item</option>
                  </select>
                </InputGroup>
                <InputGroup label="Title" icon={Layers}>
                  <input
                    value={lostFoundForm.title}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, title: e.target.value }))}
                    className="cms-input"
                    placeholder="E.g. Blue Umbrella"
                  />
                </InputGroup>
                <InputGroup label="Location" icon={Monitor}>
                  <input
                    value={lostFoundForm.location}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, location: e.target.value }))}
                    className="cms-input"
                    placeholder="E.g. Near Entrance 1"
                  />
                </InputGroup>
                <InputGroup label="Date" icon={CalendarIcon}>
                  <input
                    type="date"
                    value={lostFoundForm.date}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, date: e.target.value }))}
                    className="cms-input"
                  />
                </InputGroup>
                <div className="md:col-span-2">
                  <InputGroup label="Description" icon={Globe}>
                    <textarea
                      value={lostFoundForm.description}
                      onChange={(e) => setLostFoundForm(prev => ({ ...prev, description: e.target.value }))}
                      className="cms-input min-h-[80px] resize-none"
                    />
                  </InputGroup>
                </div>
                <div className="md:col-span-2">
                  <InputGroup label="Image" icon={ImageIcon}>
                    <div className="flex gap-4 items-center">
                      {lostFoundForm.imageUrl && (
                        <img src={lostFoundForm.imageUrl} className="w-16 h-16 rounded-xl object-cover" />
                      )}
                      <label className="shrink-0 p-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/20 transition-all flex items-center gap-2">
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                        <span className="text-xs font-bold">Upload Image</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleLostFoundUpload}
                        />
                      </label>
                    </div>
                  </InputGroup>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 md:p-10 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-4 shrink-0">
              <button
                onClick={() => setIsLostFoundModalOpen(false)}
                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-charcoal transition-all"
              >
                Discard
              </button>
              <button
                onClick={handleCreateLostFound}
                disabled={isSaving || !lostFoundForm.title || !lostFoundForm.location}
                className="flex-[2] py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Post Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Components - Logic */}
      <style jsx global>{`
        .cms-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 1.25rem;
          padding: 1rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: inherit;
          outline: none;
          transition: all 0.2s;
        }
        .dark .cms-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cms-input:focus {
          background: white;
          border-color: #be1e2d; /* Primary Crimson */
          box-shadow: 0 0 0 4px rgba(190, 30, 45, 0.1);
        }
        .dark .cms-input:focus {
          background: rgba(255, 255, 255, 0.1);
          border-color: #be1e2d;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-rgb), 0.2);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  sub,
}: {
  icon: any;
  title: string;
  sub: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Icon size={20} />
        </div>
        <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
          {title}
        </h2>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-[52px]">
        {sub}
      </p>
    </div>
  );
}

function InputGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={14} className="opacity-60" />
        <label className="text-[10px] font-black uppercase tracking-widest">
          {label}
        </label>
      </div>
      {children}
    </div>
  );
}
