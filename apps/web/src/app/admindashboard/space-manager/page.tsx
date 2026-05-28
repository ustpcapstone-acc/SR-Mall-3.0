"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAreaSlots,
  upsertAreaSlot,
  deleteAreaSlot,
  approveReservationAction,
  rejectReservationAction,
} from "@/app/actions/space-slot";
import {
  Plus,
  Search,
  Map,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Trash2,
  Edit3,
  Camera,
  Save,
  X,
  ExternalLink,
  Zap,
  Droplets,
  Info,
  Ruler,
  CreditCard,
  Maximize2,
  Move,
  Eye,
  EyeOff,
  Layers,
  Grid3x3,
  Building,
  Store,
  Coffee,
  ShoppingBag,
  Smartphone,
  Car,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import SpaceDetailModal from "@/components/space-detail-modal";
import { toast } from "sonner";

// Define the slot type based on Prisma schema
interface AreaSlot {
  id: string;
  unit_id: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  sqm_size: number;
  base_rent: number;
  space_images: string[];
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
  { id: "retail", name: "Retail", icon: ShoppingBag, color: "bg-blue-500" },
  { id: "food", name: "Food & Beverage", icon: Coffee, color: "bg-orange-500" },
  { id: "tech", name: "Technology", icon: Smartphone, color: "bg-purple-500" },
  { id: "services", name: "Services", icon: Store, color: "bg-green-500" },
  { id: "parking", name: "Parking", icon: Car, color: "bg-gray-500" },
];

const FLOORS = [
  { id: "ground", name: "Ground Floor", level: 0 },
  { id: "first", name: "First Floor", level: 1 },
  { id: "second", name: "Second Floor", level: 2 },
];

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
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSlot, setDraggedSlot] = useState<FloorPlanSlot | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  const [previewSlot, setPreviewSlot] = useState<FloorPlanSlot | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          };
        }
      );
      setSlots(slotsWithPositions);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlot?.unit_id) return;

    const result = await upsertAreaSlot({
      id: activeSlot.id,
      unit_id: activeSlot.unit_id,
      status: activeSlot.status || "AVAILABLE",
      sqm_size: activeSlot.sqm_size || 0,
      base_rent: activeSlot.base_rent || 0,
      space_images: activeSlot.space_images || [],
      floor: activeSlot.floor || "ground",
      category: activeSlot.category || "retail",
      x: activeSlot.x || 0,
      y: activeSlot.y || 0,
      width: activeSlot.width || 120,
      height: activeSlot.height || 80,
    } as any);

    if (result.success) {
      setIsEditing(false);
      setActiveSlot(null);
      loadSlots();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this space?")) return;
    const result = await deleteAreaSlot(id);
    if (result.success) {
      loadSlots();
    }
  };

  const handleDragStart = (slot: FloorPlanSlot) => {
    setIsDragging(true);
    setDraggedSlot(slot);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    if (!draggedSlot) return;

    const updatedSlots = slots.map((slot) =>
      slot.id === draggedSlot.id ? { ...slot, x, y } : slot,
    );
    setSlots(updatedSlots);
    const dragged = draggedSlot;
    handleDragEnd();

    await upsertAreaSlot({
      id: dragged.id,
      unit_id: dragged.unit_id,
      status: dragged.status,
      sqm_size: dragged.sqm_size,
      base_rent: dragged.base_rent,
      space_images: dragged.space_images,
      floor: dragged.floor,
      category: dragged.category,
      x: x,
      y: y,
      width: dragged.width,
      height: dragged.height,
    } as any);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
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
        description: "Asset has been successfully synchronized.",
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

  const getSlotColor = (status: string, category: string) => {
    if (status === "AVAILABLE") return "bg-emerald-500/20 border-emerald-500";
    if (status === "OCCUPIED") return "bg-blue-500/20 border-blue-500";
    if (status === "MAINTENANCE") return "bg-amber-500/20 border-amber-500";
    if (status === "RESERVED")
      return "bg-primary/20 border-primary animate-pulse";
    return "bg-gray-500/20 border-gray-500";
  };

  const getCategoryIcon = (category: string) => {
    const cat = FLOOR_CATEGORIES.find((c) => c.id === category);
    return cat ? cat.icon : Store;
  };

  return (
    <div
      className={clsx(
        "min-h-screen bg-transparent p-4 lg:p-8 space-y-6 animate-fade-in-up",
        isFullscreen ? "p-0" : "max-w-[1600px] mx-auto",
      )}
    >
      {/* Background Decor */}
      <div
        className={clsx(
          "fixed",
          "inset-0",
          "pointer-events-none",
          "opacity-20",
          "dark:opacity-40",
          "overflow-hidden",
          "-z-10",
        )}
      >
        <div
          className={clsx(
            "absolute",
            "top-[20%]",
            "right-[-5%]",
            "w-[30%]",
            "h-[30%]",
            "bg-primary/10",
            "blur-[120px]",
            "rounded-full",
          )}
        />
      </div>

      {!isFullscreen && (
        <>
          {/* Header section with Enterprise theme */}
          <div
            className={clsx(
              "flex",
              "flex-col",
              "lg:flex-row",
              "lg:items-end",
              "justify-between",
              "gap-8",
              "mb-8",
            )}
          >
            <div className="space-y-2">
              <div
                className={clsx(
                  "flex",
                  "items-center",
                  "gap-3",
                  "text-primary",
                  "mb-3",
                )}
              >
                <div
                  className={clsx(
                    "w-8",
                    "h-8",
                    "rounded-lg",
                    "bg-primary/10",
                    "flex",
                    "items-center",
                    "justify-center",
                  )}
                >
                  <Building size={18} />
                </div>
                <span
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "uppercase",
                    "tracking-[0.4em]",
                  )}
                >
                  Interactive Floor Plan v5.0
                </span>
              </div>
              <h1
                className={clsx(
                  "text-4xl",
                  "md:text-5xl",
                  "font-black",
                  "text-charcoal",
                  "dark:text-white",
                  "tracking-tight",
                  "leading-none",
                  "italic",
                  "uppercase",
                )}
              >
                Matrix <span className="text-primary">Blueprint</span>
              </h1>
              <p
                className={clsx(
                  "text-slate-500",
                  "font-medium",
                  "text-lg",
                  "max-w-2xl",
                  "leading-relaxed",
                )}
              >
                Advanced space management with drag-and-drop floor planning,
                real-time visualization, and intelligent asset tracking.
              </p>
            </div>

            <div className={clsx("flex", "gap-3")}>
              <button
                onClick={() => setIsFullscreen(true)}
                className={clsx(
                  "flex",
                  "items-center",
                  "gap-2",
                  "px-6",
                  "py-3",
                  "bg-slate-100",
                  "dark:bg-white/5",
                  "hover:bg-slate-200",
                  "dark:hover:bg-white/10",
                  "text-slate-700",
                  "dark:text-slate-300",
                  "font-bold",
                  "rounded-2xl",
                  "transition-all",
                )}
              >
                <Maximize2 size={18} />
                Fullscreen
              </button>
              <button
                onClick={() => {
                  setActiveSlot({
                    unit_id: "",
                    status: "AVAILABLE",
                    sqm_size: 0,
                    base_rent: 0,
                    space_images: [],
                    x: 100,
                    y: 100,
                    width: 120,
                    height: 80,
                    floor: selectedFloor,
                    category: "retail",
                  });
                  setIsEditing(true);
                }}
                className={clsx(
                  "flex",
                  "items-center",
                  "gap-3",
                  "px-8",
                  "py-4",
                  "bg-primary",
                  "hover:bg-primary-hover",
                  "text-white",
                  "font-black",
                  "rounded-2xl",
                  "transition-all",
                  "shadow-xl",
                  "shadow-primary/30",
                  "active:scale-95",
                  "whitespace-nowrap",
                  "uppercase",
                  "tracking-widest",
                  "text-xs",
                )}
              >
                <Plus size={20} strokeWidth={3} />
                Add Space
              </button>
            </div>
          </div>

          {/* Control Bar - Premium Glassmorphism */}
          <div
            className={clsx(
              "flex",
              "flex-wrap",
              "gap-4",
              "p-4",
              "glass-premium",
              "bg-white/40",
              "dark:bg-white/5",
              "border",
              "border-slate-200",
              "dark:border-white/10",
              "rounded-3xl",
              "backdrop-blur-xl",
              "shadow-2xl",
              "shadow-black/5",
            )}
          >
            <div
              className={clsx(
                "flex-1",
                "min-w-[200px]",
                "relative",
                "flex",
                "items-center",
                "group",
              )}
            >
              <Search
                className={clsx(
                  "absolute",
                  "left-4",
                  "text-slate-400",
                  "group-focus-within:text-primary",
                  "transition-colors",
                )}
                size={20}
              />
              <input
                type="text"
                placeholder="Search spaces..."
                className={clsx(
                  "w-full",
                  "pl-12",
                  "pr-6",
                  "py-3",
                  "bg-slate-50",
                  "dark:bg-zinc-950/50",
                  "border",
                  "border-slate-200",
                  "dark:border-white/5",
                  "rounded-2xl",
                  "text-charcoal",
                  "dark:text-white",
                  "font-medium",
                  "focus:outline-none",
                  "focus:border-primary",
                  "focus:ring-4",
                  "focus:ring-primary/10",
                  "transition-all",
                  "placeholder:text-slate-400",
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Floor Selector */}
            <div
              className={clsx(
                "flex",
                "items-center",
                "gap-2",
                "p-2",
                "bg-slate-50",
                "dark:bg-zinc-950/50",
                "border",
                "border-slate-200",
                "dark:border-white/5",
                "rounded-2xl",
              )}
            >
              {FLOORS.map((floor) => (
                <button
                  key={floor.id}
                  onClick={() => setSelectedFloor(floor.id)}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    selectedFloor === floor.id
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:text-charcoal dark:hover:text-white",
                  )}
                >
                  {floor.name}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div
              className={clsx(
                "flex",
                "items-center",
                "gap-2",
                "p-2",
                "bg-slate-50",
                "dark:bg-zinc-950/50",
                "border",
                "border-slate-200",
                "dark:border-white/5",
                "rounded-2xl",
              )}
            >
              <button
                onClick={() => setSelectedCategory("all")}
                className={clsx(
                  "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  selectedCategory === "all"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:text-charcoal dark:hover:text-white",
                )}
              >
                All
              </button>
              {FLOOR_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={clsx(
                      "p-2 rounded-xl transition-all",
                      selectedCategory === cat.id
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:text-charcoal dark:hover:text-white",
                    )}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>

            {/* View Controls */}
            <div
              className={clsx(
                "flex",
                "items-center",
                "gap-2",
                "p-2",
                "bg-slate-50",
                "dark:bg-zinc-950/50",
                "border",
                "border-slate-200",
                "dark:border-white/5",
                "rounded-2xl",
              )}
            >
              <button
                onClick={() => setViewMode("floorplan")}
                className={clsx(
                  "p-3 rounded-xl transition-all",
                  viewMode === "floorplan"
                    ? "bg-primary text-white"
                    : "text-slate-400",
                )}
              >
                <Grid3x3 size={20} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={clsx(
                  "p-3 rounded-xl transition-all",
                  viewMode === "grid"
                    ? "bg-primary text-white"
                    : "text-slate-400",
                )}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={clsx(
                  "p-3 rounded-xl transition-all",
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "text-slate-400",
                )}
              >
                <List size={20} />
              </button>
              <div
                className={clsx(
                  "w-px",
                  "h-6",
                  "bg-slate-200",
                  "dark:bg-white/10",
                  "mx-1",
                )}
              />
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={clsx(
                  "p-3 rounded-xl transition-all",
                  showGrid ? "bg-primary text-white" : "text-slate-400",
                )}
              >
                {showGrid ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>

            {/* Zoom Controls */}
            {viewMode === "floorplan" && (
              <div
                className={clsx(
                  "flex",
                  "items-center",
                  "gap-2",
                  "p-2",
                  "bg-slate-50",
                  "dark:bg-zinc-950/50",
                  "border",
                  "border-slate-200",
                  "dark:border-white/5",
                  "rounded-2xl",
                )}
              >
                <button
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                  className={clsx(
                    "p-2",
                    "rounded-lg",
                    "text-slate-600",
                    "hover:text-charcoal",
                    "dark:hover:text-white",
                  )}
                >
                  -
                </button>
                <span
                  className={clsx(
                    "text-xs",
                    "font-bold",
                    "text-slate-600",
                    "dark:text-slate-400",
                    "min-w-[50px]",
                    "text-center",
                  )}
                >
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
                  className={clsx(
                    "p-2",
                    "rounded-lg",
                    "text-slate-600",
                    "hover:text-charcoal",
                    "dark:hover:text-white",
                  )}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {loading ? (
        <div
          className={clsx(
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "h-96",
            "gap-6",
          )}
        >
          <div className="relative">
            <div
              className={clsx(
                "w-20",
                "h-20",
                "border-4",
                "border-primary/10",
                "border-t-primary",
                "rounded-full",
                "animate-spin",
              )}
            />
            <div
              className={clsx(
                "absolute",
                "inset-0",
                "w-20",
                "h-20",
                "border-4",
                "border-transparent",
                "border-b-primary/40",
                "rounded-full",
                "animate-reverse-spin",
              )}
            />
          </div>
          <p
            className={clsx(
              "animate-pulse",
              "tracking-[0.5em]",
              "uppercase",
              "text-[10px]",
              "font-black",
              "text-slate-400",
            )}
          >
            Loading Floor Plan
          </p>
        </div>
      ) : (
        <>
          {viewMode === "floorplan" ? (
            <div
              className={clsx(
                "relative bg-white dark:bg-zinc-950 rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden",
                isFullscreen ? "h-screen" : "h-[600px]",
              )}
            >
              {/* Floor Plan Header */}
              <div
                className={clsx(
                  "absolute",
                  "top-0",
                  "left-0",
                  "right-0",
                  "z-20",
                  "bg-white/90",
                  "dark:bg-zinc-950/90",
                  "backdrop-blur-sm",
                  "border-b",
                  "border-slate-200",
                  "dark:border-white/10",
                  "p-4",
                )}
              >
                <div
                  className={clsx("flex", "items-center", "justify-between")}
                >
                  <div className={clsx("flex", "items-center", "gap-4")}>
                    <h3
                      className={clsx(
                        "text-xl",
                        "font-black",
                        "text-charcoal",
                        "dark:text-white",
                      )}
                    >
                      {FLOORS.find((f) => f.id === selectedFloor)?.name}
                    </h3>
                    <span className={clsx("text-sm", "text-slate-500")}>
                      {currentFloorSlots.length} spaces
                    </span>
                  </div>
                  {isFullscreen && (
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className={clsx(
                        "p-2",
                        "hover:bg-slate-100",
                        "dark:hover:bg-white/10",
                        "rounded-lg",
                        "transition-all",
                      )}
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Floor Plan Canvas */}
              <div
                ref={floorPlanRef}
                className={clsx(
                  "relative",
                  "w-full",
                  "h-full",
                  "overflow-auto",
                  "pt-16",
                )}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className={clsx(
                    "relative",
                    "w-full",
                    "h-full",
                    "min-w-[800px]",
                    "min-h-[600px]",
                  )}
                >
                  {/* Grid Background */}
                  {showGrid && (
                    <div
                      className={clsx(
                        "absolute",
                        "inset-0",
                        "pointer-events-none",
                      )}
                    >
                      <svg className={clsx("w-full", "h-full")}>
                        <defs>
                          <pattern
                            id="grid"
                            width="20"
                            height="20"
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d="M 20 0 L 0 0 0 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="0.5"
                              className={clsx(
                                "text-slate-200",
                                "dark:text-white/5",
                              )}
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>
                  )}

                  {/* Floor Spaces */}
                  {currentFloorSlots.map((slot) => {
                    const Icon = getCategoryIcon(slot.category || "retail");
                    return (
                      <div
                        key={slot.id}
                        draggable
                        onDragStart={() => handleDragStart(slot)}
                        onDragEnd={handleDragEnd}
                        className={clsx(
                          "absolute border-2 rounded-lg cursor-move transition-all hover:shadow-lg group",
                          getSlotColor(slot.status, slot.category || "retail"),
                          isDragging &&
                            draggedSlot?.id === slot.id &&
                            "opacity-50",
                        )}
                        style={{
                          left: `${slot.x}px`,
                          top: `${slot.y}px`,
                          width: `${slot.width}px`,
                          height: `${slot.height}px`,
                        }}
                        onDrop={(e) => handleDrop(e, slot.x || 0, slot.y || 0)}
                        onDragOver={handleDragOver}
                      >
                        <div
                          className={clsx(
                            "p-2",
                            "h-full",
                            "flex",
                            "flex-col",
                            "justify-between",
                          )}
                        >
                          <div
                            className={clsx(
                              "flex",
                              "items-start",
                              "justify-between",
                            )}
                          >
                            <Icon
                              size={16}
                              className={clsx(
                                "text-slate-600",
                                "dark:text-slate-400",
                              )}
                            />
                            <span
                              className={clsx(
                                "text-[8px] px-1 py-0.5 rounded font-bold",
                                slot.status === "AVAILABLE"
                                  ? "bg-emerald-500 text-white"
                                  : slot.status === "OCCUPIED"
                                    ? "bg-blue-500 text-white"
                                    : "bg-amber-500 text-white",
                              )}
                            >
                              {slot.status}
                            </span>
                          </div>
                          <div>
                            <h4
                              className={clsx(
                                "text-xs",
                                "font-black",
                                "text-charcoal",
                                "dark:text-white",
                              )}
                            >
                              {slot.unit_id}
                            </h4>
                            <p className={clsx("text-[8px]", "text-slate-500")}>
                              {slot.sqm_size}m²
                            </p>
                          </div>
                        </div>

                        {/* Hover Actions */}
                        <div
                          className={clsx(
                            "absolute",
                            "inset-0",
                            "bg-black/80",
                            "opacity-0",
                            "group-hover:opacity-100",
                            "transition-opacity",
                            "rounded-lg",
                            "flex",
                            "items-center",
                            "justify-center",
                            "gap-2",
                            "z-30",
                          )}
                        >
                          {slot.status === "RESERVED" && (
                            <>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      `Approve reservation for Unit ${slot.unit_id}?`,
                                    )
                                  ) {
                                    const res = await approveReservationAction(
                                      slot.unit_id,
                                    );
                                    if (res.success) {
                                      toast.success("Reservation Approved");
                                      loadSlots();
                                    }
                                  }
                                }}
                                className={clsx(
                                  "p-2",
                                  "bg-emerald-500",
                                  "rounded-lg",
                                  "hover:bg-emerald-600",
                                  "transition-all",
                                  "text-white",
                                )}
                                title="Approve Reservation"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      `Release reservation for Unit ${slot.unit_id}?`,
                                    )
                                  ) {
                                    const res = await rejectReservationAction(
                                      slot.unit_id,
                                    );
                                    if (res.success) {
                                      toast.warning("Reservation Released");
                                      loadSlots();
                                    }
                                  }
                                }}
                                className={clsx(
                                  "p-2",
                                  "bg-red-500",
                                  "rounded-lg",
                                  "hover:bg-red-600",
                                  "transition-all",
                                  "text-white",
                                )}
                                title="Reject Reservation"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setPreviewSlot(slot)}
                            className={clsx(
                              "p-2",
                              "bg-white/20",
                              "backdrop-blur-sm",
                              "rounded-lg",
                              "hover:bg-white",
                              "transition-all",
                              "text-white",
                              "hover:text-black",
                            )}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setActiveSlot(slot);
                              setIsEditing(true);
                            }}
                            className={clsx(
                              "p-2",
                              "bg-white/20",
                              "backdrop-blur-sm",
                              "rounded-lg",
                              "hover:bg-white/30",
                              "transition-all",
                            )}
                          >
                            <Edit3 size={14} className="text-white" />
                          </button>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className={clsx(
                              "p-2",
                              "bg-red-500/20",
                              "backdrop-blur-sm",
                              "rounded-lg",
                              "hover:bg-red-500/30",
                              "transition-all",
                            )}
                          >
                            <Trash2 size={14} className="text-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              {filteredSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={clsx(
                    "group glass-premium dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5",
                    viewMode === "list"
                      ? "flex items-center p-6 gap-8"
                      : "flex flex-col",
                  )}
                >
                  {/* Grid View */}
                  {viewMode === "grid" && (
                    <>
                      <div
                        className={clsx(
                          "relative",
                          "h-48",
                          "overflow-hidden",
                          "bg-slate-100",
                          "dark:bg-black/40",
                        )}
                      >
                        {slot.space_images?.[0] ? (
                          <img
                            src={slot.space_images[0]}
                            alt={slot.unit_id}
                            className={clsx(
                              "w-full",
                              "h-full",
                              "object-cover",
                              "opacity-90",
                              "group-hover:opacity-100",
                              "group-hover:scale-110",
                              "transition-all",
                              "duration-700",
                            )}
                          />
                        ) : (
                          <div
                            className={clsx(
                              "w-full",
                              "h-full",
                              "flex",
                              "flex-col",
                              "items-center",
                              "justify-center",
                              "text-slate-300",
                              "dark:text-white/10",
                              "space-y-4",
                            )}
                          >
                            {(() => {
                              const Icon = getCategoryIcon(
                                slot.category || "retail",
                              );
                              return <Icon size={48} strokeWidth={1} />;
                            })()}
                            <span
                              className={clsx(
                                "text-[10px]",
                                "uppercase",
                                "font-black",
                                "tracking-[0.3em]",
                              )}
                            >
                              {slot.unit_id}
                            </span>
                          </div>
                        )}

                        {/* Actions Overlay */}
                        <div
                          className={clsx(
                            "absolute",
                            "inset-0",
                            "bg-gradient-to-t",
                            "from-black/60",
                            "to-transparent",
                            "opacity-0",
                            "group-hover:opacity-100",
                            "transition-opacity",
                            "duration-300",
                          )}
                        />
                        <div
                          className={clsx(
                            "absolute",
                            "bottom-4",
                            "left-4",
                            "right-4",
                            "flex",
                            "gap-2",
                            "translate-y-4",
                            "opacity-0",
                            "group-hover:translate-y-0",
                            "group-hover:opacity-100",
                            "transition-all",
                            "duration-500",
                          )}
                        >
                          <button
                            onClick={() => setPreviewSlot(slot)}
                            className={clsx(
                              "p-2",
                              "bg-white/20",
                              "backdrop-blur-md",
                              "text-white",
                              "border",
                              "border-white/20",
                              "rounded-lg",
                              "hover:bg-white",
                              "hover:text-black",
                              "transition-all",
                            )}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setActiveSlot(slot);
                              setIsEditing(true);
                            }}
                            className={clsx(
                              "flex-1",
                              "py-2",
                              "bg-white",
                              "text-black",
                              "font-black",
                              "text-[10px]",
                              "uppercase",
                              "tracking-widest",
                              "rounded-lg",
                              "hover:bg-primary",
                              "hover:text-white",
                              "transition-all",
                            )}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className={clsx(
                              "p-2",
                              "bg-red-500/20",
                              "backdrop-blur-md",
                              "text-red-500",
                              "border",
                              "border-red-500/20",
                              "rounded-lg",
                              "hover:bg-red-500",
                              "hover:text-white",
                              "transition-all",
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div
                        className={clsx("p-6", "flex-1", "flex", "flex-col")}
                      >
                        <div
                          className={clsx(
                            "flex",
                            "justify-between",
                            "items-start",
                            "mb-4",
                          )}
                        >
                          <div>
                            <h3
                              className={clsx(
                                "text-xl",
                                "font-black",
                                "text-charcoal",
                                "dark:text-white",
                                "tracking-tight",
                              )}
                            >
                              {slot.unit_id}
                            </h3>
                            <p
                              className={clsx(
                                "text-slate-400",
                                "text-[10px]",
                                "uppercase",
                                "font-black",
                                "tracking-widest",
                                "mt-1",
                              )}
                            >
                              {slot.category}
                            </p>
                          </div>
                          <span
                            className={clsx(
                              "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border",
                              slot.status === "AVAILABLE"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : slot.status === "OCCUPIED"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20",
                            )}
                          >
                            {slot.status}
                          </span>
                        </div>

                        <div
                          className={clsx(
                            "grid",
                            "grid-cols-2",
                            "gap-3",
                            "mt-auto",
                          )}
                        >
                          <div
                            className={clsx(
                              "p-3",
                              "bg-slate-50",
                              "dark:bg-white/5",
                              "rounded-2xl",
                              "border",
                              "border-slate-100",
                              "dark:border-white/5",
                            )}
                          >
                            <p
                              className={clsx(
                                "text-[10px]",
                                "text-slate-400",
                                "uppercase",
                                "font-black",
                                "tracking-widest",
                                "mb-1",
                              )}
                            >
                              Size
                            </p>
                            <p
                              className={clsx(
                                "font-extrabold",
                                "text-lg",
                                "text-charcoal",
                                "dark:text-white",
                              )}
                            >
                              {slot.sqm_size}
                              <span
                                className={clsx(
                                  "text-xs",
                                  "text-slate-400",
                                  "font-bold",
                                  "ml-1",
                                )}
                              >
                                m²
                              </span>
                            </p>
                          </div>
                          <div
                            className={clsx(
                              "p-3",
                              "bg-slate-50",
                              "dark:bg-white/5",
                              "rounded-2xl",
                              "border",
                              "border-slate-100",
                              "dark:border-white/5",
                            )}
                          >
                            <p
                              className={clsx(
                                "text-[10px]",
                                "text-slate-400",
                                "uppercase",
                                "font-black",
                                "tracking-widest",
                                "mb-1",
                              )}
                            >
                              Rent
                            </p>
                            <p
                              className={clsx(
                                "font-extrabold",
                                "text-lg",
                                "text-charcoal",
                                "dark:text-white",
                              )}
                            >
                              ₱{slot.base_rent.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* List View */}
                  {viewMode === "list" && (
                    <>
                      <div
                        className={clsx(
                          "w-20",
                          "h-20",
                          "bg-slate-100",
                          "dark:bg-black/40",
                          "rounded-2xl",
                          "flex",
                          "items-center",
                          "justify-center",
                          "text-slate-300",
                          "dark:text-white/20",
                          "shrink-0",
                          "border",
                          "border-slate-200",
                          "dark:border-white/10",
                          "group-hover:border-primary/40",
                          "transition-colors",
                        )}
                      >
                        {(() => {
                          const Icon = getCategoryIcon(
                            slot.category || "retail",
                          );
                          return <Icon size={32} />;
                        })()}
                      </div>

                      <div
                        className={clsx(
                          "flex-1",
                          "grid",
                          "grid-cols-5",
                          "items-center",
                          "gap-6",
                        )}
                      >
                        <div>
                          <h3
                            className={clsx(
                              "text-lg",
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                            )}
                          >
                            {slot.unit_id}
                          </h3>
                          <p
                            className={clsx(
                              "text-[10px]",
                              "text-slate-400",
                              "font-bold",
                              "uppercase",
                              "tracking-widest",
                            )}
                          >
                            {slot.category}
                          </p>
                        </div>
                        <div className={clsx("flex", "items-center", "gap-2")}>
                          <div
                            className={clsx(
                              "w-2 h-2 rounded-full",
                              slot.status === "AVAILABLE"
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : slot.status === "OCCUPIED"
                                  ? "bg-primary"
                                  : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                            )}
                          />
                          <span
                            className={clsx(
                              "text-xs",
                              "text-charcoal",
                              "dark:text-white",
                              "tracking-widest",
                              "font-black",
                              "uppercase",
                            )}
                          >
                            {slot.status}
                          </span>
                        </div>
                        <div>
                          <span
                            className={clsx(
                              "text-sm",
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                            )}
                          >
                            {slot.sqm_size}m²
                          </span>
                        </div>
                        <div>
                          <span
                            className={clsx(
                              "text-sm",
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                            )}
                          >
                            ₱{slot.base_rent.toLocaleString()}
                          </span>
                        </div>
                        <div
                          className={clsx(
                            "flex",
                            "justify-end",
                            "gap-2",
                            "opacity-0",
                            "group-hover:opacity-100",
                            "transition-all",
                            "duration-300",
                          )}
                        >
                          {slot.status === "RESERVED" && (
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Approve reservation for Unit ${slot.unit_id}?`,
                                  )
                                ) {
                                  const res = await approveReservationAction(
                                    slot.unit_id,
                                  );
                                  if (res.success) {
                                    toast.success("Reservation Approved");
                                    loadSlots();
                                  }
                                }
                              }}
                              className={clsx(
                                "p-2",
                                "bg-primary/20",
                                "text-primary",
                                "rounded-xl",
                                "hover:bg-primary",
                                "hover:text-white",
                                "transition-all",
                              )}
                              title="Approve Reservation"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setPreviewSlot(slot)}
                            className={clsx(
                              "p-2",
                              "hover:bg-primary",
                              "hover:text-white",
                              "text-slate-400",
                              "dark:text-slate-500",
                              "rounded-xl",
                              "transition-all",
                            )}
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setActiveSlot(slot);
                              setIsEditing(true);
                            }}
                            className={clsx(
                              "p-2",
                              "hover:bg-primary",
                              "hover:text-white",
                              "text-slate-400",
                              "dark:text-slate-500",
                              "rounded-xl",
                              "transition-all",
                            )}
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className={clsx(
                              "p-2",
                              "hover:bg-red-500",
                              "hover:text-white",
                              "text-slate-400",
                              "dark:text-slate-500",
                              "rounded-xl",
                              "transition-all",
                            )}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Slide-over Editor */}
      {isEditing && (
        <div
          className={clsx("fixed", "inset-0", "z-[60]", "flex", "justify-end")}
        >
          <div
            className={clsx(
              "absolute",
              "inset-0",
              "bg-charcoal/40",
              "dark:bg-black/80",
              "backdrop-blur-md",
              "animate-in",
              "fade-in",
              "duration-500",
            )}
            onClick={() => setIsEditing(false)}
          />
          <div
            className={clsx(
              "relative",
              "w-full",
              "max-w-2xl",
              "bg-white",
              "dark:bg-zinc-950",
              "border-l",
              "border-slate-200",
              "dark:border-white/10",
              "p-8",
              "lg:p-12",
              "flex",
              "flex-col",
              "h-full",
              "animate-in",
              "slide-in-from-right",
              "duration-700",
              "shadow-[-40px_0_80px_rgba(0,0,0,0.2)]",
            )}
          >
            <div
              className={clsx("flex", "justify-between", "items-start", "mb-8")}
            >
              <div className="space-y-2">
                <div
                  className={clsx(
                    "flex",
                    "items-center",
                    "gap-2",
                    "text-primary",
                    "uppercase",
                    "tracking-[0.3em]",
                    "font-black",
                    "text-[10px]",
                  )}
                >
                  <Info size={14} />
                  Space Configuration
                </div>
                <h2
                  className={clsx(
                    "text-3xl",
                    "font-black",
                    "text-charcoal",
                    "dark:text-white",
                    "tracking-tight",
                  )}
                >
                  Edit <span className="text-primary">Space</span>
                </h2>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className={clsx(
                  "p-3",
                  "bg-slate-50",
                  "dark:bg-white/5",
                  "hover:bg-primary/10",
                  "rounded-full",
                  "transition-all",
                  "text-slate-400",
                  "hover:text-primary",
                )}
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className={clsx("space-y-6", "flex-1", "overflow-y-auto", "pr-4")}
            >
              {/* Basic Info */}
              <div className="space-y-4">
                <label
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "text-slate-400",
                    "uppercase",
                    "tracking-[0.4em]",
                  )}
                >
                  Unit ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. L1-105"
                  className={clsx(
                    "w-full",
                    "p-4",
                    "bg-slate-50",
                    "dark:bg-zinc-900",
                    "border",
                    "border-slate-200",
                    "dark:border-white/10",
                    "rounded-xl",
                    "text-charcoal",
                    "dark:text-white",
                    "focus:outline-none",
                    "focus:border-primary",
                    "transition-all",
                  )}
                  value={activeSlot?.unit_id || ""}
                  onChange={(e) =>
                    setActiveSlot({ ...activeSlot!, unit_id: e.target.value })
                  }
                  required
                />
              </div>

              {/* Floor & Category */}
              <div className={clsx("grid", "grid-cols-2", "gap-4")}>
                <div className="space-y-4">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-400",
                      "uppercase",
                      "tracking-[0.4em]",
                    )}
                  >
                    Floor
                  </label>
                  <select
                    className={clsx(
                      "w-full",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-xl",
                      "text-charcoal",
                      "dark:text-white",
                      "focus:outline-none",
                      "focus:border-primary",
                      "transition-all",
                    )}
                    value={activeSlot?.floor || "ground"}
                    onChange={(e) =>
                      setActiveSlot({ ...activeSlot!, floor: e.target.value })
                    }
                  >
                    {FLOORS.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-4">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-400",
                      "uppercase",
                      "tracking-[0.4em]",
                    )}
                  >
                    Category
                  </label>
                  <select
                    className={clsx(
                      "w-full",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-xl",
                      "text-charcoal",
                      "dark:text-white",
                      "focus:outline-none",
                      "focus:border-primary",
                      "transition-all",
                    )}
                    value={activeSlot?.category || "retail"}
                    onChange={(e) =>
                      setActiveSlot({
                        ...activeSlot!,
                        category: e.target.value,
                      })
                    }
                  >
                    {FLOOR_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Position & Size (for floor plan) */}
              <div className="space-y-4">
                <label
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "text-slate-400",
                    "uppercase",
                    "tracking-[0.4em]",
                  )}
                >
                  Floor Plan Position
                </label>
                <div className={clsx("grid", "grid-cols-4", "gap-4")}>
                  <div>
                    <label
                      className={clsx(
                        "text-[9px]",
                        "text-slate-500",
                        "uppercase",
                      )}
                    >
                      X
                    </label>
                    <input
                      type="number"
                      className={clsx(
                        "w-full",
                        "p-3",
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "border",
                        "border-slate-200",
                        "dark:border-white/10",
                        "rounded-lg",
                        "text-charcoal",
                        "dark:text-white",
                        "focus:outline-none",
                        "focus:border-primary",
                        "transition-all",
                      )}
                      value={activeSlot?.x || 0}
                      onChange={(e) =>
                        setActiveSlot({
                          ...activeSlot!,
                          x: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className={clsx(
                        "text-[9px]",
                        "text-slate-500",
                        "uppercase",
                      )}
                    >
                      Y
                    </label>
                    <input
                      type="number"
                      className={clsx(
                        "w-full",
                        "p-3",
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "border",
                        "border-slate-200",
                        "dark:border-white/10",
                        "rounded-lg",
                        "text-charcoal",
                        "dark:text-white",
                        "focus:outline-none",
                        "focus:border-primary",
                        "transition-all",
                      )}
                      value={activeSlot?.y || 0}
                      onChange={(e) =>
                        setActiveSlot({
                          ...activeSlot!,
                          y: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className={clsx(
                        "text-[9px]",
                        "text-slate-500",
                        "uppercase",
                      )}
                    >
                      Width
                    </label>
                    <input
                      type="number"
                      className={clsx(
                        "w-full",
                        "p-3",
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "border",
                        "border-slate-200",
                        "dark:border-white/10",
                        "rounded-lg",
                        "text-charcoal",
                        "dark:text-white",
                        "focus:outline-none",
                        "focus:border-primary",
                        "transition-all",
                      )}
                      value={activeSlot?.width || 120}
                      onChange={(e) =>
                        setActiveSlot({
                          ...activeSlot!,
                          width: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className={clsx(
                        "text-[9px]",
                        "text-slate-500",
                        "uppercase",
                      )}
                    >
                      Height
                    </label>
                    <input
                      type="number"
                      className={clsx(
                        "w-full",
                        "p-3",
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "border",
                        "border-slate-200",
                        "dark:border-white/10",
                        "rounded-lg",
                        "text-charcoal",
                        "dark:text-white",
                        "focus:outline-none",
                        "focus:border-primary",
                        "transition-all",
                      )}
                      value={activeSlot?.height || 80}
                      onChange={(e) =>
                        setActiveSlot({
                          ...activeSlot!,
                          height: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Physical Specs */}
              <div className={clsx("grid", "grid-cols-2", "gap-4")}>
                <div className="space-y-4">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-400",
                      "uppercase",
                      "tracking-[0.4em]",
                    )}
                  >
                    Size (SQM)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className={clsx(
                      "w-full",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-xl",
                      "text-charcoal",
                      "dark:text-white",
                      "focus:outline-none",
                      "focus:border-primary",
                      "transition-all",
                    )}
                    value={activeSlot?.sqm_size || ""}
                    onChange={(e) =>
                      setActiveSlot({
                        ...activeSlot!,
                        sqm_size: parseFloat(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-4">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-400",
                      "uppercase",
                      "tracking-[0.4em]",
                    )}
                  >
                    Monthly Rent
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className={clsx(
                      "w-full",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-xl",
                      "text-charcoal",
                      "dark:text-white",
                      "focus:outline-none",
                      "focus:border-primary",
                      "transition-all",
                    )}
                    value={activeSlot?.base_rent || ""}
                    onChange={(e) =>
                      setActiveSlot({
                        ...activeSlot!,
                        base_rent: parseFloat(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4">
                <label
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "text-slate-400",
                    "uppercase",
                    "tracking-[0.4em]",
                  )}
                >
                  Status
                </label>
                <div
                  className={clsx(
                    "grid",
                    "grid-cols-2",
                    "sm:grid-cols-4",
                    "gap-3",
                  )}
                >
                  {["AVAILABLE", "OCCUPIED", "MAINTENANCE", "RESERVED"].map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setActiveSlot({
                            ...activeSlot!,
                            status: status as any,
                          })
                        }
                        className={clsx(
                          "p-3 rounded-xl border text-[10px] font-black tracking-[0.1em] transition-all",
                          activeSlot?.status === status
                            ? "bg-primary border-primary text-white"
                            : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:text-charcoal dark:hover:text-white",
                        )}
                      >
                        {status}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Images */}
              <div className="space-y-4">
                <div
                  className={clsx("flex", "justify-between", "items-center")}
                >
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-400",
                      "uppercase",
                      "tracking-[0.4em]",
                    )}
                  >
                    Images ({activeSlot?.space_images?.length || 0}/10)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      isUploading ||
                      (activeSlot?.space_images?.length || 0) >= 10
                    }
                    className={clsx(
                      "text-[10px]",
                      "text-primary",
                      "font-black",
                      "uppercase",
                      "tracking-widest",
                      "hover:underline",
                      "flex",
                      "items-center",
                      "gap-1",
                      "disabled:opacity-50",
                      "disabled:cursor-not-allowed",
                    )}
                  >
                    {isUploading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </button>
                </div>

                <div className={clsx("grid", "grid-cols-3", "gap-3")}>
                  {activeSlot?.space_images?.map((img: string, i: number) => (
                    <div
                      key={i}
                      className={clsx(
                        "relative",
                        "aspect-square",
                        "rounded-xl",
                        "overflow-hidden",
                        "border",
                        "border-slate-200",
                        "dark:border-white/10",
                      )}
                    >
                      <img
                        src={img}
                        className={clsx("w-full", "h-full", "object-cover")}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = [
                            ...(activeSlot?.space_images || []),
                          ];
                          newImages.splice(i, 1);
                          setActiveSlot({
                            ...activeSlot!,
                            space_images: newImages,
                          });
                        }}
                        className={clsx(
                          "absolute",
                          "inset-0",
                          "bg-red-500/90",
                          "flex",
                          "items-center",
                          "justify-center",
                          "opacity-0",
                          "hover:opacity-100",
                          "transition-all",
                          "text-white",
                        )}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className={clsx("flex", "gap-4", "pt-4")}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={clsx(
                    "flex-1",
                    "py-3",
                    "bg-slate-100",
                    "dark:bg-white/5",
                    "hover:bg-slate-200",
                    "dark:hover:bg-white/10",
                    "text-slate-500",
                    "dark:text-slate-400",
                    "font-bold",
                    "uppercase",
                    "tracking-widest",
                    "text-xs",
                    "rounded-xl",
                    "transition-all",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={clsx(
                    "flex-1",
                    "py-3",
                    "bg-primary",
                    "hover:bg-primary-hover",
                    "text-white",
                    "font-black",
                    "uppercase",
                    "tracking-[0.3em]",
                    "text-xs",
                    "rounded-xl",
                    "transition-all",
                    "shadow-lg",
                    "shadow-primary/30",
                  )}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Space Previews Modal via Eye Click */}
      {previewSlot && (
        <SpaceDetailModal
          slot={previewSlot as any}
          onClose={() => setPreviewSlot(null)}
        />
      )}
    </div>
  );
}
