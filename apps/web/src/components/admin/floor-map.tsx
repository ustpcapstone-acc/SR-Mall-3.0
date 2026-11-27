"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, cn } from "@cloudflare/kumo";
import { ArrowsOutCardinal, FloppyDisk, ImageSquare } from "@phosphor-icons/react";
import { saveFloorLayoutAction } from "@/app/actions/floors";
import { DraftNote } from "@/components/drafts/draft-note";
import { CANVAS, clampBox, placeUnits, type Box, type FloorLayout } from "@/lib/floor-layout";
import { useDraft } from "@/lib/drafts/use-draft";

type MapUnit = { id: string; unit_id: string; x?: number; y?: number; width?: number; height?: number };

/** How one unit looks on the map. */
export type MapTile = {
  color: string;
  /** Read out by screen readers. */
  label: string;
  title?: string;
  /** Lines under the unit number, shown when the tile is big enough. */
  lines: string[];
  icon: React.ReactNode;
};

type Work = { boxes: Record<string, Box>; planUrl: string | null };

type Drag = { id: string; mode: "move" | "size"; fromX: number; fromY: number; box: Box };

const snap = (value: number) => Math.round(value / CANVAS.snap) * CANVAS.snap;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * One floor's map. It fits the width of the screen (zoom to enlarge), and
 * "Arrange units" lets the office drag units into place over a floor plan.
 */
