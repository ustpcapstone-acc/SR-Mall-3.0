"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, InputArea, Switch } from "@cloudflare/kumo";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { Panel } from "@/components/admin/page-kit";
import { FileButton, Thumb } from "@/components/admin/media";
import {
  ABOUT_LIMITS,
  ABOUT_SECTIONS,
  SYSTEM_STARTER,
  contactDetails,
  sectionFilled,
  textLines,
  type AboutConfig,
  type AboutItem,
  type AboutPageContent,
  type AboutSectionId,
} from "@/lib/about";

type Change = (change: (current: AboutPageContent) => AboutPageContent) => void;
type SharedField = "aboutTitle" | "aboutDescription" | "aboutImageUrl";

/** One picture: upload, replace or remove. It is published when the page is saved. */
function PictureField({ label, url, onChange }: { label: string; url: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const result = await getCloudStorageProvider().uploadFile(file, "web-cms");
      onChange(result.url);
      toast.success("Picture uploaded. Save changes to publish it.");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Couldn't upload the picture. Use a JPG, PNG or WEBP and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-kumo-default">{label}</p>
      <div className="max-w-xs overflow-hidden rounded-lg border border-kumo-line">
        <Thumb url={url} alt={label} empty="No picture" />
      </div>
      <div className="flex flex-wrap gap-2">
        <FileButton accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload}>
          {busy ? "Uploading..." : url ? "Replace picture" : "Upload picture"}
        </FileButton>
        {url && (
          <Button size="sm" variant="secondary-destructive" disabled={busy} onClick={() => onChange("")}>
            Remove picture
          </Button>
        )}
      </div>
    </div>
  );
}

