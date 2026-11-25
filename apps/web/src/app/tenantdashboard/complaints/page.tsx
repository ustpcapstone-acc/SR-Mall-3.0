"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input, InputArea, Loader, Select, cn } from "@cloudflare/kumo";
import { ArrowClockwise, Camera, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { createComplaintAction, getComplaintAction, getMyComplaintsAction } from "@/app/actions/complaint";
import { announceComplaintsChanged } from "@/lib/complaint-unread";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  DETAILS_MAX,
  MAX_PHOTOS,
  PRIORITY_META,
  SUBJECT_MAX,
  type ComplaintDetail,
  type ComplaintPriority,
  type ComplaintSummary,
} from "@/lib/complaints";
import {
  ComplaintView,
  PriorityBadge,
  StatusBadge,
  formatWhen,
  uploadComplaintPhoto,
} from "@/components/complaints/complaint-view";
import { AdminDialog, AdminPage, EmptyNote, PageTabs, Panel } from "@/components/admin/page-kit";

function NewComplaintModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("NORMAL");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadComplaintPhoto(f);
      if (url) urls.push(url);
    }
    setUploading(false);
    setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    setSaving(true);
    const res = await createComplaintAction(userId, { category, subject, details, priority, photos });
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Complaint sent to the mall admin");
    announceComplaintsChanged();
    onCreated(res.id);
  };

  return (
    <AdminDialog
      open
      onClose={onClose}
      title="New complaint"
      description="Sent straight to the mall admin. You'll be notified when they reply."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={saving || uploading} onClick={submit}>
            Send complaint
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Category"
          value={category}
          items={{ "": "Select a category", ...Object.fromEntries(COMPLAINT_CATEGORIES.map((c) => [c, c])) }}
          onValueChange={(v) => setCategory((v as string) ?? "")}
          className="w-full"
        >
          <Select.Option value="">Select a category</Select.Option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <Select.Option key={c} value={c}>
              {c}
            </Select.Option>
          ))}
        </Select>

        <div className="space-y-1">
          <Input
            label="Subject"
            value={subject}
            maxLength={SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Ceiling leak near the counter"
            className="w-full"
          />
          <p className="text-right text-xs text-kumo-subtle">
            {subject.length}/{SUBJECT_MAX}
          </p>
        </div>

        <div className="space-y-1">
          <InputArea
            label="Details"
            value={details}
            maxLength={DETAILS_MAX}
            onValueChange={setDetails}
            rows={5}
            placeholder="What happened, where exactly, and since when?"
            className="w-full"
          />
          <p className="text-right text-xs text-kumo-subtle">
            {details.length}/{DETAILS_MAX}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-kumo-default">Priority</p>
          <div role="group" aria-label="Priority" className="flex flex-wrap gap-2">
            {COMPLAINT_PRIORITIES.map((p) => (
              <Button key={p} type="button" variant={priority === p ? "primary" : "secondary"} aria-pressed={priority === p} onClick={() => setPriority(p)}>
                {PRIORITY_META[p].label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-kumo-subtle">Use Urgent for safety issues or problems stopping you from operating.</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-kumo-default">Photos (optional, up to {MAX_PHOTOS})</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <div key={p} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="Attached photo" className="size-20 rounded-lg border border-kumo-line object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((all) => all.filter((x) => x !== p))}
                  className="w-20 cursor-pointer text-center text-sm font-medium text-kumo-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label
                className={cn(
                  "flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-kumo-line text-sm text-kumo-subtle focus-within:ring-2 focus-within:ring-kumo-brand hover:border-kumo-brand",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                {uploading ? <Loader size="sm" /> : <Camera size={20} aria-hidden />}
                {uploading ? "Adding" : "Add"}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
              </label>
            )}
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}

function ComplaintRow({ c, active, onClick }: { c: ComplaintSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "block w-full cursor-pointer border-l-4 px-4 py-3 text-left hover:bg-kumo-tint",
        active ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={cn("min-w-0 truncate text-sm text-kumo-default", c.unread ? "font-semibold" : "font-medium")}>{c.subject}</span>
        {c.unread && <span className="shrink-0 text-sm font-semibold text-kumo-brand">New reply</span>}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
        <StatusBadge status={c.status} />
        {c.priority === "URGENT" && <PriorityBadge priority={c.priority} />}
      </span>
      <span className="block truncate text-sm text-kumo-subtle">
        {c.category}, {formatWhen(c.lastActivityAt)}
        {c.commentCount > 0 && `, ${c.commentCount} comment${c.commentCount === 1 ? "" : "s"}`}
      </span>
    </button>
  );
}

function TenantComplaints() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("id");

  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const loadList = useCallback(async () => {
    if (!user?.id) return;
    const res = await getMyComplaintsAction(user.id);
    if (res.success) setComplaints(res.complaints);
    else toast.error(res.error);
    setLoading(false);
  }, [user?.id]);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !selectedId) return setDetail(null);
    const res = await getComplaintAction(user.id, selectedId);
    if (res.success) {
      setDetail(res.complaint);
      // Opening it marks it read.
      setComplaints((all) => all.map((c) => (c.id === selectedId ? { ...c, unread: false } : c)));
      announceComplaintsChanged();
    } else {
      toast.error(res.error);
      setDetail(null);
    }
  }, [user?.id, selectedId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setDetailLoading(true);
    loadDetail().finally(() => setDetailLoading(false));
  }, [loadDetail]);

  // Keep the tab in sync with the complaint that is open.
  useEffect(() => {
    if (!detail) return;
    setTab(detail.status === "NEW" || detail.status === "IN_PROGRESS" ? "open" : "done");
  }, [detail?.id, detail?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = (c: ComplaintSummary) => c.status === "NEW" || c.status === "IN_PROGRESS";
  const openList = complaints.filter(isOpen);
  const doneList = complaints.filter((c) => !isOpen(c));
  const shown = tab === "open" ? openList : doneList;

  const refreshAll = async () => {
    await Promise.all([loadList(), loadDetail()]);
  };

  if (!user?.id) return null;

  return (
    <AdminPage
      title="Complaints"
      description="Report a problem to the mall admin and follow it here, without going to the office."
      actions={
        <>
          <Button variant="secondary" shape="square" icon={<ArrowClockwise />} aria-label="Refresh" onClick={refreshAll} />
          <Button variant="primary" icon={<Plus />} onClick={() => setShowNew(true)}>
            New complaint
          </Button>
        </>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* List */}
        <div className={cn("min-w-0 space-y-3 lg:col-span-5", selectedId && "hidden lg:block")}>
          <PageTabs
            tabs={[
              { value: "open", label: `Open (${openList.length})` },
              { value: "done", label: `Resolved (${doneList.length})` },
            ]}
            value={tab}
            onValueChange={(v) => setTab(v as "open" | "done")}
          />
          <Panel flush>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader />
              </div>
            ) : shown.length === 0 ? (
              <EmptyNote title={tab === "open" ? "No open complaints" : "No resolved complaints yet"}>
                {tab === "open" ? "Something wrong with your unit? Choose New complaint." : undefined}
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-kumo-line">
                {shown.map((c) => (
                  <li key={c.id}>
                    <ComplaintRow c={c} active={c.id === selectedId} onClick={() => select(c.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Detail */}
        <div className={cn("min-w-0 lg:col-span-7", !selectedId && "hidden lg:block")}>
          {detailLoading && !detail ? (
            <Panel>
              <div className="flex justify-center py-20">
                <Loader />
              </div>
            </Panel>
          ) : detail ? (
            <ComplaintView complaint={detail} role="TENANT" userId={user.id} onBack={() => select(null)} onChanged={refreshAll} />
          ) : (
            <Panel>
              <EmptyNote title="Select a complaint">Its details and the conversation show here.</EmptyNote>
            </Panel>
          )}
        </div>
      </div>

      {showNew && (
        <NewComplaintModal
          userId={user.id}
          onClose={() => setShowNew(false)}
          onCreated={async (id) => {
            setShowNew(false);
            setTab("open");
            await loadList();
            select(id);
          }}
        />
      )}
    </AdminPage>
  );
}

export default function TenantComplaintsPage() {
  return (
    <Suspense fallback={null}>
      <TenantComplaints />
    </Suspense>
  );
}
