"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAreaSlots,
  upsertAreaSlot,
  deleteAreaSlot,
  getUnitHoldsAction,
  getReservedSlotsWithDetailsAction,
} from "@/app/actions/space-slot";
import { Car, Coffee, ShoppingBag, Smartphone, Store } from "lucide-react";
import { Button, Input, Loader, Select, Table, cn } from "@cloudflare/kumo";
import {
  ArrowsIn,
  ArrowsOut,
  Eye,
  ListDashes,
  MapTrifold,
  Minus,
  PencilSimple,
  Plus,
  SquaresFour,
  Stack,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, SearchField, Stat } from "@/components/admin/page-kit";
import SpaceDetailModal from "@/components/space-detail-modal";
import { toast } from "sonner";
import { ReservationDecisionModal, type ReservationRow } from "@/components/admin/reservation-decision-modal";
import { ChatConfirmModal } from "@/components/chat/chat-ui";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { FloorManager } from "@/components/admin/floor-manager";
import { FloorMap, type MapTile } from "@/components/admin/floor-map";
import { getFloorLayoutsAction } from "@/app/actions/floors";
import { AUTO_LAYOUT, type FloorLayout } from "@/lib/floor-layout";
import { useFloors } from "@/lib/use-floors";
import { MAX_UNIT_RENT, NO_HOLD, twinMessage, unitKey, unitLock, type UnitHold } from "@/lib/unit-rules";
import Link from "next/link";
import { getMyStaffAccessAction } from "@/app/actions/staff";
import { canOpen } from "@/lib/permissions";

