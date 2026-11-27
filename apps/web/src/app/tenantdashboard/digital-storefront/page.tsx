"use client";

import { confirmAction } from "@/components/confirm-dialog";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Input, InputArea, Loader, Select, Switch, cn } from "@cloudflare/kumo";
import { Camera, Eye, FloppyDisk, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, PageTabs, Panel } from "@/components/admin/page-kit";
import { DigitalStorefront, StoreProduct } from "@/types/storefront";
import {
  updateStorefrontAction,
  getStorefrontAction,
} from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { PRODUCT_STATUS_OPTIONS, availabilityLabel, isOutOfStock } from "@/lib/products";
import { DEFAULT_SALE_DAYS, formatSaleDate, isSaleActive, phToday, saleEndDateInput, saleEndsAt } from "@/lib/post-sales";
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

// Matches the filter buttons on the public /products page.
const PRODUCT_CATEGORIES = ["Food", "Fashion", "Electronics", "Living", "Beauty"];

// Sensible default for a new item, based on the store's own category.
const defaultProductCategory = (storeCategory?: string | null) =>
  ({
    Fashion: "Fashion",
    Electronics: "Electronics",
    "Food & Dining": "Food",
    "Health & Beauty": "Beauty",
    "Home & Lifestyle": "Living",
  })[storeCategory || ""] || "";

