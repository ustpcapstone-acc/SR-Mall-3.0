"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAreaSlots,
  upsertAreaSlot,
  deleteAreaSlot,
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
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, SearchField } from "@/components/admin/page-kit";
import SpaceDetailModal from "@/components/space-detail-modal";
import { toast } from "sonner";
import { ReservationDecisionModal, type ReservationRow } from "@/components/admin/reservation-decision-modal";
import { ChatConfirmModal } from "@/components/chat/chat-ui";

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

const FLOORS = [
  { id: "ground", name: "Ground Floor", level: 0 },
  { id: "first", name: "First Floor", level: 1 },
  { id: "second", name: "Second Floor", level: 2 },
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
  const floorPlanRef = useRef<HTMLDivElement>(null);

  const [previewSlot, setPreviewSlot] = useState<FloorPlanSlot | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFeatureInput, setNewFeatureInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  /** Approve / release a reservation through the same modal as Bookings. */
  const [decision, setDecision] = useState<{ row: ReservationRow; action: "approve" | "reject" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FloorPlanSlot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const loadSlots = async () => {
    setLoading(true);
    const result = await getAreaSlots();
    if (result.success && result.data) {
      // Sort slots naturally by unit_id (FS1, FS2, FS3... FS10)
      const sortedData = [...result.data].sort((a, b) =>
        a.unit_id.localeCompare(b.unit_id, undefined, { numeric: true, sensitivity: 'base' })
      );

      const floorCounts: Record<string, number> = {};

      const slotsWithPositions = sortedData.map(
        (slot: any) => {
          const floor = slot.floor || "ground";
          if (floorCounts[floor] === undefined) floorCounts[floor] = 0;
          const floorIndex = floorCounts[floor]++;

          // Ignore database x/y coordinates to force a strict auto-flowing grid.
          // This ensures that when a space is deleted, the remaining spaces will "shift up" to fill the gap.
          return {
            ...slot,
            x: (floorIndex % 6) * 150 + 50,
            y: Math.floor(floorIndex / 6) * 120 + 50,
            width: slot.width || 120,
            height: slot.height || 80,
            floor: floor,
            category: slot.category || "retail",
            features: Array.isArray(slot.features) ? slot.features : [],
          };
        }
      );
      setSlots(slotsWithPositions);
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
    if (!activeSlot.sqm_size || activeSlot.sqm_size <= 0) {
      toast.error("Enter the space size in square meters");
      return;
    }

    setIsSaving(true);
    const result = await upsertAreaSlot({
      id: activeSlot.id,
      unit_id: unitId,
      status: activeSlot.status || "AVAILABLE",
      sqm_size: activeSlot.sqm_size || 0,
      base_rent: activeSlot.base_rent || 0,
      space_images: activeSlot.space_images || [],
      features: activeSlot.features || [],
      floor: activeSlot.floor || "ground",
      category: activeSlot.category || "retail",
      x: activeSlot.x || 0,
      y: activeSlot.y || 0,
      width: activeSlot.width || 120,
      height: activeSlot.height || 80,
    } as any);

    setIsSaving(false);
    if (result.success) {
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

      setActiveSlot({
        ...activeSlot,
        space_images: [...(activeSlot.space_images || []), result.url],
      });
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

  const filteredSlots = slots.filter((s) => {
    const matchesSearch = s.unit_id
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFloor = selectedFloor === "all" || s.floor === selectedFloor;
    const matchesCategory =
      selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesFloor && matchesCategory;
  });

  const currentFloorSlots = filteredSlots.filter(
    (s) => s.floor === selectedFloor,
  );

  const getCategoryIcon = (category: string) => {
    const cat = FLOOR_CATEGORIES.find((c) => c.id === category);
    return cat ? cat.icon : Store;
  };
  const categoryName = (category?: string) => FLOOR_CATEGORIES.find((c) => c.id === category)?.name ?? category ?? "Retail";
  const floorName = FLOORS.find((f) => f.id === selectedFloor)?.name;
  const floorSlots = slots.filter((s) => s.floor === selectedFloor);
  const countOf = (status: string) => floorSlots.filter((s) => s.status === status).length;
  const picked = currentFloorSlots.find((s) => s.id === pickedId) ?? null;

  const addSpace = () => {
    setActiveSlot({
      unit_id: "",
      status: "AVAILABLE",
      sqm_size: 0,
      base_rent: 0,
      space_images: [],
      features: [],
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      floor: selectedFloor,
      category: "retail",
    });
    setIsEditing(true);
  };
  const editSpace = (slot: FloorPlanSlot) => {
    setActiveSlot(slot);
    setIsEditing(true);
  };

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
        {FLOORS.map((floor) => (
          <Button
            key={floor.id}
            variant={selectedFloor === floor.id ? "primary" : "secondary"}
            aria-pressed={selectedFloor === floor.id}
            onClick={() => setSelectedFloor(floor.id)}
          >
            {floor.name}
          </Button>
        ))}
      </div>
      <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search unit number" className="sm:w-56" />
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
            <Button size="sm" variant="secondary" shape="square" icon={<Minus />} aria-label="Zoom out" onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))} />
            <span className="min-w-12 text-center text-sm tabular-nums text-kumo-subtle">{Math.round(zoomLevel * 100)}%</span>
            <Button size="sm" variant="secondary" shape="square" icon={<Plus />} aria-label="Zoom in" onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))} />
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
            </p>
            {slotActions(picked)}
          </>
        ) : (
          <p className="text-sm text-kumo-subtle">Select a unit on the map to preview, edit or delete it.</p>
        )}
      </div>

      <div ref={floorPlanRef} className={cn("overflow-auto p-4", isFullscreen ? "h-[calc(100dvh-14rem)]" : "h-[540px]")}>
        <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }} className="relative min-h-[620px] min-w-[950px] rounded-lg border border-dashed border-kumo-line">
          {showGrid && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-kumo-subtle opacity-20">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          )}
          {currentFloorSlots.map((slot) => {
            const Icon = getCategoryIcon(slot.category || "retail");
            const status = STATUS[slot.status] ?? STATUS.MAINTENANCE;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setPickedId(slot.id)}
                aria-pressed={slot.id === pickedId}
                aria-label={`Unit ${slot.unit_id}, ${status.label}`}
                className={cn(
                  "absolute flex cursor-pointer flex-col justify-between rounded-lg border-2 bg-kumo-base p-2 text-left hover:shadow-md",
                  slot.id === pickedId && "ring-2 ring-kumo-brand ring-offset-2",
                )}
                style={{
                  left: `${slot.x}px`,
                  top: `${slot.y}px`,
                  width: `${slot.width}px`,
                  height: `${slot.height}px`,
                  borderColor: status.color,
                  backgroundColor: `${status.color}14`,
                }}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-semibold text-kumo-default">{slot.unit_id}</span>
                  <Icon size={14} aria-hidden className="shrink-0 text-kumo-subtle" />
                </span>
                <span className="text-xs leading-tight text-kumo-subtle">
                  <span className="block truncate">{slot.sqm_size} sqm</span>
                  <span className="block truncate">{status.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
              {categoryName(slot.category)}, {slot.sqm_size} sqm
            </p>
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
                <Table.Cell className="whitespace-nowrap text-sm">{FLOORS.find((f) => f.id === slot.floor)?.name ?? slot.floor}</Table.Cell>
                <Table.Cell>
                  <span className={cn("text-sm font-medium", STATUS[slot.status]?.className)}>{STATUS[slot.status]?.label}</span>
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
      <EmptyNote title="No spaces match">Try another floor, category or unit number.</EmptyNote>
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
            <Button variant="primary" icon={<Plus />} onClick={addSpace}>
              Add Space
            </Button>
          }
        >
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
            required
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Floor"
              value={activeSlot?.floor || "ground"}
              items={Object.fromEntries(FLOORS.map((f) => [f.id, f.name]))}
              onValueChange={(v) => v != null && setActiveSlot({ ...activeSlot!, floor: v as string })}
              className="w-full"
            >
              {FLOORS.map((floor) => (
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
          <Input
            label="Size (sqm)"
            type="number"
            placeholder="0"
            description="Rent isn't shown here or to the public. It's set per tenant in Tenant Monitoring."
            value={activeSlot?.sqm_size || ""}
            onChange={(e) => setActiveSlot({ ...activeSlot!, sqm_size: parseFloat(e.target.value) })}
            required
            className="w-full"
          />

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
                  onClick={() => setActiveSlot({ ...activeSlot!, status: status as any })}
                >
                  {STATUS[status].label}
                </Button>
              ))}
            </div>
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
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {activeSlot.space_images.map((img: string, i: number) => (
                  <li key={i} className="space-y-1">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-kumo-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Photo ${i + 1}`} className="absolute inset-0 size-full object-cover" />
                    </div>
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
                No features added yet. The public view shows the mall&apos;s standard features until you add your own.
              </p>
            )}
          </section>

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

      {decision && (
        <ReservationDecisionModal
          reservation={decision.row}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={loadSlots}
        />
      )}

      {deleteTarget && (
        <ChatConfirmModal
          title={`Delete Unit ${deleteTarget.unit_id}?`}
          message={
            deleteTarget.status === "OCCUPIED" || deleteTarget.status === "RESERVED"
              ? `This space is ${deleteTarget.status.toLowerCase()} and can't be deleted yet.`
              : "The space, its photos and features will be removed from the floor plan and Available Spaces. This can't be undone."
          }
          confirmLabel="Delete space"
          busy={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {previewSlot && (
        <SpaceDetailModal
          slot={previewSlot as any}
          onClose={() => setPreviewSlot(null)}
        />
      )}
    </>
  );
}