export function FloorMap({
  floorId,
  units,
  shown,
  layout,
  pickedId,
  onPick,
  zoom,
  showGrid,
  className,
  tile,
  onSaved,
}: {
  floorId: string;
  /** Every unit on this floor, in unit-number order. */
  units: MapUnit[];
  /** Ids that match the search and category. All show while arranging. */
  shown: Set<string>;
  layout: FloorLayout;
  pickedId: string | null;
  onPick: (id: string) => void;
  zoom: number;
  showGrid: boolean;
  className?: string;
  tile: (id: string) => MapTile;
  onSaved: () => void | Promise<void>;
}) {
  const [start, setStart] = useState<Work | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [ask, setAsk] = useState<"discard" | "automatic" | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ratio, setRatio] = useState<{ url: string; value: number } | null>(null);
  const [room, setRoom] = useState(CANVAS.width);
  const frame = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const arranging = Boolean(work);

  const draft = useDraft({
    form: "admin.floor-layout",
    scope: [floorId],
    enabled: arranging,
    editing: true,
    value: work,
    initial: start,
    onRestore: (saved) => saved && setWork({ boxes: { ...start?.boxes, ...saved.boxes }, planUrl: saved.planUrl }),
  });

  // The map follows the width of its panel, so it also fits a phone.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setRoom(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);

  const saved = placeUnits(units, layout.arranged);
  const boxOf = (id: string): Box => work?.boxes[id] ?? saved[id];
  const planUrl = work ? work.planUrl : layout.planUrl;
  const visible = arranging ? units : units.filter((u) => shown.has(u.id));
  const unplaced = units.filter((u) => saved[u.id] && !saved[u.id].placed).length;

  const bottom = units.reduce((most, u) => Math.max(most, boxOf(u.id).y + boxOf(u.id).height), 0);
  const planHeight = planUrl && ratio?.url === planUrl ? CANVAS.width * ratio.value : 0;
  const height = planHeight ? Math.max(planHeight, bottom) : Math.max(CANVAS.minHeight, bottom + 40);
  const scale = (Math.max(room, 260) * zoom) / CANVAS.width;

  const begin = () => {
    const boxes = Object.fromEntries(
      units.map((u) => {
        const { x, y, width, height: tall } = saved[u.id];
        return [u.id, { x, y, width, height: tall }];
      }),
    );
    const initial = { boxes, planUrl: layout.planUrl };
    setAsk(null);
    setStart(initial);
    setWork(initial);
  };

  const finish = () => {
    drag.current = null;
    setAsk(null);
    setWork(null);
    setStart(null);
  };

  const move = (id: string, box: Box) =>
    setWork((current) => current && { ...current, boxes: { ...current.boxes, [id]: clampBox(box) } });

  const cancel = () => {
    if (ask !== "discard" && JSON.stringify(work) !== JSON.stringify(start)) return setAsk("discard");
    draft.discard();
    finish();
  };

  /** `arranged` false goes back to the automatic line-up; the picture stays. */
  const save = async (arranged: boolean) => {
    if (!work || saving) return;
    setSaving(true);
    try {
      const res = await draft.send(() =>
        saveFloorLayoutAction(floorId, {
          arranged,
          planUrl: work.planUrl,
          units: arranged ? units.map((u) => ({ id: u.id, ...boxOf(u.id) })) : [],
        }),
      );
      if (!res) return;
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      draft.clear();
      await onSaved();
      toast.success(arranged ? "Floor layout saved" : "Units are lined up automatically");
      finish();
    } catch {
      toast.error("Couldn't save the layout. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picture = e.target.files?.[0];
    e.target.value = "";
    if (!picture) return;
    setUploading(true);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const result = await getCloudStorageProvider().uploadFile(picture, "floor-plans");
      setWork((current) => current && { ...current, planUrl: result.url });
    } catch {
      toast.error("Couldn't upload the picture. Use a JPG, PNG or WEBP and try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── dragging ────────────────────────────────────────────────────────────────
  const grab = (e: React.PointerEvent<HTMLElement>, id: string, mode: Drag["mode"]) => {
    if (!arranging || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    onPick(id);
    drag.current = { id, mode, fromX: e.clientX, fromY: e.clientY, box: boxOf(id) };
  };
  const dragging = (e: React.PointerEvent) => {
    const held = drag.current;
    if (!held) return;
    const dx = (e.clientX - held.fromX) / scale;
    const dy = (e.clientY - held.fromY) / scale;
    // A plain tap selects the unit without nudging it onto the grid.
    if (Math.abs(e.clientX - held.fromX) + Math.abs(e.clientY - held.fromY) < 3) return;
    move(
      held.id,
      held.mode === "move"
        ? { ...held.box, x: snap(held.box.x + dx), y: snap(held.box.y + dy) }
        : { ...held.box, width: snap(held.box.width + dx), height: snap(held.box.height + dy) },
    );
  };
  const release = () => {
    drag.current = null;
  };

  /** Arrow keys move a unit; with Alt they resize it; Shift takes bigger steps. */
  const nudge = (e: React.KeyboardEvent, id: string) => {
    const direction = ARROWS[e.key];
    if (!arranging || !direction) return;
    e.preventDefault();
    const step = e.shiftKey ? CANVAS.snap * 5 : CANVAS.snap;
    const box = boxOf(id);
    const [dx, dy] = [direction[0] * step, direction[1] * step];
    move(id, e.altKey ? { ...box, width: box.width + dx, height: box.height + dy } : { ...box, x: box.x + dx, y: box.y + dy });
  };

  return (
    <>
      <div className="space-y-2 border-b border-kumo-line px-4 py-2 sm:px-5">
        {!arranging ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-kumo-subtle">
              {unplaced > 0
                ? `${unplaced} unit${unplaced === 1 ? " isn't" : "s aren't"} placed yet. Choose Arrange units to position ${unplaced === 1 ? "it" : "them"}.`
                : layout.arranged
                  ? "Arranged by the mall office."
                  : "Units are lined up automatically."}
            </p>
            <Button size="sm" variant="secondary" icon={<ArrowsOutCardinal />} onClick={begin}>
              Arrange units
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-kumo-default">
              Drag a unit to move it, or drag its corner to resize. With a keyboard, use the arrow keys, and hold Alt to resize.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPlan} className="sr-only" tabIndex={-1} aria-label="Upload a floor plan picture" />
              <Button size="sm" variant="secondary" icon={<ImageSquare />} loading={uploading} onClick={() => file.current?.click()}>
                {planUrl ? "Change floor plan" : "Add floor plan picture"}
              </Button>
              {planUrl && (
                <Button size="sm" variant="secondary" onClick={() => setWork((current) => current && { ...current, planUrl: null })}>
                  Remove picture
                </Button>
              )}
              {layout.arranged && (
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => setAsk("automatic")}>
                  Line up automatically
                </Button>
              )}
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" disabled={saving} onClick={cancel}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" icon={<FloppyDisk />} loading={saving} disabled={uploading} onClick={() => save(true)}>
                  Save layout
                </Button>
              </span>
            </div>
            {ask && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-kumo-warning-tint p-2">
                <p className="mr-auto text-sm text-kumo-default">
                  {ask === "discard"
                    ? "Discard the changes you haven't saved?"
                    : "Forget the saved positions on this floor and line units up automatically?"}
                </p>
                <Button size="sm" variant="destructive" loading={saving} onClick={() => (ask === "discard" ? cancel() : save(false))}>
                  {ask === "discard" ? "Discard" : "Line up"}
                </Button>
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => setAsk(null)}>
                  Keep
                </Button>
              </div>
            )}
            <DraftNote draft={draft} />
          </>
        )}
      </div>

      <div ref={frame} className={cn("overflow-auto p-3 sm:p-4", className)}>
        <div
          className="relative overflow-hidden rounded-lg border border-dashed border-kumo-line"
          style={{ width: CANVAS.width * scale, height: height * scale }}
        >
          {planUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={planUrl}
              alt="Floor plan"
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 w-full select-none"
              // A picture that is already cached has loaded before onLoad can fire.
              ref={(img) => {
                if (img?.complete && img.naturalWidth && ratio?.url !== planUrl) {
                  setRatio({ url: planUrl, value: img.naturalHeight / img.naturalWidth });
                }
              }}
              onLoad={(e) =>
                setRatio({ url: planUrl, value: e.currentTarget.naturalHeight / e.currentTarget.naturalWidth })
              }
            />
          )}
          {showGrid && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 text-kumo-subtle opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                backgroundSize: `${20 * scale}px ${20 * scale}px`,
              }}
            />
          )}
          {visible.map((unit) => {
            const box = boxOf(unit.id);
            const { color, label, title, lines, icon } = tile(unit.id);
            const [wide, tall] = [box.width * scale, box.height * scale];
            const picked = unit.id === pickedId;
            const placed = arranging || saved[unit.id].placed;
            return (
              <div
                key={unit.id}
                className={cn("absolute", picked && "z-10")}
                style={{ left: box.x * scale, top: box.y * scale, width: wide, height: tall }}
              >
                <button
                  type="button"
                  onClick={() => onPick(unit.id)}
                  onPointerDown={(e) => grab(e, unit.id, "move")}
                  onPointerMove={dragging}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onKeyDown={(e) => nudge(e, unit.id)}
                  aria-pressed={picked}
                  aria-label={label}
                  title={title}
                  className={cn(
                    "flex size-full flex-col justify-between overflow-hidden rounded-md border-2 bg-kumo-base text-left leading-tight hover:shadow-md sm:rounded-lg",
                    arranging ? "cursor-move touch-none select-none" : "cursor-pointer",
                    !placed && "border-dashed",
                    picked && "ring-2 ring-kumo-brand ring-offset-1",
                    tall >= 52 ? "p-1.5 sm:p-2" : "justify-center px-0.5",
                  )}
                  style={{
                    borderColor: color,
                    // Opaque, so a floor plan underneath doesn't muddle the text.
                    backgroundImage: `linear-gradient(${color}1f, ${color}1f)`,
                    fontSize: Math.max(8, Math.min(14, 16 * scale)),
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="truncate font-semibold text-kumo-default">{unit.unit_id}</span>
                    {wide >= 76 && tall >= 40 && icon}
                  </span>
                  {wide >= 76 && tall >= 52 && (
                    <span className="w-full text-[0.85em] text-kumo-subtle">
                      {lines.map((line, i) => (
                        <span key={i} className="block truncate">
                          {line}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
                {arranging && (
                  <span
                    aria-hidden
                    onPointerDown={(e) => grab(e, unit.id, "size")}
                    onPointerMove={dragging}
                    onPointerUp={release}
                    onPointerCancel={release}
                    className="absolute -bottom-1 -right-1 size-4 cursor-nwse-resize touch-none rounded-sm border-2 border-kumo-base bg-kumo-brand"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