const getSafeUrl =(url: string | null | undefined, index: number) => {
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

  /** The shop as last saved, to tell unsaved edits apart. */
  const [savedProfile, setSavedProfile] = useState<Partial<DigitalStorefront> | null>(null);
  const draft = useDraft({
    form: "tenant.storefront",
    workspace: true,
    enabled: Boolean(savedProfile),
    editing: true,
    value: savedProfile ? profile : null,
    initial: savedProfile,
    onRestore: (saved) => saved && setProfile(saved),
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "identity" | "gallery" | "catalog" | "postsales"
  >("identity");
  const [previewOpen, setPreviewOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    if (type === "success") toast.success(msg);
    else toast.error(msg);
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
        if (res.success && res.data) {
          setProfile(res.data);
          setSavedProfile(res.data);
        }
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
    const res = await draft.send(() => updateStorefrontAction(user.id, profile));
    if (!res) {
      setSaving(false);
      return;
    }
    if (res.success && res.data) {
      draft.clear();
      setProfile(res.data);
      setSavedProfile(res.data);
      showToast(
        "Saved. Your changes are live on the mall website.",
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
      category: defaultProductCategory(profile.category),
    };
    setProfile((prev) => ({
      ...prev,
      products: [...(prev.products || []), p],
    }));
  };

  const updateProduct = (
    i: number,
    field: keyof StoreProduct,
    value: StoreProduct[keyof StoreProduct],
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
    const p = { id, title: "", image_url: "", date: new Date().toISOString(), ends_at: phToday(DEFAULT_SALE_DAYS) };
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
    category: profile.category || "Fashion",
    logo_url: getSafeUrl(profile.logo_url, 0),
    gallery_urls: galleryUrls.length
      ? galleryUrls.map((u, i) => getSafeUrl(u, i + 1))
      : PLACEHOLDERS,
  };

  const TABS = [
    { value: "identity", label: "Brand Identity" },
    { value: "gallery", label: "Gallery" },
    { value: "catalog", label: "Products" },
    { value: "postsales", label: "Post Sales" },
  ];

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader size="lg" />
        <p className="text-sm text-kumo-subtle">Loading storefront...</p>
      </div>
    );
  }

  const products = profile.products ?? [];
  const sales = profile.post_sales ?? [];

  return (
    <AdminPage
      title="Digital Storefront"
      description="What shoppers see about your shop. Changes go live when you save."
      actions={
        <>
          <Switch
            label={profile.is_open ? "Shop is open" : "Shop is closed"}
            checked={!!profile.is_open}
            onCheckedChange={(v) => updateField("is_open", Boolean(v))}
          />
          <div className="lg:hidden">
            <Button variant="secondary" icon={<Eye />} onClick={() => setPreviewOpen(true)}>
              Preview
            </Button>
          </div>
          <Button variant="primary" icon={<FloppyDisk />} loading={saving} disabled={saving || uploading} onClick={handleSave}>
            {uploading ? "Uploading..." : "Save & Sync"}
          </Button>
        </>
      }
    >
      {/* Hidden file inputs */}
      <input type="file" hidden ref={logoInputRef} accept="image/*" onChange={(e) => handleImageUpload(e, "logo_url")} />
      <input type="file" hidden multiple ref={galleryInputRef} accept="image/*" onChange={(e) => handleImageUpload(e, "gallery_urls")} />

      <AdminDialog open={previewOpen} onClose={() => setPreviewOpen(false)} size="sm" title="Preview" description="Your shop card as shoppers see it.">
        <ShopCard shop={previewShop} />
      </AdminDialog>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <PageTabs tabs={TABS} value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} />
          <DraftNote draft={draft} />

          {activeTab === "identity" && (
            <Panel title="Brand identity" description="Logo, name and details shoppers use to find you.">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-kumo-line bg-kumo-recessed text-kumo-subtle">
                    {profile.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getSafeUrl(profile.logo_url, 0)} alt="Your logo" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <Camera size={24} aria-hidden />
                    )}
                  </span>
                  <div>
                    <Button variant="secondary" icon={<UploadSimple />} disabled={uploading} onClick={() => logoInputRef.current?.click()}>
                      {profile.logo_url ? "Change logo" : "Upload logo"}
                    </Button>
                    <p className="mt-1.5 text-sm text-kumo-subtle">A square picture works best.</p>
                  </div>
                </div>

                <Input
                  label="Business name"
                  placeholder="e.g. Rizal Fashion Hub"
                  value={profile.shop_name || ""}
                  onChange={(e) => updateField("shop_name", e.target.value)}
                  className="w-full"
                />
                <InputArea
                  label="Description"
                  placeholder="Describe your store to customers"
                  value={profile.description || ""}
                  onValueChange={(v) => updateField("description", v)}
                  rows={4}
                  className="w-full"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Store category"
                    description="Helps shoppers find you in the mall directory."
                    value={profile.category || "Fashion"}
                    items={Object.fromEntries(STORE_CATEGORIES.map((c) => [c, c]))}
                    onValueChange={(v) => v != null && updateField("category", v as string)}
                    className="w-full"
                  >
                    {STORE_CATEGORIES.map((c) => (
                      <Select.Option key={c} value={c}>
                        {c}
                      </Select.Option>
                    ))}
                  </Select>
                  <Input
                    label="Unit"
                    description="Assigned by the mall office. Switch shops in the Workspace menu."
                    value={profile.unit_id || ""}
                    readOnly
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-kumo-subtle">
                  Contact number and opening hours are in{" "}
                  <Link href="/tenantdashboard/profile-settings" className="font-medium text-kumo-link hover:underline">
                    Profile Settings
                  </Link>
                  .
                </p>
              </div>
            </Panel>
          )}

          {activeTab === "gallery" && (
            <Panel
              title="Store gallery"
              description={`Photos of your store and products. ${galleryUrls.length} of 10 used.`}
              actions={
                <Button variant="primary" icon={<UploadSimple />} loading={uploading} onClick={() => galleryInputRef.current?.click()}>
                  Upload photos
                </Button>
              }
            >
              {galleryUrls.length === 0 ? (
                <EmptyNote title="No photos yet">JPG, PNG or WEBP. The first photo is your shop card picture.</EmptyNote>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryUrls.map((url, i) => (
                    <li key={`${url}-${i}`} className="overflow-hidden rounded-lg border border-kumo-line">
                      <span className="relative block aspect-square bg-kumo-recessed">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSafeUrl(url, i + 1)} alt={`Gallery photo ${i + 1}`} className="absolute inset-0 size-full object-cover" />
                      </span>
                      <span className="flex justify-end p-2">
                        <Button
                          size="sm"
                          variant="secondary-destructive"
                          icon={<Trash />}
                          onClick={() => updateField("gallery_urls", galleryUrls.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTab === "catalog" && (
            <Panel
              title="Products"
              description="Items shown on your shop page and the mall's Products page."
              actions={
                <Button variant="primary" icon={<Plus />} onClick={addProduct}>
                  Add Item
                </Button>
              }
            >
              {products.length === 0 ? (
                <EmptyNote title="No products listed">Add products to show them on your public storefront.</EmptyNote>
              ) : (
                <ul className="space-y-4">
                  {products.map((product, index) => (
                    <li key={product.id} className="rounded-lg border border-kumo-line p-4">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <UploadBox
                          url={product.image_url ? getSafeUrl(product.image_url, index + 2) : ""}
                          accept="image/*"
                          label="Add photo"
                          alt={product.name || "Product photo"}
                          className="size-28"
                          onChange={(e) => handleProductImageUpload(e, index)}
                        />
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                          <Input
                            label="Product name"
                            value={product.name}
                            onChange={(e) => updateProduct(index, "name", e.target.value)}
                            placeholder="e.g. Leather Jacket"
                            className="w-full"
                          />
                          <Input
                            label="Price (₱)"
                            inputMode="decimal"
                            value={product.price}
                            onChange={(e) => updateProduct(index, "price", e.target.value)}
                            placeholder="e.g. 250"
                            className="w-full"
                          />
                          <Input
                            label="Stock"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            value={product.stock ?? ""}
                            onChange={(e) =>
                              updateProduct(
                                index,
                                "stock",
                                e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                              )
                            }
                            placeholder="e.g. 25"
                            className="w-full"
                          />
                          <Select
                            label="Category"
                            value={product.category || ""}
                            items={{ "": "Select category", ...Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c, c])) }}
                            onValueChange={(v) => updateProduct(index, "category", (v as string) ?? "")}
                            className="w-full"
                          >
                            <Select.Option value="">Select category</Select.Option>
                            {PRODUCT_CATEGORIES.map((c) => (
                              <Select.Option key={c} value={c}>
                                {c}
                              </Select.Option>
                            ))}
                          </Select>
                          <div className="sm:col-span-2">
                            <Select
                              label="Status"
                              description={
                                product.status === "HIDDEN"
                                  ? "Not shown to shoppers."
                                  : isOutOfStock(product)
                                    ? "Shown with an Out of stock note."
                                    : `Shown to shoppers. ${availabilityLabel(product)}.`
                              }
                              value={product.status || "AVAILABLE"}
                              items={Object.fromEntries(PRODUCT_STATUS_OPTIONS.map((o) => [o.value, o.label]))}
                              onValueChange={(v) => v != null && updateProduct(index, "status", v as StoreProduct["status"])}
                              className="w-full"
                            >
                              {PRODUCT_STATUS_OPTIONS.map((o) => (
                                <Select.Option key={o.value} value={o.value}>
                                  {o.label}
                                </Select.Option>
                              ))}
                            </Select>
                          </div>
                          <div className="sm:col-span-2">
                            <InputArea
                              label="Description"
                              value={product.description}
                              onValueChange={(v) => updateProduct(index, "description", v)}
                              rows={2}
                              placeholder="Short product description"
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end border-t border-kumo-line pt-3">
                        <Button
                          size="sm"
                          variant="secondary-destructive"
                          icon={<Trash />}
                          onClick={async () => {
                            if (await confirmAction({ title: "Remove this product?", description: "It leaves your shop when you save your changes.", confirmLabel: "Remove product" })) removeProduct(index);
                          }}
                        >
                          Remove product
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTab === "postsales" && (
            <Panel
              title="Shop sales"
              description="Sales, discounts and announcements shown on the public page."
              actions={
                <Button variant="primary" icon={<Plus />} onClick={addPostSale}>
                  Add Post
                </Button>
              }
            >
              {sales.length === 0 ? (
                <EmptyNote title="No posts yet">Add a post to show your shop sale on the mall website.</EmptyNote>
              ) : (
                <ul className="space-y-4">
                  {sales.map((post, index) => (
                    <li key={post.id} className="rounded-lg border border-kumo-line p-4">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <UploadBox
                          url={post.image_url || ""}
                          accept="image/*,video/*"
                          label="Add photo or video"
                          alt={post.title || "Sale picture"}
                          className="h-36 w-full sm:w-48"
                          onChange={(e) => handlePostSaleImageUpload(e, index)}
                        />
                        <div className="min-w-0 flex-1 space-y-3">
                          <Input
                            label="Sale title or announcement"
                            value={post.title}
                            onChange={(e) => updatePostSale(index, "title", e.target.value)}
                            placeholder="e.g. 50% off this weekend"
                            className="w-full"
                          />
                          <Input
                            label="Ends on"
                            type="date"
                            value={saleEndDateInput(post)}
                            min={phToday()}
                            onChange={(e) => updatePostSale(index, "ends_at", e.target.value)}
                            className="w-full"
                          />
                          <p className={cn("text-sm", isSaleActive(post) ? "text-kumo-subtle" : "font-medium text-kumo-warning")}>
                            {isSaleActive(post)
                              ? `Shown on the public page until ${formatSaleDate(saleEndsAt(post))}`
                              : "Ended. Pick a new date to show it again."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end border-t border-kumo-line pt-3">
                        <Button
                          size="sm"
                          variant="secondary-destructive"
                          icon={<Trash />}
                          onClick={async () => {
                            if (await confirmAction({ title: "Remove this post?", description: "It leaves your shop when you save your changes.", confirmLabel: "Remove post" })) removePostSale(index);
                          }}
                        >
                          Remove post
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        {/* Live preview (wide screens) */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-kumo-default">Preview</h2>
              <p className="text-sm text-kumo-subtle">Updates as you type. Shoppers see it after you save.</p>
            </div>
            <ShopCard shop={previewShop} />
          </div>
        </aside>
      </div>
    </AdminPage>
  );
}

/** A picture box that opens the file picker. */
function UploadBox({
  url,
  accept,
  label,
  alt,
  className,
  onChange,
}: {
  url: string;
  accept: string;
  label: string;
  alt: string;
  className: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isVideo = url.startsWith("data:video") || /\.(mp4|webm|ogg)$/i.test(url);
  return (
    <label
      className={cn(
        "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-kumo-line bg-kumo-recessed text-center focus-within:ring-2 focus-within:ring-kumo-brand hover:border-kumo-brand",
        className,
      )}
    >
      <input type="file" className="sr-only" accept={accept} aria-label={url ? "Change file" : label} onChange={onChange} />
      {!url ? (
        <span className="flex flex-col items-center gap-1 p-2 text-sm text-kumo-subtle">
          <Camera size={20} aria-hidden />
          {label}
        </span>
      ) : (
        <>
          {isVideo ? (
            <video src={url} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" aria-label={alt} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="absolute inset-0 size-full object-cover" />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs font-medium text-white">Change</span>
        </>
      )}
    </label>
  );
}