/** The list of services or of system features. */
function ItemList({
  noun,
  items,
  onChange,
}: {
  noun: "service" | "feature";
  items: AboutItem[];
  onChange: (change: (items: AboutItem[]) => AboutItem[]) => void;
}) {
  const set = (id: string, patch: Partial<AboutItem>) =>
    onChange((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const move = (index: number, by: -1 | 1) =>
    onChange((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const add = () =>
    onChange((list) => [
      ...list,
      { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title: "", description: "", imageUrl: "" },
    ]);

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-kumo-subtle">No {noun}s added yet.</p>}
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.id} className="space-y-3 rounded-lg border border-kumo-line p-4">
            <Input
              label={`${noun === "service" ? "Service" : "Feature"} name`}
              value={item.title}
              maxLength={ABOUT_LIMITS.title}
              onChange={(e) => set(item.id, { title: e.target.value })}
              error={!item.title.trim() && (item.description.trim() || item.imageUrl) ? "Enter a name." : undefined}
              className="w-full"
            />
            <InputArea
              label="Short description"
              value={item.description}
              maxLength={ABOUT_LIMITS.short}
              rows={2}
              onValueChange={(description) => set(item.id, { description })}
              className="w-full"
            />
            <PictureField label="Picture (optional)" url={item.imageUrl} onChange={(imageUrl) => set(item.id, { imageUrl })} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" shape="square" icon={<ArrowUp />} aria-label={`Move ${noun} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="sm" variant="secondary" shape="square" icon={<ArrowDown />} aria-label={`Move ${noun} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} />
              <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={() => onChange((list) => list.filter((x) => x.id !== item.id))}>
                Remove {noun}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="secondary" icon={<Plus />} disabled={items.length >= ABOUT_LIMITS.items} onClick={add}>
        Add {noun}
      </Button>
    </div>
  );
}

/** Values that are edited in General Settings, shown here so nothing is typed twice. */
function FromGeneral({ rows, onEdit }: { rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-kumo-subtle">{label}</dt>
            <dd className="whitespace-pre-line text-sm font-medium text-kumo-default wrap-anywhere">{value || "Not entered"}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" size="sm" onClick={onEdit}>
        Edit in General Settings
      </Button>
    </div>
  );
}

/** Website Content → About Us page. Saved with the page's Save changes button. */
export function AboutEditor({
  config,
  about,
  onConfig,
  onAbout,
  onGeneral,
}: {
  config: AboutConfig;
  /** Undefined when it couldn't be loaded: then nothing here may be edited. */
  about?: AboutPageContent | null;
  onConfig: (field: SharedField, value: string) => void;
  onAbout: Change;
  onGeneral: () => void;
}) {
  if (!about) {
    return (
      <Panel>
        <p role="alert" className="text-sm text-kumo-danger">
          Couldn&apos;t load the About Us content. Reload the page to try again.
        </p>
      </Panel>
    );
  }

  const contact = contactDetails(config);
  const set = (patch: Partial<AboutPageContent>) => onAbout((current) => ({ ...current, ...patch }));
  const list = (key: "services" | "features") => (change: (items: AboutItem[]) => AboutItem[]) =>
    onAbout((current) => ({ ...current, [key]: change(current[key]) }));
  const missingFeatures = SYSTEM_STARTER.features.filter(
    (starter) => !about.features.some((f) => f.title.trim().toLowerCase() === starter.title.toLowerCase()),
  );

  const fields: Record<AboutSectionId, React.ReactNode> = {
    about: (
      <>
        <p className="text-sm text-kumo-subtle">This heading, text and picture also appear in the About section of the home page.</p>
        <Input
          label="Heading"
          value={config.aboutTitle ?? ""}
          onChange={(e) => onConfig("aboutTitle", e.target.value)}
          placeholder="About SR Mall"
          className="w-full"
        />
        <InputArea
          label="Introduction and background of the mall"
          value={config.aboutDescription ?? ""}
          onValueChange={(value) => onConfig("aboutDescription", value)}
          rows={7}
          className="w-full"
        />
        <PictureField label="Picture" url={config.aboutImageUrl ?? ""} onChange={(url) => onConfig("aboutImageUrl", url)} />
      </>
    ),
    system: (
      <>
        {!about.systemPurpose.trim() && !about.systemObjectives.trim() && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set({ systemPurpose: SYSTEM_STARTER.purpose, systemObjectives: SYSTEM_STARTER.objectives })}
          >
            Add suggested text to edit
          </Button>
        )}
        <InputArea
          label="Purpose"
          value={about.systemPurpose}
          maxLength={ABOUT_LIMITS.long}
          onValueChange={(systemPurpose) => set({ systemPurpose })}
          rows={4}
          className="w-full"
        />
        <InputArea
          label="Objectives"
          description="One objective per line."
          value={about.systemObjectives}
          maxLength={ABOUT_LIMITS.long}
          onValueChange={(systemObjectives) => set({ systemObjectives })}
          rows={5}
          className="w-full"
        />
        <PictureField label="Picture" url={about.systemImageUrl} onChange={(systemImageUrl) => set({ systemImageUrl })} />
      </>
    ),
    mission: (
      <>
        <p className="text-sm text-kumo-subtle">Enter the mall&apos;s official statements. Leave them empty if there are none.</p>
        <InputArea label="Mission" value={about.mission} maxLength={ABOUT_LIMITS.long} onValueChange={(mission) => set({ mission })} rows={4} className="w-full" />
        <InputArea label="Vision" value={about.vision} maxLength={ABOUT_LIMITS.long} onValueChange={(vision) => set({ vision })} rows={4} className="w-full" />
        <PictureField label="Picture" url={about.missionImageUrl} onChange={(missionImageUrl) => set({ missionImageUrl })} />
      </>
    ),
    services: <ItemList noun="service" items={about.services} onChange={list("services")} />,
    features: (
      <>
        {missingFeatures.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              list("features")((items) => [...items, ...missingFeatures.map((f) => ({ ...f }))].slice(0, ABOUT_LIMITS.items))
            }
          >
            Add the system&apos;s current features
          </Button>
        )}
        <ItemList noun="feature" items={about.features} onChange={list("features")} />
      </>
    ),
    contact: (
      <FromGeneral
        onEdit={onGeneral}
        rows={[
          ["Address", contact.address],
          ["Phone", contact.phone],
          ["Email", contact.email],
          ["Social links", contact.socials.map((s) => `${s.label}: ${s.href}`).join("\n")],
        ]}
      />
    ),
    hours: <FromGeneral onEdit={onGeneral} rows={[["Opening hours", textLines(config.footerOpeningHours).join("\n")]]} />,
    location: (
      <>
        <FromGeneral
          onEdit={onGeneral}
          rows={[
            ["Address", contact.address],
            ["Custom map link", config.googleMapsEmbedUrl ?? ""],
          ]}
        />
        <PictureField label="Picture of the mall" url={about.locationImageUrl} onChange={(locationImageUrl) => set({ locationImageUrl })} />
      </>
    ),
  };

  return (
    <div className="space-y-6">
      {ABOUT_SECTIONS.map((section) => {
        const hidden = about.hidden.includes(section.id);
        const status = hidden
          ? "Hidden from visitors."
          : sectionFilled(section.id, config, about)
            ? "Shown on the page."
            : "Left off the page until something is filled in.";
        return (
          <Panel
            key={section.id}
            title={section.label}
            description={status}
            actions={
              <Switch
                label="Show on page"
                aria-label={`Show ${section.label} on the About Us page`}
                checked={!hidden}
                onCheckedChange={(show) =>
                  onAbout((current) => ({
                    ...current,
                    hidden: show ? current.hidden.filter((id) => id !== section.id) : [...current.hidden, section.id],
                  }))
                }
              />
            }
          >
            <div className="space-y-4">{fields[section.id]}</div>
          </Panel>
        );
      })}
    </div>
  );
}
