"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Input, InputArea, Loader, Select, cn } from "@cloudflare/kumo";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import { AdminPage, EmptyNote, Panel, Stat, StatRow } from "@/components/admin/page-kit";
import { useAuth } from "@/app/providers";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import {
  createTenantPromo,
  getPromosByTenant,
  deletePromo,
  getTenantByUserId,
} from "@/app/actions/ads";
import { getCloudStorageProvider } from "@/lib/cloud-storage";
import { phDayEnd, phDayStart } from "@/lib/ph-date";
import { phToday } from "@/lib/post-sales";
import { ChatConfirmModal } from "@/components/chat/chat-ui";

const CATEGORIES = [
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

export default function AdPromoManager() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fashion");
  // Philippine dates: the browser's UTC date is a day behind before 8 AM.
  const today = phToday();
  const futureDate = phToday(30);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(futureDate);
  const [promoImage, setPromoImage] = useState("");
  const [promoVideo, setPromoVideo] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [storageKey, setStorageKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const draft = useDraft({
    form: "tenant.promotion",
    workspace: true,
    value: { title, description, category, startDate, endDate, promoImage, promoVideo, mediaType, storageKey },
    initial: {
      title: "",
      description: "",
      category: "Fashion",
      startDate: today,
      endDate: futureDate,
      promoImage: "",
      promoVideo: "",
      mediaType: "IMAGE" as "IMAGE" | "VIDEO",
      storageKey: "",
    },
    onRestore: (saved) => {
      setTitle(saved.title);
      setDescription(saved.description);
      setCategory(saved.category);
      setStartDate(saved.startDate);
      setEndDate(saved.endDate);
      setPromoImage(saved.promoImage);
      setPromoVideo(saved.promoVideo);
      setMediaType(saved.mediaType);
      setStorageKey(saved.storageKey);
    },
  });

  const showToast = (msg: string, type: "success" | "error") => {
    if (type === "success") toast.success(msg);
    else toast.error(msg);
  };

  useEffect(() => {
    if (user?.id) {
      fetchPromos();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchPromos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const tenant = await getTenantByUserId(user.id);
      if (tenant) {
        setPromos(await getPromosByTenant(tenant.id, tenant.shopId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(
        `File must be under 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        "error",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await getCloudStorageProvider().uploadFile(
        file,
        "tenant-promos",
      );
      const type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      setMediaType(type);
      if (type === "VIDEO") {
        setPromoVideo(result.url);
        setPromoImage("");
      } else {
        setPromoImage(result.url);
        setPromoVideo("");
      }
      setStorageKey(result.key);
      showToast("Media uploaded successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !user?.id ||
      !title ||
      !startDate ||
      !endDate ||
      (!promoImage && !promoVideo)
    )
      return;
    if (endDate < startDate) {
      showToast("The end date must be on or after the start date.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await draft.send(async () => {
        const tenant = await getTenantByUserId(user.id);
        if (!tenant) return { success: false, error: "No tenant profile found. Contact admin." };
        return createTenantPromo({
          tenantId: tenant.id,
          shopId: tenant.shopId,
          title,
          description,
          category,
          startDate: phDayStart(startDate),
          endDate: phDayEnd(endDate),
          promoImage: mediaType === "IMAGE" ? promoImage : undefined,
          promoVideo: mediaType === "VIDEO" ? promoVideo : undefined,
          mediaType,
          storageKey,
        });
      });
      if (!created) return;
      if (!created.success) {
        showToast(created.error || "Couldn't submit the promotion.", "error");
        return;
      }
      draft.clear();
      setTitle("");
      setDescription("");
      setCategory("Fashion");
      setStartDate(today);
      setEndDate(futureDate);
      setPromoImage("");
      setPromoVideo("");
      setStorageKey("");
      fetchPromos();
      showToast("Promotion submitted! Awaiting admin review.", "success");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deletePromo(deleteTarget.id, user?.id);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (res.success) {
      fetchPromos();
      showToast("Promotion deleted.", "success");
    } else {
      showToast(res.error || "Couldn't delete the promotion.", "error");
    }
  };

  // What each campaign is doing right now.
  const now = new Date();
  const stateOf = (p: any) => {
    if (p.status === "PENDING") return { label: "Waiting for approval", tone: "text-kumo-warning" };
    if (p.status === "REJECTED") return { label: "Rejected", tone: "text-kumo-danger" };
    if (new Date(p.endDate) < now) return { label: "Ended", tone: "text-kumo-subtle" };
    if (new Date(p.startDate) > now) return { label: "Approved, starts later", tone: "text-kumo-default" };
    return { label: "Live now", tone: "text-kumo-success" };
  };
  const live = promos.filter((p) => stateOf(p).label === "Live now").length;
  const pending = promos.filter((p) => p.status === "PENDING").length;
  const rejected = promos.filter((p) => p.status === "REJECTED").length;
  const day = (value: string | Date, year?: boolean) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });

  const hasMedia = !!(promoImage || promoVideo);

  return (
    <AdminPage title="Ad & Promo Manager" description="Send a promotion to the mall office. Approved ones show across the mall website.">
      <StatRow>
        <Stat label="All promotions" value={loading ? "..." : promos.length} />
        <Stat label="Live now" value={loading ? "..." : live} tone="success" />
        <Stat label="Waiting for approval" value={loading ? "..." : pending} tone={pending ? "warning" : "default"} />
        <Stat label="Rejected" value={loading ? "..." : rejected} tone={rejected ? "danger" : "default"} />
      </StatRow>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-5 xl:col-span-4" title="New promotion" description="Usually reviewed within 24 hours.">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 50% off this weekend"
              className="w-full"
            />
            <InputArea
              label="Description (optional)"
              rows={3}
              value={description}
              onValueChange={setDescription}
              placeholder="What's the offer?"
              className="w-full"
            />
            <Select
              label="Category"
              value={category}
              items={Object.fromEntries(CATEGORIES.map((c) => [c, c]))}
              onValueChange={(v) => v != null && setCategory(v as string)}
              className="w-full"
            >
              {CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Starts" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
              <Input label="Ends" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-kumo-default">Picture or video</p>
              <label className="relative flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-kumo-line bg-kumo-recessed text-center focus-within:ring-2 focus-within:ring-kumo-brand hover:border-kumo-brand">
                <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} aria-label="Upload a picture or video" className="sr-only" />
                {hasMedia ? (
                  <>
                    {mediaType === "VIDEO" ? (
                      <video src={promoVideo} className="absolute inset-0 size-full object-cover" autoPlay muted loop />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={promoImage} alt="Preview" className="absolute inset-0 size-full object-cover" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-sm font-medium text-white">
                      Change {mediaType === "VIDEO" ? "video" : "picture"}
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center gap-1 p-4 text-sm text-kumo-subtle">
                    <UploadSimple size={24} aria-hidden />
                    <span className="font-medium text-kumo-default">Click to upload</span>
                    Picture or video, up to 50 MB
                  </span>
                )}
              </label>
            </div>

            <DraftNote draft={draft} />

            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || !hasMedia || !title} className="w-full justify-center">
              Submit Promotion
            </Button>
            {(!hasMedia || !title) && <p className="text-sm text-kumo-subtle">Add a title and a picture or video to submit.</p>}
          </form>
        </Panel>

        <Panel
          className="lg:col-span-7 xl:col-span-8"
          flush
          title="Your promotions"
          description={`${promos.length} sent`}
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : promos.length === 0 ? (
            <EmptyNote title="No promotions yet">Send your first one with the form. It will show here with its status.</EmptyNote>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {promos.map((promo) => {
                const state = stateOf(promo);
                return (
                  <li key={promo.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                    <span className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-kumo-recessed sm:w-40">
                      {promo.mediaType === "VIDEO" ? (
                        <video src={promo.promoVideo} className="absolute inset-0 size-full object-cover" autoPlay muted loop />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={promo.promoImage} alt={promo.title} className="absolute inset-0 size-full object-cover" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-kumo-default">{promo.title}</h3>
                      {promo.description && <p className="line-clamp-2 text-sm text-kumo-subtle">{promo.description}</p>}
                      <p className="mt-1 text-sm text-kumo-subtle">
                        {day(promo.startDate)} to {day(promo.endDate, true)}
                        {promo.category && `, ${promo.category}`}
                      </p>
                      <p className={cn("mt-1 text-sm font-semibold", state.tone)}>{state.label}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => setDeleteTarget(promo)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {deleteTarget && (
        <ChatConfirmModal
          title="Delete this promotion?"
          message={
            deleteTarget.status === "APPROVED" && new Date(deleteTarget.endDate) >= new Date()
              ? `"${deleteTarget.title}" is live. Deleting it removes it from the mall website right away, along with its uploaded media. This can't be undone.`
              : `"${deleteTarget.title}" and its uploaded media will be removed from your campaign history. This can't be undone.`
          }
          confirmLabel="Delete promotion"
          busy={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </AdminPage>
  );
}
