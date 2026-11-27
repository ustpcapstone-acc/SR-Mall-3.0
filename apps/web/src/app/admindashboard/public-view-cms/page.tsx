"use client";

import { confirmAction } from "@/components/confirm-dialog";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAboutPageAction,
  getPublicViewConfigAction,
  updatePublicViewConfigAction,
} from "@/app/actions/cms";
import { AboutEditor } from "@/components/admin/about-editor";
import { unnamedItem, type AboutPageContent } from "@/lib/about";
import { getLostAndFoundItems, updateLostAndFoundItemStatus, createLostAndFoundItem } from "@/app/actions/lost-and-found";
import { FileButton, Thumb } from "@/components/admin/media";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { getAllPostSalesAction, deleteAdminPostSaleAction, updateAdminPostSaleAction } from "@/app/actions/tenant";
import {
  Plus,
  Trash2,
  Edit,
  Image as ImageIcon,
  CheckCircle,
  Settings,
  Monitor,
  Save,
  Sparkles,
  Globe,
  Search,
  Upload,
  Phone,
} from "lucide-react";
import {
  PUBLIC_CONFIG_CACHE_KEY,
  mapEmbedSrc,
} from "@/lib/theme";
import clsx from "clsx";
import { Button, Select, cn } from "@cloudflare/kumo";
import { ArrowSquareOut, PencilSimple, Plus as PlusIcon, Trash } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, PageTabs, Panel } from "@/components/admin/page-kit";
import { formatSaleDate, isSaleActive, saleEndsAt } from "@/lib/post-sales";

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
  /** About Us content and section visibility; missing if it couldn't load. */
  aboutPage?: AboutPageContent;
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

  const [allPostSales, setAllPostSales] = useState<any[]>([]);
  // Running sales vs. ended ones (no longer on the public page), see lib/post-sales.
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

  const itemDraft = useDraft({
    form: "admin.lost-and-found",
    enabled: isLostFoundModalOpen,
    value: lostFoundForm,
    initial: {
      type: "FOUND" as "LOST" | "FOUND",
      title: "",
      description: "",
      location: "",
      date: new Date().toISOString().split("T")[0],
      imageUrl: "",
    },
    onRestore: setLostFoundForm,
  });

  const showToast = (msg: string, type: "success" | "error") => {
    if (type === "success") toast.success(msg);
    else toast.error(msg);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configData, aboutData, lostFoundData] = await Promise.all([
          getPublicViewConfigAction(),
          getAboutPageAction(),
          getLostAndFoundItems(),
        ]);

        setConfig((prev) => {
          const next = {
            ...prev,
            ...(configData ? { ...configData, companyName: configData.companyName || "SR MALL" } : {}),
            aboutPage: aboutData.success ? aboutData.data : undefined,
          };
          setSavedConfig(next);
          return next;
        });

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
  const configDraft = useDraft({
    form: "admin.website-content",
    enabled: savedConfig !== null,
    editing: true,
    value: config,
    initial: savedConfig ?? config,
    // An older draft may not hold the About Us content: keep what was loaded.
    onRestore: (saved) => setConfig((prev) => ({ ...prev, ...saved, aboutPage: saved.aboutPage ?? prev.aboutPage })),
  });
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

  const handleAboutChange = (change: (current: AboutPageContent) => AboutPageContent) =>
    setConfig((prev) => (prev.aboutPage ? { ...prev, aboutPage: change(prev.aboutPage) } : prev));

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
      const sent = await configDraft.send(async () => {
        await updatePublicViewConfigAction(config);
        return true;
      });
      if (!sent) return;
      configDraft.clear();
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
      const res = await itemDraft.send(() => createLostAndFoundItem({ ...lostFoundForm }));
      if (!res) return;
      if (res.success && res.data) {
        itemDraft.clear();
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
    { id: "about", label: "About Us page", icon: Info, desc: "Mission, services, features and visibility" },

    {
      id: "postsales",
      label: "Shop Sales Monitoring",
      icon: Monitor,
      desc: "Manage Tenant Sales Posts",
    },
    { id: "lostfound", label: "Lost & Found", icon: Search, desc: "Manage reported items" },
  ];

  return (
    <AdminPage
      title="Website Content"
      description="Manage sales announcements, lost and found and mall information shown to visitors."
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
                        placeholder="Items sold by the shops at SR Mall."
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
                        placeholder="Find the shops and places to eat at SR Mall."
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
                        placeholder="Units you can rent at SR Mall. Open one to see its size and ask about it."
                      />
                    </Field>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-kumo-line">
                    <p className="text-sm font-semibold text-kumo-default">
                      Venue booking
                    </p>
                    <Field label="Small label above the heading (optional)">
                      <input
                        value={config.venueEyebrow ?? ""}
                        onChange={(e) => handleConfigChange("venueEyebrow", e.target.value)}
                        className="cms-input"
                        placeholder="Leave empty for none"
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
                    <Field label="Heading" hint="Use a line break for “Find us” and “in Jasaan.”">
                      <textarea
                        value={config.locationTitle ?? ""}
                        onChange={(e) => handleConfigChange("locationTitle", e.target.value)}
                        className="cms-input min-h-[72px] resize-none"
                        placeholder={"Find us\nin Jasaan."}
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

              {/* ── Featured video ───────────────────────────────────────── */}
              <SettingsCard
                title="Featured video"
                sub="The video section below the featured products"
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
                        placeholder="See SR Mall."
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={config.videoDescription ?? ""}
                        onChange={(e) => handleConfigChange("videoDescription", e.target.value)}
                        className="cms-input min-h-[88px] resize-none"
                        placeholder="Watch a short video of the shops and dining at SR Mall."
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
                    placeholder="Shops, food and services in Misamis Oriental."
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

          {activeTab === "about" && (
            <div className="space-y-6">
              <SectionHeader
                title="About Us page"
                sub="Edit each section and choose which ones visitors see. Save changes to publish."
                action={
                  <a href="/about" target="_blank" rel="noopener noreferrer" className={cn(LINK_BUTTON, "border border-kumo-line text-kumo-default hover:bg-kumo-tint")}>
                    <ArrowSquareOut size={16} aria-hidden /> View page
                  </a>
                }
              />
              {configErrors.aboutPage && <FieldError message={configErrors.aboutPage} />}
              <AboutEditor
                config={config}
                about={config.aboutPage}
                onConfig={handleConfigChange}
                onAbout={handleAboutChange}
                onGeneral={() => setActiveTab("general")}
              />
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
          <DraftNote draft={configDraft} className="mt-6" />
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
  if (config.aboutPage && unnamedItem(config.aboutPage)) errors.aboutPage = "Give every service and feature a name.";
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
