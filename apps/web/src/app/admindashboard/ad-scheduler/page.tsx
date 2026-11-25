"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Input, InputArea, Loader, Select, cn } from "@cloudflare/kumo";
import { ArrowClockwise, CaretDown, CaretUp, PencilSimple, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Stat, StatRow, PageTabs } from "@/components/admin/page-kit";
import {
  createMallAd,
  getPendingPromos,
  updatePromoStatus,
  deleteMallAd,
  updateMallAd,
  getAllMallAds,
  getLivePromosAction,
  getPromoHistoryAction,
} from "@/app/actions/ads";
import { formatPHDate, phDayEnd, phDayStart, toPHDateInput } from "@/lib/ph-date";
import { ChatConfirmModal } from "@/components/chat/chat-ui";
import { useAuth } from "@/app/providers";

const PRIORITY_ITEMS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

type AdStatus = "DEFAULT" | "LIVE" | "SCHEDULED" | "EXPIRED";

/** Where a banner stands right now (drives the badges and the counts). */
function adStatus(ad: any): AdStatus {
  if (ad.isDefault) return "DEFAULT";
  const now = Date.now();
  if (new Date(ad.endDate).getTime() < now) return "EXPIRED";
  if (new Date(ad.startDate).getTime() > now) return "SCHEDULED";
  return "LIVE";
}

const STATUS_UI: Record<AdStatus, { label: string; className: string }> = {
  DEFAULT: { label: "Default, always shown", className: "text-kumo-success" },
  LIVE: { label: "Live now", className: "text-kumo-success" },
  SCHEDULED: { label: "Scheduled", className: "text-kumo-default" },
  EXPIRED: { label: "Expired", className: "text-kumo-subtle" },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  imageUrl: "",
  linkUrl: "/",
  priority: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
  startDate: "",
  endDate: "",
  isCloudStored: false,
  storageKey: "",
};

