"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, InputArea, Select, cn } from "@cloudflare/kumo";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { AdminDialog, EmptyNote, Panel } from "@/components/admin/page-kit";
import { FileButton, Thumb } from "@/components/admin/media";
import { DraftNote } from "@/components/drafts/draft-note";
import { deleteInquiryAction, updateEventInfoAction, updateInquiryImageAction } from "@/app/actions/inquiry";
import { useDraft } from "@/lib/drafts/use-draft";

/** An approved event, as `getAdminEventsAction` returns it. */
export interface AdminEvent {
  id: string;
  eventName?: string | null;
  eventType: string;
  eventDate: string | Date;
  eventTime?: string | null;
  message?: string | null;
  fbAccount?: string | null;
  contactNumber?: string | null;
  imageUrl?: string | null;
  /** Its day is over, so it is no longer on the public page. */
  isPast: boolean;
  /** On the public page: upcoming and has an image. */
  isPublic: boolean;
}

const EVENT_TYPES = [
  "Esports & Gaming Events",
  "Mini Sports Competitions",
  "Fitness & Active Events",
  "Trade Shows & Exhibitions",
  "Community Gatherings",
];

const EMPTY = {
  eventName: "",
  eventType: "",
  eventDate: "",
  eventTime: "",
  message: "",
  fbAccount: "",
  contactNumber: "",
};

const formFor = (ev: AdminEvent) => ({
  eventName: ev.eventName || "",
  eventType: ev.eventType || "Community Gatherings",
  eventDate: ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 10) : "",
  eventTime: ev.eventTime || "",
  message: ev.message || "",
  fbAccount: ev.fbAccount || "",
  contactNumber: ev.contactNumber || "",
});

const day = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const titleOf = (ev: AdminEvent) => ev.eventName || ev.eventType;

/** Bookings → Upcoming Events: approved events, their pictures and details. */
export function UpcomingEvents({
  events,
  onChanged,
}: {
  events: AdminEvent[];
  /** Reload the events after a change. */
  onChanged: () => void | Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  /** The event as the editor opened it. */
  const [start, setStart] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const draft = useDraft({
    form: "admin.event-info",
    scope: [editingId],
    enabled: Boolean(editingId),
    editing: true,
    value: form,
    initial: start,
    onRestore: setForm,
  });
  const set = (patch: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...patch }));

  const edit = (ev: AdminEvent) => {
    const opened = formFor(ev);
    setStart(opened);
    setForm(opened);
    setEditingId(ev.id);
  };

  const save = async () => {
    if (!editingId || saving) return;
    if (!form.eventDate || !form.eventTime) {
      toast.error("Please set both the event date and time");
      return;
    }
    setSaving(true);
    try {
      const res = await draft.send(() => updateEventInfoAction(editingId, form));
      if (!res) return;
      if (!res.success) {
        toast.error(res.error || "Failed to update event");
        return;
      }
      draft.clear();
      setEditingId(null);
      toast.success("Event updated successfully");
      await onChanged();
    } catch {
      toast.error("Error updating event");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingId(id);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const result = await getCloudStorageProvider().uploadFile(file, "inquiries");
      const res = await updateInquiryImageAction(id, result.url, result.key);
      if (!res.success) {
        toast.error("Failed to save the event image");
        return;
      }
      toast.success("Event image updated successfully");
      await onChanged();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload the event image");
    } finally {
      setUploadingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await deleteInquiryAction(deleteTarget.id);
      if (!res.success) {
        toast.error("Failed to delete event");
        return;
      }
      setDeleteTarget(null);
      toast.success("Event deleted successfully");
      await onChanged();
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  const upcoming = events.filter((ev) => !ev.isPast);
  const past = events.filter((ev) => ev.isPast);

  const card = (ev: AdminEvent) => (
    <li
      key={ev.id}
      className={cn("flex flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-base", ev.isPast && "opacity-70")}
    >
      <Thumb url={ev.imageUrl} alt={titleOf(ev)} empty="No image yet" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-base font-semibold text-kumo-default">{titleOf(ev)}</h3>
        <p className="text-sm text-kumo-subtle">
          {ev.eventType}, {day(ev.eventDate)}
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
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
          {!ev.isPast && (
            <FileButton accept="image/*" disabled={uploadingId !== null} onChange={(e) => uploadImage(ev.id, e)}>
              {uploadingId === ev.id ? "Uploading..." : ev.imageUrl ? "Change image" : "Upload image"}
            </FileButton>
          )}
          <Button size="sm" variant="secondary" icon={<PencilSimple />} onClick={() => edit(ev)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => setDeleteTarget(ev)}>
            Delete
          </Button>
        </div>
      </div>
    </li>
  );

  const types = [...new Set([...EVENT_TYPES, ...(form.eventType ? [form.eventType] : [])])];

  return (
    <div className="space-y-6">
      <p className="text-sm text-kumo-subtle">
        Approved events show on the public page until their event day ends. Upload an image to publish one.
      </p>

      {upcoming.length === 0 ? (
        <Panel flush>
          <EmptyNote title="No upcoming approved events">Approve a request under Event Bookings and it appears here.</EmptyNote>
        </Panel>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.map(card)}</ul>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-kumo-default">
            Past events ({past.length}){" "}
            <span className="text-sm font-normal text-kumo-subtle">(no longer shown on the public page)</span>
          </h3>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{past.map(card)}</ul>
        </section>
      )}

      <AdminDialog
        open={Boolean(editingId)}
        onClose={() => !saving && setEditingId(null)}
        size="lg"
        title="Edit event"
        description="Update the event details shown on the public page."
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={save}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Event Name"
            value={form.eventName}
            onChange={(e) => set({ eventName: e.target.value })}
            placeholder="e.g. Summer Esports Championship"
            className="w-full"
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Select
              label="Event Type"
              value={form.eventType}
              items={Object.fromEntries(types.map((t) => [t, t]))}
              onValueChange={(v) => v != null && set({ eventType: v as string })}
              className="w-full"
            >
              {types.map((t) => (
                <Select.Option key={t} value={t}>
                  {t}
                </Select.Option>
              ))}
            </Select>
            <Input label="Event Date" type="date" value={form.eventDate} onChange={(e) => set({ eventDate: e.target.value })} className="w-full" />
            <Input label="Event Time" type="time" value={form.eventTime} onChange={(e) => set({ eventTime: e.target.value })} className="w-full" />
            <Input
              label="FB Account URL/Name"
              value={form.fbAccount}
              onChange={(e) => set({ fbAccount: e.target.value })}
              placeholder="e.g. fb.com/events"
              className="w-full"
            />
          </div>
          <Input
            label="Contact Number"
            value={form.contactNumber}
            onChange={(e) => set({ contactNumber: e.target.value })}
            placeholder="e.g. 09123456789"
            className="w-full"
          />
          <InputArea
            label="Event Message / Notes"
            value={form.message}
            onValueChange={(message) => set({ message })}
            rows={3}
            placeholder="Optional details shown with the event"
            className="w-full"
          />
          <DraftNote draft={draft} />
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        size="sm"
        title="Delete this event?"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={saving} onClick={remove}>
              Delete event
            </Button>
          </>
        }
      >
        <p className="text-sm text-kumo-default">
          <strong>{deleteTarget && titleOf(deleteTarget)}</strong> will be removed from the public page along with its uploaded
          image. This can&apos;t be undone.
        </p>
      </AdminDialog>
    </div>
  );
}
