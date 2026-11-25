"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Checkbox, InputArea, Select, cn } from "@cloudflare/kumo";
import { ArrowLeft, Camera } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  addComplaintCommentAction,
  updateComplaintPriorityAction,
  updateComplaintStatusAction,
} from "@/app/actions/complaint";
import { announceComplaintsChanged } from "@/lib/complaint-unread";
import {
  COMMENT_MAX,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  PRIORITY_META,
  STATUS_META,
  type ComplaintDetail,
  type ComplaintPriority,
  type ComplaintStatus,
} from "@/lib/complaints";

export const LABEL = "text-xs font-medium text-kumo-subtle";
export const CARD = "rounded-xl border border-kumo-line bg-kumo-base";

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_TONE: Record<ComplaintStatus, string> = {
  NEW: "text-kumo-brand",
  IN_PROGRESS: "text-kumo-warning",
  RESOLVED: "text-kumo-success",
  CLOSED: "text-kumo-subtle",
};
const PRIORITY_TONE: Record<ComplaintPriority, string> = {
  LOW: "text-kumo-subtle",
  NORMAL: "text-kumo-subtle",
  URGENT: "text-kumo-danger",
};

/** Status and priority as plain coloured text. */
export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.NEW;
  return <span className={cn("text-sm font-semibold", STATUS_TONE[status] ?? STATUS_TONE.NEW)}>{m.label}</span>;
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.NORMAL;
  return <span className={cn("text-sm font-medium", PRIORITY_TONE[priority])}>{m.label} priority</span>;
}

/** Upload one image through the app's upload route. */
export async function uploadComplaintPhoto(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("Please choose an image file.");
    return null;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error("Please use an image under 5 MB.");
    return null;
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "complaints");
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
    return data.url as string;
  } catch (e: any) {
    toast.error("Photo upload failed: " + (e?.message || "unknown error"));
    return null;
  }
}

function Photo({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 hover:opacity-80 transition-opacity">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Attached photo" className="w-full h-full object-cover" />
    </a>
  );
}

/**
 * One complaint: details, photos, comment thread and reply box.
 * Admins also get status / priority controls and internal notes.
 */