export default function AdScheduler() {
  const { user } = useAuth();
  const [mallAds, setMallAds] = useState<any[]>([]);
  const [pendingPromos, setPendingPromos] = useState<any[]>([]);
  const [livePromos, setLivePromos] = useState<any[]>([]);
  const [promoHistory, setPromoHistory] = useState<any[]>([]);
  const [promoTab, setPromoTab] = useState<"pending" | "live" | "history">("pending");
  const [showAdHistory, setShowAdHistory] = useState(false);
  /** Reject a pending promo or take down a live one (with an optional reason). */
  const [promoAction, setPromoAction] = useState<{ promo: any; kind: "reject" | "takedown" } | null>(null);
  const [promoReason, setPromoReason] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [deleteAdTarget, setDeleteAdTarget] = useState<any>(null);
  const [deletingAd, setDeletingAd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Active/scheduled banners stay in the main carousel; ended ones move to
  // the read-only history drawer so the working view stays uncluttered.
  const activeMallAds = mallAds.filter((ad) => adStatus(ad) !== "EXPIRED");
  const expiredMallAds = mallAds.filter((ad) => adStatus(ad) === "EXPIRED");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [globalAds, approvals, live, history] = await Promise.all([
        getAllMallAds(),
        getPendingPromos(),
        getLivePromosAction(),
        getPromoHistoryAction(),
      ]);
      setMallAds(globalAds);
      setPendingPromos(approvals);
      setLivePromos(live);
      setPromoHistory(history);
    } catch (error) {
      showToast("Failed to fetch ad data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast(
        `File must be under 50MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        "error",
      );
      return;
    }
    setUploading(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const result = await getCloudStorageProvider().uploadFile(file, "ads");
      setFormData((prev) => ({
        ...prev,
        imageUrl: result.url,
        isCloudStored: true,
        storageKey: result.key,
      }));
      showToast("Media uploaded to cloud storage!", "success");
    } catch (error: any) {
      showToast(error.message || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateMallAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return showToast("Authentication required", "error");
    if (!formData.imageUrl)
      return showToast("Please upload media or enter a URL", "error");

    setPublishing(true);
    try {
      if (!formData.startDate || !formData.endDate) {
        showToast("Please select a valid date range", "error");
        setPublishing(false);
        return;
      }
      if (formData.endDate < formData.startDate) {
        showToast("The end date must be on or after the start date", "error");
        setPublishing(false);
        return;
      }

      const res = await createMallAd({
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl || "/",
        priority: formData.priority,
        startDate: phDayStart(formData.startDate),
        endDate: phDayEnd(formData.endDate),
        adminId: user.id,
        storageKey: formData.storageKey || null,
      });

      if (res.success) {
        showToast("Global Ad Deployed Successfully!", "success");
        setIsModalOpen(false);
        setFormData(EMPTY_FORM);
        await fetchData();
      } else {
        showToast(
          "Deployment Failed: " + (res.error || "Internal error occurred"),
          "error",
        );
      }
    } catch (error: any) {
      showToast("Critical Error: " + error.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleEditAd = (ad: any) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || "",
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || "/",
      priority: ad.priority,
      startDate: toPHDateInput(ad.startDate),
      endDate: toPHDateInput(ad.endDate),
      isCloudStored: !!ad.storageKey,
      storageKey: ad.storageKey || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    setPublishing(true);
    try {
      if (!formData.startDate || !formData.endDate) {
        showToast("Please select valid campaign dates", "error");
        setPublishing(false);
        return;
      }

      const isDefaultAd = !!editingAd.isDefault;
      if (!isDefaultAd && formData.endDate < formData.startDate) {
        showToast("The end date must be on or after the start date", "error");
        setPublishing(false);
        return;
      }
      const res = await updateMallAd(editingAd.id, {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl || "/",
        priority: formData.priority,
        startDate: phDayStart(formData.startDate),
        endDate: isDefaultAd ? new Date("2099-12-31T23:59:59.000Z") : phDayEnd(formData.endDate),
        storageKey: formData.storageKey || null,
      });

      if (res.success) {
        showToast("Campaign Updated Successfully!", "success");
        setIsEditModalOpen(false);
        setEditingAd(null);
        setFormData(EMPTY_FORM);
        await fetchData();
      } else {
        showToast(
          "Update Failed: " + (res.error || "Internal error occurred"),
          "error",
        );
      }
    } catch (error: any) {
      showToast("Critical Error: " + error.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const confirmDeleteAd = async () => {
    if (!deleteAdTarget) return;
    setDeletingAd(true);
    try {
      const res = await deleteMallAd(deleteAdTarget.id);
      if (res.success) {
        showToast("Banner deleted", "success");
        fetchData();
      } else {
        showToast(res.error || "Couldn't delete the banner", "error");
      }
    } catch (error: any) {
      showToast("Error: " + error.message, "error");
    } finally {
      setDeletingAd(false);
      setDeleteAdTarget(null);
    }
  };

  const approvePromo = async (promo: any) => {
    const res = await updatePromoStatus(promo.id, "APPROVED");
    if (res.success) {
      showToast(
        new Date(promo.startDate).getTime() > Date.now() ? "Promo approved — it goes live on its start date" : "Promo approved & live!",
        "success",
      );
      fetchData();
    } else {
      showToast(res.error || "Couldn't approve the promo", "error");
    }
  };

  const confirmPromoAction = async () => {
    if (!promoAction) return;
    setPromoBusy(true);
    const res = await updatePromoStatus(promoAction.promo.id, "REJECTED", promoReason);
    setPromoBusy(false);
    if (res.success) {
      showToast(promoAction.kind === "takedown" ? "Promo taken down" : "Promo rejected", "success");
      setPromoAction(null);
      setPromoReason("");
      fetchData();
    } else {
      showToast(res.error || "Couldn't update the promo", "error");
    }
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setFormData(EMPTY_FORM);
  };
  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  // ─── Shared Form Fields ───
  const renderFormFields = (
    onSubmit: (e: React.FormEvent) => void,
    isEdit = false,
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Campaign title"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g. Grand Holiday Sale"
          className="w-full"
        />
        <Select
          label="Priority"
          value={formData.priority}
          items={PRIORITY_ITEMS}
          onValueChange={(v) => v && setFormData({ ...formData, priority: v as "HIGH" | "MEDIUM" | "LOW" })}
          className="w-full"
        >
          {Object.entries(PRIORITY_ITEMS).map(([value, label]) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
      </div>

      <Input
        label="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Short tagline for this campaign"
        className="w-full"
      />

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label={formData.isCloudStored ? "Media (uploaded)" : "Media address"}
              required={!formData.isCloudStored}
              disabled={formData.isCloudStored}
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full"
            />
          </div>
          {formData.isCloudStored ? (
            <Button
              type="button"
              variant="secondary-destructive"
              onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "", isCloudStored: false, storageKey: "" }))}
            >
              Remove
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                icon={<UploadSimple />}
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                Upload
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="sr-only"
                tabIndex={-1}
                aria-label="Upload an image or video"
                disabled={uploading}
              />
            </>
          )}
        </div>
        {/^(https?:|\/)/.test(formData.imageUrl) && (
          <div className="h-28 overflow-hidden rounded-lg border border-kumo-line bg-kumo-recessed">
            <Media url={formData.imageUrl} alt="Preview" className="size-full object-cover" />
          </div>
        )}
      </div>

      <Input
        label="Opens this page when clicked"
        value={formData.linkUrl}
        onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
        placeholder="/"
        className="w-full"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start date"
          required
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        />
        <Input
          label="End date"
          required
          type="date"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={closeForm}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={publishing}>
          {isEdit ? "Update Ad" : "Publish ad"}
        </Button>
      </div>
    </form>
  );

  const liveBanners = mallAds.filter((a) => ["DEFAULT", "LIVE"].includes(adStatus(a))).length;
  const scheduledBanners = mallAds.filter((a) => adStatus(a) === "SCHEDULED").length;
  const liveTenantPromos = livePromos.filter((p) => new Date(p.startDate).getTime() <= Date.now()).length;
  const promos = promoTab === "pending" ? pendingPromos : promoTab === "live" ? livePromos : promoHistory;
  const whenText = (ad: any, status: AdStatus) =>
    status === "DEFAULT"
      ? "Always active"
      : status === "SCHEDULED"
        ? `Starts ${formatPHDate(ad.startDate)}`
        : status === "EXPIRED"
          ? `Ended ${formatPHDate(ad.endDate)}`
          : `Until ${formatPHDate(ad.endDate)}`;

  return (
    <>
      {toast && (
        <div
          role="status"
          className="fixed right-4 top-24 z-300 flex max-w-sm items-start gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4 shadow-lg"
        >
          <p className={cn("text-sm font-medium", toast.type === "success" ? "text-kumo-success" : "text-kumo-danger")}>
            {toast.msg}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setToast(null)}>
            Close
          </Button>
        </div>
      )}

      <AdminPage
        title="Ad Scheduler"
        description="Publish mall-wide banners and approve tenant promotional submissions."
        actions={
          <>
            <Button variant="secondary" icon={<ArrowClockwise />} loading={loading} onClick={fetchData}>
              Refresh
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={openCreate}>
              Create Mall-Wide Ad
            </Button>
          </>
        }
      >
        <StatRow>
          <Stat label="Live banners" value={loading ? "-" : liveBanners} />
          <Stat label="Scheduled banners" value={loading ? "-" : scheduledBanners} />
          <Stat
            label="Promos waiting for review"
            value={loading ? "-" : pendingPromos.length}
            tone={pendingPromos.length ? "warning" : "default"}
            onClick={() => setPromoTab("pending")}
          />
          <Stat label="Live tenant promos" value={loading ? "-" : liveTenantPromos} onClick={() => setPromoTab("live")} />
        </StatRow>

        {/* Tenant promos come first: they are what needs a decision. */}
        <Panel title="Tenant promos" description="Review and approve merchant promotion requests" flush>
          <div className="border-b border-kumo-line p-4 sm:px-5">
            <PageTabs
              value={promoTab}
              onValueChange={(v) => setPromoTab(v as "pending" | "live" | "history")}
              tabs={[
                { value: "pending", label: `Pending review (${pendingPromos.length})` },
                { value: "live", label: `Live & scheduled (${livePromos.length})` },
                { value: "history", label: `History (${promoHistory.length})` },
              ]}
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : promos.length === 0 ? (
            <EmptyNote
              title={
                promoTab === "pending" ? "All caught up" : promoTab === "live" ? "No live tenant promos" : "No promo history yet"
              }
            >
              {promoTab === "pending"
                ? "No promotion requests are waiting."
                : promoTab === "live"
                  ? "Approved promos show here until they end."
                  : "Rejected, taken-down and ended promos are archived here."}
            </EmptyNote>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {promos.map((promo) => {
                const ended = new Date(promo.endDate).getTime() < Date.now();
                const scheduled = new Date(promo.startDate).getTime() > Date.now();
                const state =
                  promoTab === "history"
                    ? promo.status === "REJECTED"
                      ? { label: "Rejected or taken down", className: "text-kumo-danger" }
                      : { label: "Ended", className: "text-kumo-subtle" }
                    : promoTab === "live"
                      ? scheduled
                        ? { label: "Scheduled", className: "text-kumo-default" }
                        : { label: "Live now", className: "text-kumo-success" }
                      : ended
                        ? { label: "Dates passed, can't go live", className: "text-kumo-subtle" }
                        : { label: "Waiting for review", className: "text-kumo-warning" };
                return (
                  <li key={promo.id} className="flex flex-col gap-4 p-4 sm:px-5 md:flex-row md:items-center">
                    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-kumo-line bg-kumo-recessed md:w-44">
                      <Media url={promo.promoVideo || promo.promoImage} video={!!promo.promoVideo} alt={promo.title} className="absolute inset-0 size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-kumo-default">{promo.title}</h3>
                      <p className="text-sm text-kumo-subtle">
                        {promo.tenant?.shopName || "Tenant"}
                        {promo.tenant?.unitId ? `, Unit ${promo.tenant.unitId}` : ""}, {promo.category}
                      </p>
                      <p className="text-sm text-kumo-default">
                        {formatPHDate(promo.startDate)} to {formatPHDate(promo.endDate)}
                      </p>
                      <p className={cn("mt-1 text-sm font-medium", state.className)}>{state.label}</p>
                    </div>
                    {promoTab === "pending" && (
                      <div className="flex shrink-0 justify-end gap-2">
                        <Button
                          variant="secondary-destructive"
                          onClick={() => {
                            setPromoReason(ended ? "The campaign dates have already passed." : "");
                            setPromoAction({ promo, kind: "reject" });
                          }}
                        >
                          Reject
                        </Button>
                        {!ended && (
                          <Button variant="primary" onClick={() => approvePromo(promo)}>
                            Approve
                          </Button>
                        )}
                      </div>
                    )}
                    {promoTab === "live" && (
                      <div className="flex shrink-0 justify-end">
                        <Button
                          variant="secondary-destructive"
                          onClick={() => {
                            setPromoReason("");
                            setPromoAction({ promo, kind: "takedown" });
                          }}
                        >
                          Take down
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Mall banner carousel" description="Banners displayed on the homepage carousel">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : activeMallAds.length === 0 ? (
            <EmptyNote
              title="No active mall-wide ads"
              action={
                <Button variant="primary" icon={<Plus />} onClick={openCreate}>
                  Create the first ad
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeMallAds.map((ad) => {
                const status = adStatus(ad);
                const ui = STATUS_UI[status];
                return (
                  <li key={ad.id} className="flex flex-col overflow-hidden rounded-lg border border-kumo-line">
                    <div className="relative aspect-video w-full overflow-hidden bg-kumo-recessed">
                      <Media url={ad.imageUrl} alt={ad.title} className="absolute inset-0 size-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h3 className="truncate text-base font-semibold text-kumo-default">{ad.title}</h3>
                      <p className="line-clamp-1 text-sm text-kumo-subtle">
                        {ad.description || "Announcement for all mall visitors."}
                      </p>
                      <p className="text-sm">
                        <span className={cn("font-medium", ui.className)}>{ui.label}</span>
                        <span className="text-kumo-subtle">
                          {status === "DEFAULT" ? "" : `, ${whenText(ad, status)}`}
                        </span>
                      </p>
                      <p className="text-sm text-kumo-subtle">{PRIORITY_ITEMS[ad.priority] ?? ad.priority} priority</p>
                      <div className="mt-auto flex justify-end gap-2 pt-3">
                        <Button size="sm" variant="secondary" icon={<PencilSimple />} onClick={() => handleEditAd(ad)}>
                          Edit
                        </Button>
                        {!ad.isDefault && (
                          <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => setDeleteAdTarget(ad)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {expiredMallAds.length > 0 && (
            <div className="mt-5 border-t border-kumo-line pt-4">
              <Button
                variant="ghost"
                aria-expanded={showAdHistory}
                icon={showAdHistory ? <CaretUp /> : <CaretDown />}
                onClick={() => setShowAdHistory((value) => !value)}
              >
                Banner history ({expiredMallAds.length})
              </Button>
              {showAdHistory && (
                <ul className="mt-3 divide-y divide-kumo-line rounded-lg border border-kumo-line">
                  {expiredMallAds.map((ad) => (
                    <li key={ad.id} className="flex items-center gap-3 p-3">
                      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-kumo-recessed">
                        <Media url={ad.imageUrl} alt={ad.title} still className="size-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-kumo-default">{ad.title}</p>
                        <p className="text-sm text-kumo-subtle">
                          Ended {formatPHDate(ad.endDate)}, {PRIORITY_ITEMS[ad.priority] ?? ad.priority} priority
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary-destructive"
                        shape="square"
                        icon={<Trash />}
                        aria-label={`Delete ${ad.title}`}
                        onClick={() => setDeleteAdTarget(ad)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </AdminPage>

      {deleteAdTarget && (
        <ChatConfirmModal
          title="Delete this banner?"
          message={`"${deleteAdTarget.title}" will be removed from the homepage carousel and its media deleted. This can't be undone.`}
          confirmLabel="Delete banner"
          busy={deletingAd}
          onCancel={() => setDeleteAdTarget(null)}
          onConfirm={confirmDeleteAd}
        />
      )}

      <AdminDialog
        open={!!promoAction}
        onClose={() => !promoBusy && setPromoAction(null)}
        size="sm"
        title={promoAction?.kind === "takedown" ? "Take down this promo?" : "Reject this promo?"}
        description={
          promoAction
            ? `"${promoAction.promo.title}" by ${promoAction.promo.tenant?.shopName || "the tenant"}${
                promoAction.kind === "takedown" ? " will be removed from the site right away." : " won't be published."
              } The tenant is notified.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" disabled={promoBusy} onClick={() => setPromoAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={promoBusy} onClick={confirmPromoAction}>
              {promoAction?.kind === "takedown" ? "Take down" : "Reject"}
            </Button>
          </>
        }
      >
        <InputArea
          label="Reason (optional, sent to the tenant)"
          value={promoReason}
          onValueChange={setPromoReason}
          rows={3}
          maxLength={300}
          placeholder="e.g. The image is low quality. Please upload a clearer version."
          className="w-full"
        />
      </AdminDialog>

      <AdminDialog open={isModalOpen} onClose={closeForm} title="Create a mall-wide ad">
        {renderFormFields(handleCreateMallAd, false)}
      </AdminDialog>

      <AdminDialog open={isEditModalOpen} onClose={closeForm} title="Edit ad campaign">
        {editingAd?.isDefault && (
          <p className="mb-4 rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
            <strong>Default mall banner:</strong> it is permanent and always shown in the carousel. You can change its title,
            text, priority and media.
          </p>
        )}
        {renderFormFields(handleUpdateAd, true)}
      </AdminDialog>
    </>
  );
}

/** An ad's picture, or its video (muted; `still` doesn't play it). */
function Media({
  url,
  alt,
  className,
  video,
  still,
}: {
  url?: string | null;
  alt: string;
  className: string;
  video?: boolean;
  still?: boolean;
}) {
  if (!url) return null;
  if (video || /\.(mp4|webm|mov|ogg)$/i.test(url) || url.includes("/video/upload/")) {
    return <video src={url} className={className} muted autoPlay={!still} loop={!still} playsInline aria-label={alt} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