// Define the slot type based on Prisma schema
interface AreaSlot {
  id: string;
  unit_id: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  sqm_size: number;
  base_rent: number;
  space_images: string[];
  features?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface FloorPlanSlot extends AreaSlot {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  floor?: string;
  category?: string;
}

const FLOOR_CATEGORIES = [
  { id: "retail", name: "Retail", icon: ShoppingBag },
  { id: "food", name: "Food & Beverage", icon: Coffee },
  { id: "tech", name: "Technology", icon: Smartphone },
  { id: "services", name: "Services", icon: Store },
  { id: "parking", name: "Parking", icon: Car },
];

const CATEGORY_ITEMS: Record<string, string> = {
  all: "All categories",
  ...Object.fromEntries(FLOOR_CATEGORIES.map((c) => [c.id, c.name])),
};

const STATUS: Record<string, { label: string; color: string; className: string }> = {
  AVAILABLE: { label: "Available", color: "#10b981", className: "text-kumo-success" },
  OCCUPIED: { label: "Occupied", color: "#BE1E2D", className: "text-kumo-brand" },
  RESERVED: { label: "Reserved", color: "#f59e0b", className: "text-kumo-warning" },
  MAINTENANCE: { label: "Maintenance", color: "#94a3b8", className: "text-kumo-subtle" },
};

export default function SpaceManagerPage() {
  const [slots, setSlots] = useState<FloorPlanSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [managingFloors, setManagingFloors] = useState(false);
  const { floors: mallFloors, label: floorLabel } = useFloors();
  const [activeSlot, setActiveSlot] = useState<Partial<FloorPlanSlot> | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"grid" | "list" | "floorplan">(
    "floorplan",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("ground");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showGrid, setShowGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** The unit selected on the map. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /** Saved arrangement and floor plan picture, by floor id. */
  const [layouts, setLayouts] = useState<Record<string, FloorLayout>>({});

  const [previewSlot, setPreviewSlot] = useState<FloorPlanSlot | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFeatureInput, setNewFeatureInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  /** Approve / release a reservation through the same modal as Bookings. */
  const [decision, setDecision] = useState<{ row: ReservationRow; action: "approve" | "reject" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FloorPlanSlot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /** The unit as the editor opened it, to tell unsaved edits apart. */
  const [startSlot, setStartSlot] = useState<Partial<FloorPlanSlot> | null>(null);
  /** Units with a lease or tenant, keyed by unit id. The server checks again on save. */
  const [holds, setHolds] = useState<Record<string, UnitHold>>({});
  const saved = startSlot?.id ? startSlot : null;
  const hold = (saved?.unit_id && holds[saved.unit_id]) || NO_HOLD;
  const lock = unitLock(saved ? { status: saved.status!, tenant_id: (saved as { tenant_id?: string | null }).tenant_id } : null, hold);
  /** Who reserved each reserved unit, and how long is left to decide. */
  const [reservations, setReservations] = useState<Record<string, { name: string; left: string }>>({});
  const [canSeeTenants, setCanSeeTenants] = useState(false);
  useEffect(() => {
    let alive = true;
    getMyStaffAccessAction().then(
      (access) => alive && setCanSeeTenants(Boolean(access && canOpen(access, "/admindashboard/tenant-monitoring"))),
    );
    return () => {
      alive = false;
    };
  }, []);
  // Only what the editor changes; map positions are worked out on every load.
  const typed = (slot: Partial<FloorPlanSlot>, feature: string) => ({
    unit_id: slot.unit_id,
    floor: slot.floor,
    category: slot.category,
    sqm_size: slot.sqm_size,
    base_rent: slot.base_rent,
    status: slot.status,
    space_images: slot.space_images,
    features: slot.features,
    feature,
  });
  const draft = useDraft({
    form: "admin.space",
    scope: [startSlot?.id ?? "new"],
    enabled: isEditing && Boolean(activeSlot && startSlot),
    editing: Boolean(startSlot?.id),
    value: activeSlot ? typed(activeSlot, newFeatureInput) : null,
    initial: startSlot ? typed(startSlot, "") : null,
    onRestore: (saved) => {
      if (!saved) return;
      const { feature, ...fields } = saved;
      setActiveSlot((slot) => ({ ...slot, ...fields }));
      setNewFeatureInput(feature);
    },
  });

  const openDecision = async (slot: FloorPlanSlot, action: "approve" | "reject") => {
    // Show the modal right away, then fill in who reserved it and the time left.
    setDecision({ row: { unit_id: slot.unit_id, sqm_size: slot.sqm_size, base_rent: slot.base_rent, floor: slot.floor }, action });
    const res = await getReservedSlotsWithDetailsAction();
    const detail: any = res.success ? res.data?.find((d: any) => d.unit_id === slot.unit_id) : null;
    if (detail) {
      setDecision((cur) => (cur && cur.row.unit_id === slot.unit_id ? { ...cur, row: { ...cur.row, ...detail } } : cur));
    }
  };

  const handleAddFeature = () => {
    if (!newFeatureInput.trim() || !activeSlot) return;
    const currentFeatures = activeSlot.features || [];
    setActiveSlot({
      ...activeSlot,
      features: [...currentFeatures, newFeatureInput.trim()],
    });
    setNewFeatureInput("");
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    if (!activeSlot) return;
    const currentFeatures = [...(activeSlot.features || [])];
    currentFeatures.splice(indexToRemove, 1);
    setActiveSlot({
      ...activeSlot,
      features: currentFeatures,
    });
  };

  useEffect(() => {
    loadSlots();
  }, []);

  /** `quiet` keeps the page on screen while it reloads. */
  const loadSlots = async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [result, held, reserved, arranged] = await Promise.all([
      getAreaSlots(),
      getUnitHoldsAction(),
      getReservedSlotsWithDetailsAction(),
      getFloorLayoutsAction(),
    ]);
    if (arranged.success) setLayouts(arranged.data);
    else toast.error(arranged.error);
    if (held.success) setHolds(held.data);
    else toast.error(held.error);
    if (reserved.success) {
      setReservations(
        Object.fromEntries(
          (reserved.data ?? []).map((r: any) => [
            r.unit_id,
            { name: r.reservingUser?.name || r.reservingUser?.email || "a customer", left: r.remainingFormatted },
          ]),
        ),
      );
    }
    if (result.success && result.data) {
      // Sort slots naturally by unit_id (FS1, FS2, FS3... FS10)
      const sortedData = [...result.data].sort((a, b) =>
        a.unit_id.localeCompare(b.unit_id, undefined, { numeric: true, sensitivity: 'base' })
      );

      setSlots(
        sortedData.map((slot: any) => ({
          ...slot,
          floor: slot.floor || "ground",
          category: slot.category || "retail",
          features: Array.isArray(slot.features) ? slot.features : [],
        })),
      );
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const unitId = activeSlot?.unit_id?.trim();
    if (!activeSlot || !unitId) {
      toast.error("Unit ID is required");
      return;
    }
    if (twin) {
      toast.error(twinMessage(twin.unit_id));
      return;
    }
    if (!activeSlot.sqm_size || activeSlot.sqm_size <= 0) {
      toast.error("Enter the space size in square meters");
      return;
    }
    if (!activeSlot.base_rent || activeSlot.base_rent <= 0) {
      toast.error("Enter the monthly rent");
      return;
    }

    setIsSaving(true);
    const result = await draft.send(() => upsertAreaSlot({
      id: activeSlot.id,
      unit_id: unitId,
      status: activeSlot.status || "AVAILABLE",
      sqm_size: activeSlot.sqm_size || 0,
      base_rent: activeSlot.base_rent || 0,
      space_images: activeSlot.space_images || [],
      features: activeSlot.features || [],
      floor: activeSlot.floor || "ground",
      category: activeSlot.category || "retail",
    }));

    setIsSaving(false);
    if (!result) return;
    if (result.success) {
      draft.clear();
      toast.success(activeSlot.id ? `Unit ${unitId} updated` : `Unit ${unitId} added`);
      setIsEditing(false);
      setActiveSlot(null);
      loadSlots();
    } else {
      toast.error(result.error || "Couldn't save the space");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteAreaSlot(deleteTarget.id);
    setIsDeleting(false);
    if (result.success) {
      toast.success(`Unit ${deleteTarget.unit_id} deleted`);
      setDeleteTarget(null);
      loadSlots();
    } else {
      toast.error(result.error || "Couldn't delete the space");
      setDeleteTarget(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlot) return;

    if (activeSlot.space_images && activeSlot.space_images.length >= 10) {
      toast.error("Limit Reached", {
        description: "Maximum of 10 images allowed per space.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "spaces");

      // Keep whatever was typed while the photo was uploading.
      setActiveSlot((slot) => slot && { ...slot, space_images: [...(slot.space_images || []), result.url] });
      toast.success("Media Uploaded", {
        description: "The photo was added. Save the space to keep it.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload Failed", {
        description: "Unable to reach the storage server.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // A unit on a floor that isn't in the list still gets a button, so it can't go missing.
  const floors = [
    ...mallFloors,
    ...[...new Set(slots.map((s) => s.floor || "ground"))]
      .filter((id) => !mallFloors.some((f) => f.id === id))
      .map((id) => ({ id, name: floorLabel(id) })),
  ];
  const activeFloor = floors.some((f) => f.id === selectedFloor) ? selectedFloor : (floors[0]?.id ?? "ground");

  /** The shop on a unit (rented or assigned), if any. */
  const shopOn = (slot: FloorPlanSlot) => holds[slot.unit_id]?.leasedTo || holds[slot.unit_id]?.assignedTo || null;
  /** One line on who has a unit; empty for a unit nobody is on. */
  const whoIsOn = (slot: FloorPlanSlot) => {
    const shop = shopOn(slot);
    if (shop) return holds[slot.unit_id]?.leasedTo ? `Rented by ${shop}` : `Assigned to ${shop}, no lease`;
    if (slot.status === "RESERVED") {
      const r = reservations[slot.unit_id];
      return r ? `Reserved by ${r.name}, ${r.left} left` : "Reserved";
    }
    return slot.status === "OCCUPIED" ? "No tenant linked" : "";
  };
  const tenantLink = (slot: FloorPlanSlot) => {
    const id = holds[slot.unit_id]?.tenantId;
    return id && canSeeTenants ? (
      <Link href={`/admindashboard/tenant-monitoring?tenant=${id}`} className="text-sm font-medium text-kumo-link hover:underline">
        View tenant
      </Link>
    ) : null;
  };

  // A search looks through every floor, by unit number or shop name.
  const query = searchQuery.trim().toLowerCase();
  const matches = slots.filter(
    (s) =>
      (selectedCategory === "all" || s.category === selectedCategory) &&
      (!query || [s.unit_id, shopOn(s) ?? ""].some((v) => v.toLowerCase().includes(query))),
  );
  const filteredSlots = query ? matches : matches.filter((s) => s.floor === activeFloor);
  const currentFloorSlots = matches.filter((s) => s.floor === activeFloor);
  /** Every unit in the mall with this status. */
  const mallCount = (status: string) => slots.filter((s) => s.status === status).length;

  const getCategoryIcon = (category: string) => {
    const cat = FLOOR_CATEGORIES.find((c) => c.id === category);
    return cat ? cat.icon : Store;
  };
  const categoryName = (category?: string) => FLOOR_CATEGORIES.find((c) => c.id === category)?.name ?? category ?? "Retail";
  const floorName = floorLabel(activeFloor);
  const floorSlots = slots.filter((s) => s.floor === activeFloor);
  const countOf = (status: string) => floorSlots.filter((s) => s.status === status).length;
  const picked = currentFloorSlots.find((s) => s.id === pickedId) ?? null;

  // Another unit whose ID only differs by capitals or spaces from the one being typed.
  const typedId = activeSlot?.unit_id?.trim() ?? "";
  const twin =
    typedId && typedId !== startSlot?.unit_id
      ? slots.find((s) => s.id !== startSlot?.id && unitKey(s.unit_id) === unitKey(typedId))
      : undefined;

  /** Why the unit chosen for deletion has to stay; null when it can go. */
  const deleteBlock = (() => {
    if (!deleteTarget) return null;
    const held = holds[deleteTarget.unit_id];
    const reserved = deleteTarget.status === "RESERVED";
    if (held || (reserved && (deleteTarget as { tenant_id?: string | null }).tenant_id)) {
      return unitLock(deleteTarget, held).note;
    }
    return reserved || deleteTarget.status === "OCCUPIED" ? "Set it to Available with Edit first." : null;
  })();

  const openEditor = (slot: Partial<FloorPlanSlot>) => {
    setStartSlot(slot);
    setActiveSlot(slot);
    setNewFeatureInput("");
    setIsEditing(true);
  };
  const addSpace = () => {
    openEditor({
      unit_id: "",
      status: "AVAILABLE",
      sqm_size: 0,
      base_rent: 0,
      space_images: [],
      features: [],
      floor: activeFloor,
      category: "retail",
    });
  };
  const editSpace = (slot: FloorPlanSlot) => openEditor(slot);

  /** What can be done with a unit: used by the map panel, cards and list. */
  const slotActions = (slot: FloorPlanSlot) => (
    <div className="flex flex-wrap justify-end gap-2">
      {slot.status === "RESERVED" && (
        <>
          <Button size="sm" variant="primary" onClick={() => void openDecision(slot, "approve")}>
            Approve
          </Button>
          <Button size="sm" variant="secondary-destructive" onClick={() => void openDecision(slot, "reject")}>
            Reject
          </Button>
        </>
      )}
      <Button size="sm" variant="secondary" icon={<Eye />} onClick={() => setPreviewSlot(slot)}>
        Preview
      </Button>
      <Button size="sm" variant="secondary" icon={<PencilSimple />} onClick={() => editSpace(slot)}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="secondary-destructive"
        shape="square"
        icon={<Trash />}
        aria-label={`Delete Unit ${slot.unit_id}`}
        onClick={() => setDeleteTarget(slot)}
      />
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Floor" className="flex flex-wrap gap-1">
        {floors.map((floor) => (
          <Button
            key={floor.id}
            variant={activeFloor === floor.id ? "primary" : "secondary"}
            aria-pressed={activeFloor === floor.id}
            onClick={() => setSelectedFloor(floor.id)}
          >
            {floor.name} ({slots.filter((s) => s.floor === floor.id).length})
          </Button>
        ))}
      </div>
      <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search unit or shop" className="sm:w-56" />
      <Select
        aria-label="Category"
        value={selectedCategory}
        items={CATEGORY_ITEMS}
        onValueChange={(v) => v != null && setSelectedCategory(v as string)}
        className="w-48"
      >
        {Object.entries(CATEGORY_ITEMS).map(([value, label]) => (
          <Select.Option key={value} value={value}>
            {label}
          </Select.Option>
        ))}
      </Select>
      <div role="group" aria-label="View" className="ml-auto flex gap-1">
        {(
          [
            { id: "floorplan", label: "Map", icon: <MapTrifold /> },
            { id: "grid", label: "Cards", icon: <SquaresFour /> },
            { id: "list", label: "List", icon: <ListDashes /> },
          ] as const
        ).map((view) => (
          <Button
            key={view.id}
            variant={viewMode === view.id ? "primary" : "secondary"}
            icon={view.icon}
            aria-pressed={viewMode === view.id}
            onClick={() => setViewMode(view.id)}
          >
            {view.label}
          </Button>
        ))}
      </div>
    </div>
  );

  /** How a unit looks on the map. */
  const mapTile = (id: string): MapTile => {
    const slot = slots.find((s) => s.id === id)!;
    const Icon = getCategoryIcon(slot.category || "retail");
    const status = STATUS[slot.status] ?? STATUS.MAINTENANCE;
    const reservation = slot.status === "RESERVED" ? reservations[slot.unit_id] : undefined;
    return {
      color: status.color,
      label: [`Unit ${slot.unit_id}, ${status.label}`, whoIsOn(slot)].filter(Boolean).join(", "),
      title: whoIsOn(slot) || undefined,
      lines: [`${slot.sqm_size} sqm`, shopOn(slot) ?? (reservation ? `${reservation.left} left` : status.label)],
      icon: <Icon size={14} aria-hidden className="shrink-0 text-kumo-subtle" />,
    };
  };

  const floorPlan = (
    <Panel
      flush
      title={floorName}
      description={`${currentFloorSlots.length} space${currentFloorSlots.length === 1 ? "" : "s"} shown`}
      actions={
        <>
          <Button size="sm" variant="secondary" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide grid lines" : "Show grid lines"}
          </Button>
          <div role="group" aria-label="Zoom" className="flex items-center gap-1">
            <Button size="sm" variant="secondary" shape="square" icon={<Minus />} aria-label="Zoom out" onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} />
            <span className="min-w-12 text-center text-sm tabular-nums text-kumo-subtle">{Math.round(zoomLevel * 100)}%</span>
            <Button size="sm" variant="secondary" shape="square" icon={<Plus />} aria-label="Zoom in" onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))} />
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={isFullscreen ? <ArrowsIn /> : <ArrowsOut />}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-4 border-b border-kumo-line px-4 py-2 text-sm text-kumo-subtle sm:px-5">
        {Object.entries(STATUS).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label} ({countOf(key)})
          </span>
        ))}
      </div>

      {/* Search results from every floor; choosing one shows it on the map. */}
      {query && (
        <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line px-4 py-2 sm:px-5" role="status">
          <span className="text-sm text-kumo-subtle">
            {matches.length === 0
              ? "No unit or shop matches on any floor."
              : `${matches.length} match${matches.length === 1 ? "" : "es"} on all floors:`}
          </span>
          {matches.slice(0, 12).map((slot) => (
            <Button
              key={slot.id}
              size="sm"
              variant={slot.id === pickedId && slot.floor === activeFloor ? "primary" : "secondary"}
              onClick={() => {
                setSelectedFloor(slot.floor || "ground");
                setPickedId(slot.id);
              }}
            >
              {slot.unit_id}, {floorLabel(slot.floor)}
            </Button>
          ))}
          {matches.length > 12 && <span className="text-sm text-kumo-subtle">and {matches.length - 12} more in List view.</span>}
        </div>
      )}

      {/* The chosen unit and what can be done with it. */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-kumo-line px-4 py-2 sm:px-5" aria-live="polite">
        {picked ? (
          <>
            <p className="text-sm text-kumo-default">
              <strong>Unit {picked.unit_id}</strong>
              <span className="text-kumo-subtle">
                , {categoryName(picked.category)}, {picked.sqm_size} sqm,{" "}
              </span>
              <span className={cn("font-medium", STATUS[picked.status]?.className)}>{STATUS[picked.status]?.label}</span>
              {whoIsOn(picked) && <span className="block text-kumo-subtle">{whoIsOn(picked)}</span>}
              {tenantLink(picked)}
            </p>
            {slotActions(picked)}
          </>
        ) : (
          <p className="text-sm text-kumo-subtle">Select a unit on the map to preview, edit or delete it.</p>
        )}
      </div>

      <FloorMap
        key={activeFloor}
        floorId={activeFloor}
        units={floorSlots as (FloorPlanSlot & { id: string })[]}
        shown={new Set(currentFloorSlots.map((s) => s.id))}
        layout={layouts[activeFloor] ?? AUTO_LAYOUT}
        pickedId={pickedId}
        onPick={setPickedId}
        zoom={zoomLevel}
        showGrid={showGrid}
        className={isFullscreen ? "max-h-[calc(100dvh-14rem)]" : "max-h-[640px]"}
        tile={mapTile}
        onSaved={() => loadSlots(true)}
      />
    </Panel>
  );

  const cards = (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredSlots.map((slot) => (
        <li key={slot.id} className="flex flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
          <div className="relative aspect-video w-full overflow-hidden bg-kumo-recessed">
            {slot.space_images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slot.space_images[0]} alt={`Unit ${slot.unit_id}`} className="absolute inset-0 size-full object-cover" />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-kumo-subtle">No photo</p>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-kumo-default">{slot.unit_id}</h3>
              <span className={cn("text-sm font-medium", STATUS[slot.status]?.className)}>{STATUS[slot.status]?.label}</span>
            </div>
            <p className="text-sm text-kumo-subtle">
              {query && `${floorLabel(slot.floor)}, `}
              {categoryName(slot.category)}, {slot.sqm_size} sqm
            </p>
            {whoIsOn(slot) && <p className="text-sm text-kumo-default">{whoIsOn(slot)}</p>}
            {tenantLink(slot)}
            <p className="text-sm font-medium tabular-nums text-kumo-default">₱{slot.base_rent.toLocaleString()}</p>
            <div className="mt-auto pt-3">{slotActions(slot)}</div>
          </div>
        </li>
      ))}
    </ul>
  );

  const list = (
    <Panel flush>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Unit</Table.Head>
              <Table.Head>Floor</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Tenant</Table.Head>
              <Table.Head>Size</Table.Head>
              <Table.Head>Rent</Table.Head>
              <Table.Head className="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredSlots.map((slot) => (
              <Table.Row key={slot.id}>
                <Table.Cell>
                  <p className="font-medium text-kumo-default">{slot.unit_id}</p>
                  <p className="text-sm text-kumo-subtle">{categoryName(slot.category)}</p>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-sm">{floorLabel(slot.floor)}</Table.Cell>
                <Table.Cell>
                  <span className={cn("text-sm font-medium", STATUS[slot.status]?.className)}>{STATUS[slot.status]?.label}</span>
                </Table.Cell>
                <Table.Cell className="text-sm">
                  <p className="text-kumo-default">{whoIsOn(slot) || "-"}</p>
                  {tenantLink(slot)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-sm">{slot.sqm_size} sqm</Table.Cell>
                <Table.Cell className="whitespace-nowrap text-sm tabular-nums">₱{slot.base_rent.toLocaleString()}</Table.Cell>
                <Table.Cell>{slotActions(slot)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </Panel>
  );

  const content = loading ? (
    <div className="flex justify-center py-24">
      <Loader />
    </div>
  ) : viewMode === "floorplan" ? (
    floorPlan
  ) : filteredSlots.length === 0 ? (
    <Panel flush>
      <EmptyNote title="No spaces match">Try another floor, category, unit number or shop name.</EmptyNote>
    </Panel>
  ) : viewMode === "grid" ? (
    cards
  ) : (
    list
  );

  return (
    <>
      {isFullscreen ? (
        // Fullscreen keeps just the floor choice and the map.
        <div className="fixed inset-0 z-60 space-y-3 overflow-auto bg-kumo-elevated p-4">
          {toolbar}
          {content}
        </div>
      ) : (
        <AdminPage
          title="Floor Spaces and Map"
          description="Manage mall floors, view rentable spaces and update lease units."
          actions={
            <>
              <Button variant="secondary" icon={<Stack />} onClick={() => setManagingFloors(true)}>
                Manage floors
              </Button>
              <Button variant="primary" icon={<Plus />} onClick={addSpace}>
                Add Space
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="All units" value={loading ? "-" : slots.length} hint={`${floors.length} floor${floors.length === 1 ? "" : "s"}`} />
            {(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"] as const).map((status) => (
              <Stat
                key={status}
                label={STATUS[status].label}
                value={loading ? "-" : mallCount(status)}
                tone={status === "RESERVED" && mallCount(status) ? "warning" : "default"}
              />
            ))}
          </div>
          {toolbar}
          {content}
        </AdminPage>
      )}

      <AdminDialog
        open={isEditing}
        onClose={() => setIsEditing(false)}
        size="lg"
        title={activeSlot?.id ? `Edit space ${activeSlot.unit_id ?? ""}` : "Add a space"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Unit ID"
            placeholder="e.g. L1-105"
            value={activeSlot?.unit_id || ""}
            onChange={(e) => setActiveSlot({ ...activeSlot!, unit_id: e.target.value })}
            readOnly={lock.idLocked}
            description={lock.idLocked ? "Locked while this unit is in use." : undefined}
            error={twin ? twinMessage(twin.unit_id) : undefined}
            required
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Floor"
              value={activeSlot?.floor || "ground"}
              items={Object.fromEntries(floors.map((f) => [f.id, f.name]))}
              onValueChange={(v) => v != null && setActiveSlot({ ...activeSlot!, floor: v as string })}
              className="w-full"
            >
              {floors.map((floor) => (
                <Select.Option key={floor.id} value={floor.id}>
                  {floor.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              label="Category"
              value={activeSlot?.category || "retail"}
              items={Object.fromEntries(FLOOR_CATEGORIES.map((c) => [c.id, c.name]))}
              onValueChange={(v) => v != null && setActiveSlot({ ...activeSlot!, category: v as string })}
              className="w-full"
            >
              {FLOOR_CATEGORIES.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Input
              label="Size (sqm)"
              type="number"
              step="any"
              min={0}
              placeholder="0"
              value={activeSlot?.sqm_size || ""}
              onChange={(e) => setActiveSlot({ ...activeSlot!, sqm_size: parseFloat(e.target.value) })}
              required
              className="w-full"
            />
            <Input
              label="Monthly rent (PHP)"
              type="number"
              step="0.01"
              min={0}
              max={MAX_UNIT_RENT}
              placeholder="0"
              value={activeSlot?.base_rent || ""}
              onChange={(e) => setActiveSlot({ ...activeSlot!, base_rent: parseFloat(e.target.value) || 0 })}
              required
              className="w-full"
              description={
                hold.leasedTo
                  ? "The current lease keeps its own rent. This is the listed price after it."
                  : hold.assignedTo
                    ? "No lease is recorded, so this also shows as this tenant's rent."
                    : "Tenants see this in Rent a Space. Hidden from the public."
              }
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-kumo-default">Status</p>
            <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
              {(activeSlot?.status === "RESERVED"
                ? ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "RESERVED"]
                : ["AVAILABLE", "OCCUPIED", "MAINTENANCE"]
              ).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={activeSlot?.status === status ? "primary" : "secondary"}
                  aria-pressed={activeSlot?.status === status}
                  disabled={!lock.statuses.some((allowed) => allowed === status)}
                  onClick={() => setActiveSlot({ ...activeSlot!, status: status as any })}
                >
                  {STATUS[status].label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-sm text-kumo-subtle">{lock.note}</p>
          </div>

          <section className="space-y-2 border-t border-kumo-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-kumo-default">Photos ({activeSlot?.space_images?.length || 0}/10)</p>
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="sr-only" tabIndex={-1} aria-label="Upload a photo" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<UploadSimple />}
                loading={isUploading}
                disabled={(activeSlot?.space_images?.length || 0) >= 10}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload photo
              </Button>
            </div>
            {!!activeSlot?.space_images?.length && (
              <p className="text-sm text-kumo-subtle">The cover photo is the one visitors see first.</p>
            )}
            {!!activeSlot?.space_images?.length && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {activeSlot.space_images.map((img: string, i: number) => (
                  <li key={i} className="space-y-1">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-kumo-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Photo ${i + 1}`} className="absolute inset-0 size-full object-cover" />
                    </div>
                    {i === 0 ? (
                      <p className="flex h-6.5 items-center justify-center text-xs font-semibold text-kumo-default">Cover photo</p>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full justify-center"
                        aria-label={`Make photo ${i + 1} the cover`}
                        onClick={() =>
                          setActiveSlot((slot) => {
                            if (!slot) return slot;
                            const rest = [...(slot.space_images || [])];
                            const [chosen] = rest.splice(i, 1);
                            return { ...slot, space_images: [chosen, ...rest] };
                          })
                        }
                      >
                        Make cover
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary-destructive"
                      className="w-full justify-center"
                      onClick={() => {
                        const newImages = [...(activeSlot?.space_images || [])];
                        newImages.splice(i, 1);
                        setActiveSlot({ ...activeSlot!, space_images: newImages });
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 border-t border-kumo-line pt-4">
            <p className="text-sm font-medium text-kumo-default">
              Features ({activeSlot?.features?.length || 0})
              <span className="font-normal text-kumo-subtle">, shown to the public</span>
            </p>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="New feature"
                  placeholder="e.g. Street-facing frontage"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  className="w-full"
                />
              </div>
              <Button type="button" variant="secondary" icon={<Plus />} disabled={!newFeatureInput.trim()} onClick={handleAddFeature}>
                Add
              </Button>
            </div>
            {activeSlot?.features && activeSlot.features.length > 0 ? (
              <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
                {activeSlot.features.map((feat: string, idx: number) => (
                  <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-kumo-default">{feat}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      shape="square"
                      icon={<Trash />}
                      aria-label={`Remove ${feat}`}
                      onClick={() => handleRemoveFeature(idx)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-kumo-line p-3 text-sm text-kumo-subtle">
                No features added yet. Visitors only see the features you add here.
              </p>
            )}
          </section>

          <DraftNote draft={draft} />

          <div className="flex flex-col-reverse gap-2 border-t border-kumo-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      </AdminDialog>

      <FloorManager
        open={managingFloors}
        onClose={() => setManagingFloors(false)}
        unitsOn={(id) => slots.filter((s) => s.floor === id).length}
        onAdded={setSelectedFloor}
      />

      {decision && (
        <ReservationDecisionModal
          reservation={decision.row}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={loadSlots}
        />
      )}

      <AdminDialog
        open={Boolean(deleteBlock)}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={`Unit ${deleteTarget?.unit_id ?? ""} can't be deleted yet`}
        description={deleteBlock ?? undefined}
        footer={
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Close
          </Button>
        }
      >
        {deleteTarget && tenantLink(deleteTarget)}
      </AdminDialog>

      {deleteTarget && !deleteBlock && (
        <ChatConfirmModal
          title={`Delete Unit ${deleteTarget.unit_id}?`}
          message="The space, its photos and features will be removed from the floor plan and Available Spaces. This can't be undone."
          confirmLabel="Delete space"
          busy={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {previewSlot && (
        <SpaceDetailModal
          preview
          slot={previewSlot as any}
          onClose={() => setPreviewSlot(null)}
        />
      )}
    </>
  );
}