export function ComplaintView({
  complaint,
  role,
  userId,
  onBack,
  onChanged,
}: {
  complaint: ComplaintDetail;
  role: "ADMIN" | "TENANT";
  userId: string;
  onBack?: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [internal, setInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === "ADMIN";
  const open = complaint.status === "NEW" || complaint.status === "IN_PROGRESS";
  const canComment = isAdmin || open;

  useEffect(() => {
    setMessage("");
    setPhotoUrl(null);
    setInternal(false);
  }, [complaint.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [complaint.comments.length]);

  const refresh = async () => {
    await onChanged();
    announceComplaintsChanged();
  };

  const send = async () => {
    if (!message.trim() && !photoUrl) return;
    setSending(true);
    const res = await addComplaintCommentAction(userId, complaint.id, { message, photoUrl, isInternal: internal });
    setSending(false);
    if (!res.success) return void toast.error(res.error);
    setMessage("");
    setPhotoUrl(null);
    await refresh();
  };

  const setStatus = async (status: ComplaintStatus) => {
    setBusyStatus(true);
    const res = await updateComplaintStatusAction(userId, complaint.id, status);
    setBusyStatus(false);
    if (!res.success) return void toast.error(res.error);
    toast.success(`Marked ${STATUS_META[status].label}`);
    await refresh();
  };

  const reopen = async () => {
    setBusyStatus(true);
    const res = await updateComplaintStatusAction(userId, complaint.id, "IN_PROGRESS");
    setBusyStatus(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Complaint reopened");
    await refresh();
  };

  const setPriority = async (priority: ComplaintPriority) => {
    const res = await updateComplaintPriorityAction(userId, complaint.id, priority);
    if (!res.success) return void toast.error(res.error);
    await refresh();
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadComplaintPhoto(file);
    setUploading(false);
    if (url) setPhotoUrl(url);
  };

  return (
    <div className={cn(CARD, "space-y-5 p-4 sm:p-6")}>
      {/* Header */}
      <div className="space-y-2">
        {onBack && (
          <div className="lg:hidden">
            <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
              All complaints
            </Button>
          </div>
        )}
        <h2 className="wrap-break-word text-lg font-semibold leading-tight text-kumo-default">{complaint.subject}</h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
          <span className="text-kumo-subtle">{complaint.category}</span>
        </p>
        <p className="text-sm text-kumo-subtle">
          {isAdmin && (
            <>
              <span className="font-medium text-kumo-default">
                {complaint.shopName}, Unit {complaint.unitId}
                {complaint.ownerName ? `, ${complaint.ownerName}` : ""}
              </span>
              <br />
            </>
          )}
          Filed {formatWhen(complaint.createdAt)}
          {complaint.resolvedAt && complaint.status === "RESOLVED" && `. Resolved ${formatWhen(complaint.resolvedAt)}`}
        </p>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="flex flex-wrap items-end gap-4 rounded-lg bg-kumo-recessed p-3">
          <div className="min-w-0">
            <p className="mb-1.5 text-sm font-medium text-kumo-default">Status</p>
            <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
              {COMPLAINT_STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={complaint.status === s ? "primary" : "secondary"}
                  aria-pressed={complaint.status === s}
                  disabled={busyStatus}
                  onClick={() => complaint.status !== s && setStatus(s)}
                >
                  {STATUS_META[s].label}
                </Button>
              ))}
            </div>
          </div>
          <Select
            label="Priority"
            value={complaint.priority}
            items={Object.fromEntries(COMPLAINT_PRIORITIES.map((p) => [p, PRIORITY_META[p].label]))}
            onValueChange={(v) => v && v !== complaint.priority && setPriority(v as ComplaintPriority)}
            className="w-40"
          >
            {COMPLAINT_PRIORITIES.map((p) => (
              <Select.Option key={p} value={p}>
                {PRIORITY_META[p].label}
              </Select.Option>
            ))}
          </Select>
        </div>
      )}

      {/* Details */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-kumo-default">Details</h3>
        <p className="wrap-break-word whitespace-pre-line text-sm leading-relaxed text-kumo-default">{complaint.details}</p>
        {complaint.photos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {complaint.photos.map((p) => <Photo key={p} url={p} />)}
          </div>
        )}
      </section>

      {/* Thread */}
      <section className="space-y-3 border-t border-kumo-line pt-4">
        <h3 className="text-sm font-semibold text-kumo-default">Conversation</h3>
        {complaint.comments.length === 0 && (
          <p className="py-4 text-center text-sm text-kumo-subtle">
            {isAdmin ? "No replies yet. Reply below to let the tenant know it's being handled." : "No replies yet. The admin will reply here."}
          </p>
        )}
        <div className="space-y-3">
          {complaint.comments.map((c) =>
            c.authorRole === "SYSTEM" ? (
              <p key={c.id} className="py-1 text-center text-xs text-kumo-subtle">
                {c.message}, {formatWhen(c.createdAt)}
              </p>
            ) : (
              <div key={c.id} className={cn("flex", c.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] space-y-1.5 rounded-lg px-3 py-2.5 sm:max-w-[75%]",
                    c.isInternal
                      ? "border border-dashed border-kumo-warning bg-kumo-base text-kumo-default"
                      : c.mine
                        ? "bg-kumo-brand text-white"
                        : "bg-kumo-recessed text-kumo-default",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      c.isInternal ? "text-kumo-warning" : c.mine ? "text-white/80" : "text-kumo-subtle",
                    )}
                  >
                    {c.isInternal ? "Internal note, admins only" : c.authorName}
                  </p>
                  {c.message && <p className="wrap-break-word whitespace-pre-line text-sm">{c.message}</p>}
                  {c.photoUrl && <Photo url={c.photoUrl} />}
                  <p className={cn("text-xs", c.mine && !c.isInternal ? "text-white/70" : "text-kumo-subtle")}>
                    {formatWhen(c.createdAt)}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
        <div ref={endRef} />
      </section>

      {/* Composer */}
      {canComment ? (
        <div className="space-y-3">
          {photoUrl && (
            <div className="flex items-end gap-2">
              <Photo url={photoUrl} />
              <Button size="sm" variant="secondary-destructive" onClick={() => setPhotoUrl(null)}>
                Remove photo
              </Button>
            </div>
          )}
          <InputArea
            aria-label={internal ? "Internal note" : "Reply"}
            value={message}
            maxLength={COMMENT_MAX}
            onValueChange={setMessage}
            rows={3}
            placeholder={internal ? "Internal note, only admins can see this" : isAdmin ? "Reply to the tenant" : "Add a comment for the admin"}
            className={cn("w-full", internal && "ring-2 ring-kumo-warning")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={<Camera />} loading={uploading} onClick={() => fileRef.current?.click()}>
              Photo
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Attach a photo" onChange={onPickPhoto} />
            {isAdmin && <Checkbox label="Internal note" checked={internal} onCheckedChange={(v) => setInternal(Boolean(v))} />}
            <span className="ml-auto text-xs text-kumo-subtle">
              {message.length}/{COMMENT_MAX}
            </span>
            <Button variant="primary" loading={sending} disabled={uploading || (!message.trim() && !photoUrl)} onClick={send}>
              {internal ? "Save note" : "Send"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-subtle">
          <span className="min-w-48 flex-1">
            {complaint.status === "RESOLVED"
              ? "This complaint is resolved. If the problem came back, reopen it."
              : "The admin closed this complaint. File a new one if you still need help."}
          </span>
          {complaint.status === "RESOLVED" && (
            <Button size="sm" variant="secondary" loading={busyStatus} onClick={reopen}>
              Reopen
            </Button>
          )}
        </div>
      )}

      {/* Tenant: mark resolved */}
      {!isAdmin && open && (
        <div className="flex justify-end">
          <Button variant="secondary" loading={busyStatus} onClick={() => setStatus("RESOLVED")}>
            Mark as resolved
          </Button>
        </div>
      )}
    </div>
  );
}
