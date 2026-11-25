"use client";

import { confirmAction } from "@/components/confirm-dialog";
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
import { getAdminEventsAction, updateInquiryImageAction, deleteInquiryAction, updateEventInfoAction } from "@/app/actions/inquiry";
import { Info } from "lucide-react";
import { toast } from "sonner";
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
  Upload,
  MapPin,
  Phone,
} from "lucide-react";
import {
  PUBLIC_CONFIG_CACHE_KEY,
  mapEmbedSrc,
} from "@/lib/theme";
import clsx from "clsx";
import { Button, Checkbox, Select, cn } from "@cloudflare/kumo";
import { ArrowSquareOut, PencilSimple, Plus as PlusIcon, Trash } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, PageTabs, Panel } from "@/components/admin/page-kit";
import { formatSaleDate, isSaleActive, saleEndsAt } from "@/lib/post-sales";
import { CustomSelect } from "@/components/ui/custom-select";

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
  productsTitle: string | null;
  productsDescription: string | null;
  videoCtaLabel: string | null;
  directoryTitle: string | null;
  directoryDescription: string | null;
  spacesTitle: string | null;
  spacesDescription: string | null;
  venueEyebrow: string | null;
  venueTitle: string | null;
  venueDescription: string | null;
  venueImageUrl: string | null;
  venueImageAlt: string | null;
  reviewsTitle: string | null;
  reviewsDescription: string | null;
  locationTitle: string | null;
  featuredVideoUrl: string | null;
  contactTitle: string | null;
  contactDescription: string | null;
  themeColor: string | null;
  googleMapsEmbedUrl: string | null;
  googleMapsApiKey: string | null;
  footerDescription: string | null;
  footerInstagram: string | null;
  footerFacebook: string | null;
  footerWebsite: string | null;
  footerCopyrightText: string | null;
  footerAddress: string | null;
  footerPhone: string | null;
  footerEmail: string | null;
  footerOpeningHours?: string | null;
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
    productsTitle: "",
    productsDescription: "",
    videoCtaLabel: "",
    directoryTitle: "",
    directoryDescription: "",
    spacesTitle: "",
    spacesDescription: "",
    venueEyebrow: "",
    venueTitle: "",
    venueDescription: "",
    venueImageUrl: "",
    venueImageAlt: "",
    reviewsTitle: "",
    reviewsDescription: "",
    locationTitle: "",
    featuredVideoUrl: "",
    contactTitle: "",
    contactDescription: "",
    themeColor: "",
    googleMapsEmbedUrl: "",
    googleMapsApiKey: "",
    footerDescription: "",
    footerInstagram: "",
    footerFacebook: "",
    footerWebsite: "",
    footerCopyrightText: "",
    footerAddress: "",
    footerPhone: "",
    footerEmail: "",
    footerOpeningHours: "",
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
  // Running sales vs. ended ones (no longer on the public page) — see lib/post-sales.
  const activePostSales = allPostSales.filter((s: any) => isSaleActive(s));
  const pastPostSales = allPostSales
    .filter((s: any) => !isSaleActive(s))
    .sort((x: any, y: any) => saleEndsAt(y).getTime() - saleEndsAt(x).getTime());
  const [lostAndFoundItems, setLostAndFoundItems] = useState<any[]>([]);
  const [lfFilter, setLfFilter] = useState("ALL");

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
    eventName: "",
    eventType: "",
    eventDate: "",
    eventTime: "",
    message: "",
    fbAccount: "",
    contactNumber: "",
  });
  const [deleteEventTarget, setDeleteEventTarget] = useState<any | null>(null);

  const openEventInfoModal = (ev: any) => {
    setEditingEventId(ev.id);
    setEventInfoForm({
      eventName: ev.eventName || "",
      eventType: ev.eventType || "Community Gatherings",
      eventDate: ev.eventDate
        ? new Date(ev.eventDate).toISOString().slice(0, 10)
        : "",
      eventTime: ev.eventTime || "",
      message: ev.message || "",
      fbAccount: ev.fbAccount || "",
      contactNumber: ev.contactNumber || "",
    });
    setIsEventInfoModalOpen(true);
  };

  const handleUpdateEventInfo = async () => {
    if (!editingEventId) return;
    if (!eventInfoForm.eventDate || !eventInfoForm.eventTime) {
      showToast("Please set both the event date and time", "error");
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateEventInfoAction(editingEventId, {
        eventName: eventInfoForm.eventName,
        eventType: eventInfoForm.eventType,
        eventDate: eventInfoForm.eventDate,
        eventTime: eventInfoForm.eventTime,
        message: eventInfoForm.message,
        fbAccount: eventInfoForm.fbAccount,
        contactNumber: eventInfoForm.contactNumber,
      });
      if (res.success) {
        showToast("Event updated successfully", "success");
        setIsEventInfoModalOpen(false);
        const refreshed = await getAdminEventsAction();
        if (refreshed.success) setApprovedEvents(refreshed.data || []);
      } else {
        showToast(res.error || "Failed to update event", "error");
      }
    } catch (e) {
      showToast("Error updating event", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    if (type === "success") toast.success(msg);
    else toast.error(msg);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configData, carouselData, eventsData, lostFoundData] = await Promise.all([
          getPublicViewConfigAction(),
          getAllCarouselItemsAction(),
          getAdminEventsAction(),
          getLostAndFoundItems(),
        ]);

        setConfig((prev) => {
          const next = configData
            ? { ...prev, ...configData, companyName: configData.companyName || "SR MALL" }
            : prev;
          setSavedConfig(next);
          return next;
        });

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

  // Last saved version of the config: drives the unsaved-changes bar.
  const [savedConfig, setSavedConfig] = useState<PublicViewConfig | null>(null);
  const isDirty = savedConfig !== null && JSON.stringify(config) !== JSON.stringify(savedConfig);
  const configErrors = validateConfig(config);
  const hasConfigErrors = Object.keys(configErrors).length > 0;

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
      showToast("Image uploaded. Save changes to publish it.", "success");
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Couldn't upload the file. Please try again.", "error");
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
      showToast("Banner image uploaded", "success");
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
          prev.map((ev) =>
            ev.id === eventId ? { ...ev, imageUrl: result.url, storageKey: result.key, isPublic: !ev.isPast } : ev,
          )
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

  const confirmDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    const id = deleteEventTarget.id;

    setIsSaving(true);
    try {
      const result = await deleteInquiryAction(id);
      if (result.success) {
        setApprovedEvents((prev: any[]) => prev.filter((ev: any) => ev.id !== id));
        setDeleteEventTarget(null);
        showToast("Event deleted successfully", "success");
      } else {
        showToast("Failed to delete event", "error");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      showToast("Failed to delete event", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePostSale = async (tenantId: string, saleId: string) => {
    if (!(await confirmAction({ title: "Delete this shop's sale post?", description: "It is removed from the public site and can't be restored.", confirmLabel: "Delete post" }))) return;
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
    if (hasConfigErrors) {
      showToast("Fix the highlighted fields before saving", "error");
      return;
    }
    setIsSaving(true);
    try {
      await updatePublicViewConfigAction(config);
      setSavedConfig(config);
      // Navbar on other public pages reads this cache; refresh it.
      try {
        sessionStorage.removeItem(PUBLIC_CONFIG_CACHE_KEY);
      } catch {
        /* storage unavailable */
      }
      showToast("Changes saved and published", "success");
    } catch (error) {
      console.error("Error saving config:", error);
      showToast("Couldn't save changes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardConfig = () => {
    if (savedConfig) setConfig(savedConfig);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsSaving(true);
    try {
      const res = await updateLostAndFoundItemStatus(id, newStatus);
      if (res.success) {
        setLostAndFoundItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
        );
        showToast(`Status updated to ${newStatus}`, "success");
      } else {
        showToast("Failed to update status", "error");
      }
    } catch (error) {
      showToast("Error updating status", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLostFound = async (id: string) => {
    if (!(await confirmAction({ title: "Delete this lost and found item?", description: "This can't be undone.", confirmLabel: "Delete item" }))) return;
    setIsSaving(true);
    try {
      const { deleteLostAndFoundItem } = await import("@/app/actions/lost-and-found");
      const res = await deleteLostAndFoundItem(id);
      if (res.success) {
        setLostAndFoundItems((prev) => prev.filter((i) => i.id !== id));
        showToast("Item deleted successfully", "success");
      } else {
        showToast("Failed to delete item", "error");
      }
    } catch {
      showToast("Error deleting item", "error");
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
    } catch (err) {
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
    if (!(await confirmAction({ title: "Delete this banner?", description: "It is removed from the homepage and can't be restored.", confirmLabel: "Delete banner" }))) return;

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
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Loading Content Manager...
        </p>
      </div>
    );
  }

  const navItems = [
    {
      id: "general",
      label: "General Settings",
      icon: Globe,
      desc: "Branding, contact, map & home page copy",
    },

    {
      id: "postsales",
      label: "Shop Sales Monitoring",
      icon: Monitor,
      desc: "Manage Tenant Sales Posts",
    },
    { id: "carousel", label: "Billboards", icon: Layout, desc: "Homepage Banners" },
    { id: "events", label: "Upcoming Events", icon: CalendarIcon, desc: "Approved Event Images" },
    { id: "lostfound", label: "Lost & Found", icon: Search, desc: "Manage reported items" },
  ];

  return (
    <AdminPage
      title="Website Content"
      description="Manage homepage banners, event photos, sales announcements, and mall information shown to visitors."
      actions={
        <>
          <a href="/" target="_blank" rel="noopener noreferrer" className={cn(LINK_BUTTON, "border border-kumo-line text-kumo-default hover:bg-kumo-tint")}>
            <ArrowSquareOut size={16} aria-hidden /> Live Preview
          </a>
          <Button variant="primary" loading={isSaving} disabled={!isDirty} onClick={handleSaveConfig}>
            {isDirty ? "Save changes" : "Saved"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Sections */}
        <nav aria-label="Website content sections" className="xl:col-span-3 xl:sticky xl:top-24 xl:self-start">
          <ul className="grid gap-1 rounded-xl border border-kumo-line bg-kumo-base p-2 sm:grid-cols-2 xl:grid-cols-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-lg border-l-4 p-3 text-left hover:bg-kumo-tint",
                    activeTab === item.id ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent",
                  )}
                >
                  <item.icon size={18} aria-hidden className={cn("mt-0.5 shrink-0", activeTab === item.id ? "text-kumo-brand" : "text-kumo-subtle")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-kumo-default">{item.label}</span>
                    <span className="block text-xs text-kumo-subtle">{item.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Workspace */}
        <div className="min-w-0 xl:col-span-9">
          {activeTab === "general" && (
            <div className="space-y-8">
              <SectionHeader
                title="General Settings"
                sub="Your mall's name, logo, contact details, map, home page content and footer."
              />

              {/* ── Branding ─────────────────────────────────────────────── */}
              <SettingsCard
                title="Branding"
                sub="Shown in the public navbar and footer"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex items-start gap-5">
                    <div className="w-28 h-28 shrink-0 bg-kumo-recessed rounded-lg border-2 border-dashed border-kumo-line flex items-center justify-center overflow-hidden group relative">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Mall logo" className="w-full h-full object-contain p-3" />
                      ) : (
                        <ImageIcon size={32} className="text-slate-300" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-semibold gap-1">
                        <Upload size={18} />
                        Change
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload("logoUrl", e)} />
                      </label>
                    </div>
                    <div className="space-y-3 pt-1">
                      <p className="text-sm font-medium text-kumo-default">Logo</p>
                      <div className="flex flex-wrap gap-2">
                        <label className={cn(LINK_BUTTON, "bg-kumo-brand text-white hover:bg-kumo-brand-hover")}>
                          <Upload size={14} /> Upload
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload("logoUrl", e)} />
                        </label>
                        {config.logoUrl && (
                          <button
                            type="button"
                            onClick={() => handleConfigChange("logoUrl", "")}
                            className={cn(LINK_BUTTON, "border border-kumo-line text-kumo-danger hover:bg-kumo-tint")}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-kumo-subtle">Square PNG or SVG, at least 512 × 512.</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-5 min-w-0">
                    <Field label="Mall name" error={configErrors.companyName}>
                      <input
                        value={config.companyName ?? ""}
                        onChange={(e) => handleConfigChange("companyName", e.target.value)}
                        className="cms-input"
                        placeholder="SR MALL"
                      />
                    </Field>
                    <Field label="Logo image URL" hint="Filled in automatically when you upload." error={configErrors.logoUrl}>
                      <input
                        value={config.logoUrl ?? ""}
                        onChange={(e) => handleConfigChange("logoUrl", e.target.value)}
                        className="cms-input"
                        placeholder="https://…"
                      />
                    </Field>
                  </div>
                </div>
              </SettingsCard>

              {/* ── Contact information ──────────────────────────────────── */}
              <SettingsCard
                title="Contact information"
                sub="Used on the location section, merchant applications, and as the footer fallback"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Email" error={configErrors.contactEmail}>
                    <input
                      type="email"
                      value={config.contactEmail ?? ""}
                      onChange={(e) => handleConfigChange("contactEmail", e.target.value)}
                      className="cms-input"
                      placeholder="hello@srmall.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={config.contactPhone ?? ""}
                      onChange={(e) => handleConfigChange("contactPhone", e.target.value)}
                      className="cms-input"
                      placeholder="+63 900 000 0000"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Address" hint="Also used to place the map when no embed URL is set.">
                      <textarea
                        value={config.contactAddress ?? ""}
                        onChange={(e) => handleConfigChange("contactAddress", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Crossing Villanueva, Misamis Oriental, 9002, Philippines"
                      />
                    </Field>
                  </div>
                </div>
              </SettingsCard>

              {/* ── Google Maps ──────────────────────────────────────────── */}
              <SettingsCard
                title="Google Maps"
                sub="The map on the public Location section"
                badge={
                  config.googleMapsEmbedUrl || config.googleMapsApiKey ? (
                    <span className="text-sm font-medium text-kumo-subtle">
                      <CheckCircle size={12} /> Connected
                    </span>
                  ) : undefined
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field
                    label="Embed URL"
                    hint="Google Maps › Share › Embed a map › copy the src link."
                    error={configErrors.googleMapsEmbedUrl}
                  >
                    <input
                      value={config.googleMapsEmbedUrl ?? ""}
                      onChange={(e) => handleConfigChange("googleMapsEmbedUrl", e.target.value)}
                      className="cms-input"
                      placeholder="https://www.google.com/maps/embed?pb=…"
                    />
                  </Field>
                  <Field
                    label="API key (optional)"
                    hint="Only needed without an embed URL. Restrict it to your domain in Google Cloud."
                  >
                    <input
                      value={config.googleMapsApiKey ?? ""}
                      onChange={(e) => handleConfigChange("googleMapsApiKey", e.target.value)}
                      className="cms-input font-mono"
                      placeholder="AIzaSy…"
                    />
                  </Field>
                </div>
                <div className="rounded-lg overflow-hidden border border-kumo-line aspect-video max-h-72 w-full bg-kumo-recessed">
                  <iframe
                    src={mapEmbedSrc(config)}
                    className="w-full h-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title="Map preview"
                  />
                </div>
              </SettingsCard>

              {/* ── Homepage section text ────────────────────────────────── */}
              <SettingsCard
                title="Homepage section text"
                sub="Headings and descriptions shown on the public home page"
              >
                <div className="space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-kumo-default">
                      Featured Products
                    </p>
                    <Field
                      label="Heading"
                      hint="Use a line break to keep the two-tone heading: “Featured” on the first line, “Products.” on the second."
                    >
                      <textarea
                        value={config.productsTitle ?? ""}
                        onChange={(e) => handleConfigChange("productsTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Featured\nProducts."}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.productsDescription ?? ""}
                        onChange={(e) => handleConfigChange("productsDescription", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder="Handpicked collections from our premier tenants, refreshed daily."
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Mall Directory
                    </p>
                    <Field
                      label="Heading"
                      hint="Use a line break to keep the two-tone heading: “Mall” on the first line, “Directory.” on the second."
                    >
                      <textarea
                        value={config.directoryTitle ?? ""}
                        onChange={(e) => handleConfigChange("directoryTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Mall\nDirectory."}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.directoryDescription ?? ""}
                        onChange={(e) => handleConfigChange("directoryDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Navigate through our curated ecosystem of high-end retail, digital-first storefronts, and world-class dining destinations."
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Available Spaces
                    </p>
                    <Field
                      label="Heading"
                      hint="Use a line break to keep the two-tone heading: “Available” on the first line, “Spaces.” on the second."
                    >
                      <textarea
                        value={config.spacesTitle ?? ""}
                        onChange={(e) => handleConfigChange("spacesTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Available\nSpaces."}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.spacesDescription ?? ""}
                        onChange={(e) => handleConfigChange("spacesDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Join our premium retail ecosystem. Explore high-visibility slots designed for modern brands and start your journey at SR Mall."
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Venue booking
                    </p>
                    <Field label="Eyebrow label">
                      <input
                        value={config.venueEyebrow ?? ""}
                        onChange={(e) => handleConfigChange("venueEyebrow", e.target.value)}
                        className="cms-input"
                        placeholder="Venue booking"
                      />
                    </Field>
                    <Field
                      label="Heading"
                      hint="Use a line break for the two lines. Wrap words in *asterisks* to keep the red italic accent."
                    >
                      <textarea
                        value={config.venueTitle ?? ""}
                        onChange={(e) => handleConfigChange("venueTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Plan your next *big*\n*day* here."}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.venueDescription ?? ""}
                        onChange={(e) => handleConfigChange("venueDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Esports nights, sports meets, fitness events, trade shows and community gatherings. Tell us what you're planning and the events team gets back to you."
                      />
                    </Field>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-kumo-default">Section photo</p>
                      <div className="aspect-4/3 w-full max-w-sm bg-kumo-recessed rounded-lg border-2 border-dashed border-kumo-line flex items-center justify-center overflow-hidden">
                        {/* The homepage's built-in picture shows until one is uploaded. */}
                        <img
                          src={config.venueImageUrl || DEFAULT_VENUE_IMAGE}
                          alt={config.venueImageAlt || "Venue booking section photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className={cn(LINK_BUTTON, "bg-kumo-brand text-white hover:bg-kumo-brand-hover")}>
                          <Edit size={14} />
                          {config.venueImageUrl ? "Change photo" : "Upload photo"}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              void handleImageUpload("venueImageUrl", e);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {config.venueImageUrl && (
                          <button
                            type="button"
                            onClick={() => handleConfigChange("venueImageUrl", "")}
                            className="text-xs font-semibold text-slate-500 hover:text-primary"
                          >
                            Use the built-in picture
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Landscape works best (at least 1200 × 900), with the subject in the middle and no text in it.
                      </p>
                    </div>
                    <Field label="Photo URL" hint="Filled in automatically when you upload." error={configErrors.venueImageUrl}>
                      <input
                        value={config.venueImageUrl ?? ""}
                        onChange={(e) => handleConfigChange("venueImageUrl", e.target.value)}
                        className="cms-input"
                        placeholder="https://…"
                      />
                    </Field>
                    <Field label="Photo description" hint="What the photo shows, for screen readers and search engines.">
                      <input
                        value={config.venueImageAlt ?? ""}
                        onChange={(e) => handleConfigChange("venueImageAlt", e.target.value)}
                        className="cms-input"
                        placeholder="Crowd watching a lion dance at the SR Mall entrance"
                        maxLength={160}
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Customer Experiences
                    </p>
                    <Field label="Heading">
                      <input
                        value={config.reviewsTitle ?? ""}
                        onChange={(e) => handleConfigChange("reviewsTitle", e.target.value)}
                        className="cms-input"
                        placeholder="Customer Experiences"
                      />
                    </Field>
                    <Field label="Description">
                      <input
                        value={config.reviewsDescription ?? ""}
                        onChange={(e) => handleConfigChange("reviewsDescription", e.target.value)}
                        className="cms-input"
                        placeholder="Real feedback from our valued visitors and tenants"
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Location
                    </p>
                    <Field label="Heading" hint="Use a line break for “Prime location.” and “Endless access.”">
                      <textarea
                        value={config.locationTitle ?? ""}
                        onChange={(e) => handleConfigChange("locationTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Prime location.\nEndless access."}
                      />
                    </Field>
                    <Field label="Description" hint="Shown under the location heading.">
                      <textarea
                        value={config.contactDescription ?? ""}
                        onChange={(e) => handleConfigChange("contactDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="On the national highway in Brgy. Luz Banzon, Jasaan. Easy to reach from Cagayan de Oro and the towns of Misamis Oriental."
                      />
                    </Field>
                  </div>
                </div>
              </SettingsCard>

              {/* ── About Our Vision ─────────────────────────────────────── */}
              <SettingsCard
                title="About Our Vision"
                sub="Tell the story behind the mall."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1 space-y-4">
                    <p className="text-sm font-medium text-kumo-default">
                      Section photo
                    </p>
                    <div className="aspect-4/5 bg-kumo-recessed rounded-lg border-2 border-dashed border-kumo-line flex items-center justify-center overflow-hidden relative group">
                      {config.aboutImageUrl ? (
                        <img
                          src={config.aboutImageUrl}
                          alt="About section"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-slate-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-semibold gap-1">
                        <Edit size={22} />
                        Change
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload("aboutImageUrl", e)}
                        />
                      </label>
                    </div>
                    <Field label="Image URL" hint="Filled in automatically when you upload.">
                      <input
                        value={config.aboutImageUrl ?? ""}
                        onChange={(e) => handleConfigChange("aboutImageUrl", e.target.value)}
                        className="cms-input"
                        placeholder="https://…"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2 space-y-5">
                    <Field label="Section headline" hint="Leave empty to keep “Our Legacy”.">
                      <input
                        value={config.aboutTitle ?? ""}
                        onChange={(e) => handleConfigChange("aboutTitle", e.target.value)}
                        className="cms-input"
                        placeholder="Our Legacy"
                      />
                    </Field>
                    <Field label="Narrative text" hint="Leave empty to keep the original story.">
                      <textarea
                        value={config.aboutDescription ?? ""}
                        onChange={(e) => handleConfigChange("aboutDescription", e.target.value)}
                        className="cms-input min-h-[220px] resize-none"
                        placeholder="Since 1995..."
                      />
                    </Field>
                  </div>
                </div>
              </SettingsCard>

              {/* ── Featured video ───────────────────────────────────────── */}
              <SettingsCard
                title="Featured video"
                sub="The cinematic section below the featured products"
              >
                <div className="flex flex-col md:flex-row md:items-start items-center gap-8">
                  <div className="w-full md:w-48 shrink-0 aspect-video bg-kumo-recessed rounded-lg border-2 border-dashed border-kumo-line flex items-center justify-center overflow-hidden group relative">
                    <video
                      key={config.featuredVideoUrl || "default"}
                      src={config.featuredVideoUrl || "/vid/Download.mp4"}
                      className="w-full h-full object-cover"
                      controls
                    />
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-semibold gap-1">
                      <Plus size={22} />
                      Replace
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload("featuredVideoUrl", e)}
                      />
                    </label>
                  </div>
                  <div className="flex-1 space-y-5 w-full min-w-0">
                    <Field
                      label="Video URL"
                      hint="Leave empty to use the default mall film. Uploading replaces it automatically."
                    >
                      <input
                        value={config.featuredVideoUrl ?? ""}
                        onChange={(e) => handleConfigChange("featuredVideoUrl", e.target.value)}
                        className="cms-input"
                        placeholder="https://…"
                      />
                    </Field>
                    <Field label="Heading">
                      <input
                        value={config.videoTitle ?? ""}
                        onChange={(e) => handleConfigChange("videoTitle", e.target.value)}
                        className="cms-input"
                        placeholder="Elevate Your Lifestyle."
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.videoDescription ?? ""}
                        onChange={(e) => handleConfigChange("videoDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Watch our latest visual showcase highlighting the premier shopping and dining experiences waiting for you at SR Mall. Immerse yourself in the extraordinary."
                      />
                    </Field>
                    <Field label="Link label" hint="The link that jumps to the shop directory.">
                      <input
                        value={config.videoCtaLabel ?? ""}
                        onChange={(e) => handleConfigChange("videoCtaLabel", e.target.value)}
                        className="cms-input"
                        placeholder="Explore the shops"
                      />
                    </Field>
                  </div>
                </div>
              </SettingsCard>

              {/* ── Footer ───────────────────────────────────────────────── */}
              <SettingsCard
                title="Footer"
                sub="The bottom of every public page"
              >
                <Field label="Description">
                  <textarea
                    value={config.footerDescription ?? ""}
                    onChange={(e) => handleConfigChange("footerDescription", e.target.value)}
                    className="cms-input min-h-[88px] resize-none"
                    placeholder="The ultimate destination for shopping, dining, and leisure…"
                  />
                </Field>

                <div className="pt-6 border-t border-kumo-line space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-kumo-default">Find us</p>
                    <p className="text-sm text-kumo-subtle mt-0.5">
                      Leave a field empty to use the matching Contact information value.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Field label="Address">
                      <input
                        value={config.footerAddress ?? ""}
                        onChange={(e) => handleConfigChange("footerAddress", e.target.value)}
                        className="cms-input"
                        placeholder={config.contactAddress || "Jasaan, Misamis Oriental"}
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        value={config.footerPhone ?? ""}
                        onChange={(e) => handleConfigChange("footerPhone", e.target.value)}
                        className="cms-input"
                        placeholder={config.contactPhone || "(02) 8888-1234"}
                      />
                    </Field>
                    <Field label="Email" error={configErrors.footerEmail}>
                      <input
                        type="email"
                        value={config.footerEmail ?? ""}
                        onChange={(e) => handleConfigChange("footerEmail", e.target.value)}
                        className="cms-input"
                        placeholder={config.contactEmail || "info@srmall.com"}
                      />
                    </Field>
                  </div>
                </div>

                <div className="pt-6 border-t border-kumo-line space-y-4">
                  <p className="text-sm font-semibold text-kumo-default">Social links</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Field label="Instagram" error={configErrors.footerInstagram}>
                      <input
                        type="url"
                        value={config.footerInstagram ?? ""}
                        onChange={(e) => handleConfigChange("footerInstagram", e.target.value)}
                        className="cms-input"
                        placeholder="https://instagram.com/srmall"
                      />
                    </Field>
                    <Field label="Facebook" error={configErrors.footerFacebook}>
                      <input
                        type="url"
                        value={config.footerFacebook ?? ""}
                        onChange={(e) => handleConfigChange("footerFacebook", e.target.value)}
                        className="cms-input"
                        placeholder="https://facebook.com/srmall"
                      />
                    </Field>
                    <Field label="Website" error={configErrors.footerWebsite}>
                      <input
                        type="url"
                        value={config.footerWebsite ?? ""}
                        onChange={(e) => handleConfigChange("footerWebsite", e.target.value)}
                        className="cms-input"
                        placeholder="https://srmall.com"
                      />
                    </Field>
                  </div>
                </div>

                <Field label="Opening hours" hint="Shown in the footer. Use one line per schedule.">
                  <textarea
                    value={config.footerOpeningHours ?? ""}
                    onChange={(e) => handleConfigChange("footerOpeningHours", e.target.value)}
                    className="cms-input min-h-[72px] resize-none"
                    placeholder={`Mon–Sun: 10:00 AM – 9:00 PM\nHolidays: 10:00 AM – 8:00 PM`}
                  />
                </Field>

                <Field label="Copyright text">
                  <input
                    value={config.footerCopyrightText ?? ""}
                    onChange={(e) => handleConfigChange("footerCopyrightText", e.target.value)}
                    className="cms-input"
                    placeholder={`© ${new Date().getFullYear()} SR Mall. All rights reserved.`}
                  />
                </Field>
              </SettingsCard>
            </div>
          )}

          {activeTab === "postsales" && (
            <div className="space-y-6">
              <SectionHeader title="Shop Sales Monitoring" sub="Manage tenant promotional posts and sales announcements." />

              {activePostSales.length === 0 ? (
                <Panel flush>
                  <EmptyNote title="No active posts">
                    {allPostSales.length === 0 ? "Tenants haven't posted any sales yet." : "No sales are running right now."}
                  </EmptyNote>
                </Panel>
              ) : (
                <SaleGrid sales={activePostSales} onImage={handleUpdatePostSaleImage} onDelete={handleDeletePostSale} />
              )}

              {pastPostSales.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-kumo-default">
                    Past shop sales <span className="text-sm font-normal text-kumo-subtle">(no longer shown on the public page)</span>
                  </h3>
                  <SaleGrid sales={pastPostSales} onImage={handleUpdatePostSaleImage} onDelete={handleDeletePostSale} />
                </section>
              )}
            </div>
          )}

          {activeTab === "carousel" && (
            <div className="space-y-6">
              <SectionHeader
                title="Digital Billboards"
                sub="Manage high-priority advertising banners."
                action={
                  <Button variant="primary" icon={<PlusIcon />} onClick={() => openCarouselModal()}>
                    New banner
                  </Button>
                }
              />

              {carouselItems.length === 0 ? (
                <Panel flush>
                  <EmptyNote title="No billboards yet">Add a banner to show it on the homepage.</EmptyNote>
                </Panel>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {carouselItems.map((item: any) => (
                    <li key={item.id} className={CMS_CARD}>
                      <Thumb url={item.imageUrl} alt={item.title} />
                      <div className="flex flex-1 flex-col gap-1 p-4">
                        <h3 className="line-clamp-1 text-base font-semibold text-kumo-default">{item.title}</h3>
                        <p className="line-clamp-2 text-sm text-kumo-subtle">{item.description}</p>
                        <p className="text-sm">
                          <span className={cn("font-medium", item.isActive ? "text-kumo-success" : "text-kumo-subtle")}>
                            {item.isActive ? "Live" : "Hidden"}
                          </span>
                          <span className="text-kumo-subtle">, priority {item.priority}</span>
                        </p>
                        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                          <Button size="sm" variant="secondary" onClick={() => handleToggleCarouselItem(item.id)}>
                            {item.isActive ? "Hide" : "Show"}
                          </Button>
                          <Button size="sm" variant="secondary" icon={<PencilSimple />} onClick={() => openCarouselModal(item)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary-destructive"
                            shape="square"
                            icon={<Trash />}
                            aria-label={`Delete ${item.title}`}
                            onClick={() => handleDeleteCarouselItem(item.id)}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "events" && (
            <div className="space-y-6">
              <SectionHeader
                title="Upcoming Events"
                sub="Approved events show on the public page until their event day ends. Upload an image to publish one."
              />

              {(() => {
                const upcoming = approvedEvents.filter((ev: any) => !ev.isPast);
                const past = approvedEvents.filter((ev: any) => ev.isPast);
                const renderCard = (ev: any) => (
                  <li key={ev.id} className={cn(CMS_CARD, ev.isPast && "opacity-70")}>
                    <Thumb url={ev.imageUrl} alt={ev.eventName || ev.eventType} empty="No image yet" />
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h3 className="text-base font-semibold text-kumo-default">{ev.eventName || ev.eventType}</h3>
                      <p className="text-sm text-kumo-subtle">
                        {ev.eventType}, {new Date(ev.eventDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        {ev.eventTime ? `, ${ev.eventTime}` : ""}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          ev.isPast ? "text-kumo-subtle" : ev.isPublic ? "text-kumo-success" : "text-kumo-warning",
                        )}
                      >
                        {ev.isPast ? "Ended, hidden" : ev.isPublic ? "Live on site" : "Needs image"}
                      </p>
                      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                        {!ev.isPast && (
                          <FileButton accept="image/*" onChange={(e) => handleEventImageUpload(ev.id, e)}>
                            {ev.imageUrl ? "Change image" : "Upload image"}
                          </FileButton>
                        )}
                        <Button size="sm" variant="secondary" icon={<PencilSimple />} onClick={() => openEventInfoModal(ev)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => setDeleteEventTarget(ev)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                );
                return (
                  <>
                    {upcoming.length === 0 ? (
                      <Panel flush>
                        <EmptyNote title="No upcoming approved events" />
                      </Panel>
                    ) : (
                      <ul className="grid gap-4 md:grid-cols-2">{upcoming.map(renderCard)}</ul>
                    )}

                    {past.length > 0 && (
                      <section className="space-y-3">
                        <h3 className="text-base font-semibold text-kumo-default">
                          Past events ({past.length}){" "}
                          <span className="text-sm font-normal text-kumo-subtle">(no longer shown on the public page)</span>
                        </h3>
                        <ul className="grid gap-4 md:grid-cols-2">{past.map(renderCard)}</ul>
                      </section>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === "lostfound" && (
            <div className="space-y-6">
              <SectionHeader
                title="Lost & Found"
                sub="Manage reported lost and found items."
                action={
                  <Button variant="primary" icon={<PlusIcon />} onClick={() => setIsLostFoundModalOpen(true)}>
                    New item
                  </Button>
                }
              />

              <PageTabs
                value={lfFilter}
                onValueChange={(v) => setLfFilter(v)}
                tabs={LOST_FOUND_FILTERS.map((f) => ({
                  value: f.id,
                  label: `${f.label} (${lostAndFoundItems.filter((item) => matchesLostFound(item, f.id)).length})`,
                }))}
              />

              {lostAndFoundItems.filter((item) => matchesLostFound(item, lfFilter)).length === 0 ? (
                <Panel flush>
                  <EmptyNote title="No items found" />
                </Panel>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {lostAndFoundItems
                    .filter((item) => matchesLostFound(item, lfFilter))
                    .map((item: any) => (
                      <li key={item.id} className={CMS_CARD}>
                        <Thumb url={item.imageUrl} alt={item.title} empty="No photo" />
                        <div className="flex flex-1 flex-col gap-1 p-4">
                          <p className="text-sm">
                            <span className="font-medium text-kumo-default">{item.type === "LOST" ? "Lost" : "Found"}</span>
                            {item.status === "CLAIMED" && <span className="font-medium text-kumo-success">, claimed</span>}
                            {item.status === "PENDING" && <span className="font-medium text-kumo-warning">, new report</span>}
                          </p>
                          <h3 className="text-base font-semibold text-kumo-default">{item.title}</h3>
                          <p className="text-sm text-kumo-subtle">
                            {item.location}, {new Date(item.date).toLocaleDateString()}
                          </p>
                          {item.description && <p className="line-clamp-2 text-sm text-kumo-default">{item.description}</p>}
                          {item.user && <p className="text-sm text-kumo-subtle">Reported by {item.user.name || item.user.email}</p>}
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                            <Select
                              aria-label={`Status of ${item.title}`}
                              value={item.status}
                              items={LOST_FOUND_STATUS}
                              onValueChange={(v) => v != null && v !== item.status && handleUpdateStatus(item.id, v as string)}
                              className="w-44"
                            >
                              {Object.entries(LOST_FOUND_STATUS).map(([value, label]) => (
                                <Select.Option key={value} value={value}>
                                  {label}
                                </Select.Option>
                              ))}
                            </Select>
                            <div className="flex gap-2">
                              {item.status !== "CLAIMED" && (
                                <Button size="sm" variant="primary" onClick={() => handleUpdateStatus(item.id, "CLAIMED")}>
                                  Claim
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary-destructive"
                                shape="square"
                                icon={<Trash />}
                                aria-label={`Delete ${item.title}`}
                                onClick={() => handleDeleteLostFound(item.id)}
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {isDirty && (
            <div className="sticky bottom-4 z-30 mt-6">
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-kumo-line bg-kumo-base p-4 shadow-lg sm:flex-row sm:items-center">
                <p className={cn("text-sm font-semibold", hasConfigErrors ? "text-kumo-danger" : "text-kumo-warning")}>
                  {hasConfigErrors ? "Fix the highlighted fields to save" : "You have unsaved changes"}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={handleDiscardConfig} disabled={isSaving}>
                    Discard
                  </Button>
                  <Button variant="primary" loading={isSaving} disabled={hasConfigErrors} onClick={handleSaveConfig}>
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Carousel Modal */}
      <AdminDialog
        open={isCarouselModalOpen}
        onClose={closeCarouselModal}
        size="lg"
        title="Homepage banner"
        description="Set the picture, text and priority."
        footer={
          <>
            <Button variant="secondary" onClick={closeCarouselModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSaving}
              onClick={editingCarouselItem ? handleUpdateCarouselItem : handleCreateCarouselItem}
            >
              Publish banner
            </Button>
          </>
        }
      >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Billboard Title">
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
                <InputGroup label="Display Priority">
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
                  <InputGroup label="Narrative Text">
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
                  <InputGroup label="Visual Asset URL">
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
                <InputGroup label="Action Link">
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
                <div className="flex items-end pb-2">
                  <Checkbox
                    label="Show on the homepage"
                    checked={!!carouselForm.isActive}
                    onCheckedChange={(v) => setCarouselForm((prev: any) => ({ ...prev, isActive: Boolean(v) }))}
                  />
                </div>
              </div>
      </AdminDialog>

      {/* Event Info Modal */}
      <AdminDialog
        open={isEventInfoModalOpen}
        onClose={() => setIsEventInfoModalOpen(false)}
        size="lg"
        title="Edit event"
        description="Update the event details shown on the public page."
        footer={
          <>
            <Button variant="secondary" disabled={isSaving} onClick={() => setIsEventInfoModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSaving} onClick={handleUpdateEventInfo}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
              <InputGroup label="Event Name">
                <input
                  value={eventInfoForm.eventName}
                  onChange={(e) =>
                    setEventInfoForm((prev) => ({
                      ...prev,
                      eventName: e.target.value,
                    }))
                  }
                  className="cms-input"
                  placeholder="e.g. Summer Esports Championship"
                />
              </InputGroup>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Event Type
                  </label>
                  <CustomSelect
                    value={eventInfoForm.eventType}
                    onChange={(value) =>
                      setEventInfoForm((prev) => ({ ...prev, eventType: value }))
                    }
                    options={Array.from(
                      new Set([
                        "Esports & Gaming Events",
                        "Mini Sports Competitions",
                        "Fitness & Active Events",
                        "Trade Shows & Exhibitions",
                        "Community Gatherings",
                        ...(eventInfoForm.eventType
                          ? [eventInfoForm.eventType]
                          : []),
                      ]),
                    ).map((type) => ({ value: type, label: type }))}
                    ariaLabel="Event type"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={eventInfoForm.eventDate}
                    onChange={(e) =>
                      setEventInfoForm((prev) => ({
                        ...prev,
                        eventDate: e.target.value,
                      }))
                    }
                    className="cms-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Event Time
                  </label>
                  <input
                    type="time"
                    value={eventInfoForm.eventTime}
                    onChange={(e) =>
                      setEventInfoForm((prev) => ({
                        ...prev,
                        eventTime: e.target.value,
                      }))
                    }
                    className="cms-input"
                  />
                </div>
                <InputGroup label="FB Account URL/Name">
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
              </div>

              <InputGroup label="Contact Number">
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

              <InputGroup label="Event Message / Notes">
                <textarea
                  value={eventInfoForm.message}
                  onChange={(e) =>
                    setEventInfoForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  rows={3}
                  className="cms-input resize-none"
                  placeholder="Optional details shown with the event"
                />
              </InputGroup>
        </div>
      </AdminDialog>

      <AdminDialog
        open={!!deleteEventTarget}
        onClose={() => !isSaving && setDeleteEventTarget(null)}
        size="sm"
        title="Delete this event?"
        footer={
          <>
            <Button variant="secondary" disabled={isSaving} onClick={() => setDeleteEventTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={isSaving} onClick={confirmDeleteEvent}>
              Delete event
            </Button>
          </>
        }
      >
        <p className="text-sm text-kumo-default">
          <strong>{deleteEventTarget?.eventName || deleteEventTarget?.eventType}</strong> will be removed from the public page
          along with its uploaded image. This can&apos;t be undone.
        </p>
      </AdminDialog>

      {/* Lost and Found Modal */}
      <AdminDialog
        open={isLostFoundModalOpen}
        onClose={() => setIsLostFoundModalOpen(false)}
        size="lg"
        title="Post item"
        description="Report a lost or found item."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsLostFoundModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSaving}
              disabled={!lostFoundForm.title || !lostFoundForm.location}
              onClick={handleCreateLostFound}
            >
              Post item
            </Button>
          </>
        }
      >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Type">
                  <select
                    value={lostFoundForm.type}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, type: e.target.value as "LOST" | "FOUND" }))}
                    className="cms-input"
                  >
                    <option value="FOUND">Found Item</option>
                    <option value="LOST">Lost Item</option>
                  </select>
                </InputGroup>
                <InputGroup label="Title">
                  <input
                    value={lostFoundForm.title}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, title: e.target.value }))}
                    className="cms-input"
                    placeholder="E.g. Blue Umbrella"
                  />
                </InputGroup>
                <InputGroup label="Location">
                  <input
                    value={lostFoundForm.location}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, location: e.target.value }))}
                    className="cms-input"
                    placeholder="E.g. Near Entrance 1"
                  />
                </InputGroup>
                <InputGroup label="Date">
                  <input
                    type="date"
                    value={lostFoundForm.date}
                    onChange={(e) => setLostFoundForm(prev => ({ ...prev, date: e.target.value }))}
                    className="cms-input"
                  />
                </InputGroup>
                <div className="md:col-span-2">
                  <InputGroup label="Description">
                    <textarea
                      value={lostFoundForm.description}
                      onChange={(e) => setLostFoundForm(prev => ({ ...prev, description: e.target.value }))}
                      className="cms-input min-h-[80px] resize-none"
                    />
                  </InputGroup>
                </div>
                <div className="md:col-span-2">
                  <InputGroup label="Image">
                    <div className="flex gap-4 items-center">
                      {lostFoundForm.imageUrl && (
                        <img src={lostFoundForm.imageUrl} className="w-16 h-16 rounded-xl object-cover" />
                      )}
                      <label className={cn(LINK_BUTTON, "shrink-0 border border-kumo-line text-kumo-default hover:bg-kumo-tint")}>
                        {isSaving ? "Uploading..." : "Upload image"}
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
      </AdminDialog>

      {/* Styled Components - Logic */}
      <style jsx global>{`
        .cms-input {
          width: 100%;
          background: var(--color-kumo-base, #fff);
          border: 1px solid var(--color-kumo-line, rgba(0, 0, 0, 0.12));
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 400;
          color: inherit;
          outline: none;
        }
        .cms-input:focus {
          border-color: #be1e2d;
          box-shadow: 0 0 0 2px rgba(190, 30, 45, 0.25);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-rgb), 0.2);
          border-radius: 10px;
        }
      `}</style>
    </AdminPage>
  );
}

const LINK_BUTTON = "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium";
const CMS_CARD = "flex flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-base";

const LOST_FOUND_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "FOUND", label: "Found" },
  { id: "LOST", label: "Lost" },
  { id: "REPORT", label: "New reports" },
  { id: "CLAIMED", label: "Claimed" },
];
const LOST_FOUND_STATUS: Record<string, string> = {
  PENDING: "Pending (report)",
  LOOKING: "Looking / active",
  CLAIMED: "Claimed",
  RESOLVED: "Resolved",
  UNCLAIMED: "Unclaimed",
};

/** Which items each Lost & Found filter shows. */
function matchesLostFound(item: any, filter: string) {
  if (filter === "CLAIMED") return item.status === "CLAIMED";
  if (filter === "REPORT") return item.status === "PENDING";
  if (filter === "FOUND" || filter === "LOST") {
    return item.type === filter && item.status !== "CLAIMED" && item.status !== "PENDING";
  }
  return true;
}

const isVideoUrl = (url: string) => url.startsWith("data:video") || /\.(mp4|webm|ogg)$/i.test(url);

/** A 16:9 picture or video, or a note when there is none. */
function Thumb({ url, alt, empty = "No image" }: { url?: string | null; alt: string; empty?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-kumo-recessed">
      {!url ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-kumo-subtle">{empty}</p>
      ) : isVideoUrl(url) ? (
        <video src={url} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline aria-label={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

/** A small button that opens the file picker. */
function FileButton({
  accept,
  onChange,
  children,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex h-6.5 cursor-pointer items-center rounded-md border border-kumo-line px-2 text-xs font-medium text-kumo-default hover:bg-kumo-tint focus-within:ring-2 focus-within:ring-kumo-brand">
      {children}
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}

function SaleGrid({
  sales,
  onImage,
  onDelete,
}: {
  sales: any[];
  onImage: (tenantId: string, saleId: string, title: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (tenantId: string, saleId: string) => void;
}) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sales.map((sale: any) => (
        <li key={sale.id} className={cn(CMS_CARD, !isSaleActive(sale) && "opacity-70")}>
          <Thumb url={sale.image_url} alt={sale.title} />
          <div className="flex flex-1 flex-col gap-1 p-4">
            <h3 className="text-base font-semibold text-kumo-default">{sale.title}</h3>
            <p className="text-sm text-kumo-subtle">{sale.shopName}</p>
            <p className="text-sm text-kumo-subtle">
              Posted {formatSaleDate(new Date(sale.date || new Date()))},{" "}
              <span className={cn("font-medium", isSaleActive(sale) ? "text-kumo-success" : "text-kumo-warning")}>
                {isSaleActive(sale) ? "ends" : "ended"} {formatSaleDate(saleEndsAt(sale))}
              </span>
            </p>
            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
              <FileButton accept="image/*,video/*" onChange={(e) => onImage(sale.tenantId, sale.id, sale.title, e)}>
                Change media
              </FileButton>
              <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => onDelete(sale.tenantId, sale.id)}>
                Delete
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold tracking-tight text-kumo-default">{title}</h2>
        <p className="text-sm text-kumo-subtle">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-kumo-default">{label}</p>
      {children}
    </div>
  );
}

// ─── General settings helpers ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;

/** Shown on the homepage (and previewed here) until a venue photo is uploaded. */
const DEFAULT_VENUE_IMAGE = "/images/storefront_hero_placeholder_2_1774159273401.png";

function validateConfig(config: Record<string, any>) {
  const errors: Record<string, string> = {};
  const val = (k: string) => String(config[k] ?? "").trim();
  if (!val("companyName")) errors.companyName = "Enter the mall name.";
  if (val("logoUrl") && !URL_RE.test(val("logoUrl"))) errors.logoUrl = "Must start with http:// or https://";
  for (const k of ["contactEmail", "footerEmail"])
    if (val(k) && !EMAIL_RE.test(val(k))) errors[k] = "Enter a valid email address.";
  for (const k of ["venueImageUrl", "googleMapsEmbedUrl", "footerInstagram", "footerFacebook", "footerWebsite"])
    if (val(k) && !URL_RE.test(val(k))) errors[k] = "Must start with https://";
  return errors;
}

function FieldError({ message }: { message: string }) {
  return <p className="text-sm font-medium text-kumo-danger">{message}</p>;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", error && "[&_.cms-input]:border-red-500!")}>
      <label className="block text-sm font-medium text-kumo-default">{label}</label>
      {children}
      {error ? <FieldError message={error} /> : hint ? <p className="text-sm text-kumo-subtle">{hint}</p> : null}
    </div>
  );
}

function SettingsCard({
  title,
  sub,
  badge,
  children,
}: {
  title: string;
  sub: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title} description={sub} actions={badge}>
      <div className="space-y-5">{children}</div>
    </Panel>
  );
}
