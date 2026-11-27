"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cn } from "@cloudflare/kumo";
import { Minus, Plus } from "@phosphor-icons/react";
import type { AreaSlot } from "@srmall/database";
import { CANVAS, placeUnits, type FloorLayout } from "@/lib/floor-layout";
import { slotAccess } from "@/lib/slot-live";

const LOOK = {
  AVAILABLE: { box: "border-kumo-success", text: "text-kumo-success", word: "Available" },
  RESERVED: { box: "border-kumo-warning", text: "text-kumo-warning", word: "Pending" },
  TAKEN: { box: "border-kumo-line bg-kumo-recessed", text: "text-kumo-subtle", word: "Not available" },
};

const lookOf = (status: string) => (status === "AVAILABLE" || status === "RESERVED" ? LOOK[status] : LOOK.TAKEN);

/**
 * One floor as visitors see it: units where the office placed them, over the
 * floor plan picture if there is one. Read only; it fits the screen width.
 */
export function PublicFloorMap({
  units,
  layout,
  matches,
  viewerId,
  onOpen,
}: {
  /** Every unit on this floor, in unit-number order. */
  units: AreaSlot[];
  layout: FloorLayout;
  /** Ids that fit the search and filters; other open units are faded. */
  matches: Set<string>;
  viewerId?: string | null;
  /** Called for available and pending units (the page explains pending ones). */
  onOpen: (unit: AreaSlot) => void;
}) {
  const [room, setRoom] = useState(CANVAS.width);
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState<{ url: string; value: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

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

  const places = placeUnits(units, layout.arranged);
  const planUrl = layout.planUrl;
  const bottom = Object.values(places).reduce((most, box) => Math.max(most, box.y + box.height), 0);
  const planHeight = planUrl && ratio?.url === planUrl ? CANVAS.width * ratio.value : 0;
  const height = planHeight ? Math.max(planHeight, bottom) : bottom + 50;
  const scale = (Math.max(room, 260) * zoom) / CANVAS.width;

  return (
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kumo-line px-4 py-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {Object.values(LOOK).map((look) => (
            <li key={look.word} className="flex items-center gap-1.5 text-kumo-default">
              <span aria-hidden className={cn("size-3.5 rounded-sm border-2", look.box)} />
              {look.word}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" shape="square" icon={<Minus />} aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} />
          <span className="w-12 text-center text-sm text-kumo-subtle">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="secondary" shape="square" icon={<Plus />} aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))} />
        </div>
      </div>

      <div ref={frame} className="max-h-[70dvh] overflow-auto p-3 sm:p-4">
        <div className="relative overflow-hidden" style={{ width: CANVAS.width * scale, height: height * scale }}>
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
              onLoad={(e) => setRatio({ url: planUrl, value: e.currentTarget.naturalHeight / e.currentTarget.naturalWidth })}
            />
          )}
          {units.map((unit) => {
            const box = places[unit.id];
            const look = lookOf(unit.status);
            const open = look !== LOOK.TAKEN;
            const word = slotAccess(unit, viewerId).mine ? "Yours" : look.word;
            const [wide, tall] = [box.width * scale, box.height * scale];
            const label = `Unit ${unit.unit_id}, ${unit.sqm_size} sqm, ${word}`;
            const Tile = open ? "button" : "div";
            return (
              <Tile
                key={unit.id}
                {...(open ? { type: "button" as const, onClick: () => onOpen(unit), "aria-label": label } : {})}
                title={label}
                className={cn(
                  "absolute flex flex-col items-center justify-center overflow-hidden rounded-md border-2 bg-kumo-base px-0.5 text-center leading-tight",
                  look.box,
                  open && "cursor-pointer hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  open && !matches.has(unit.id) && "opacity-35",
                )}
                style={{ left: box.x * scale, top: box.y * scale, width: wide, height: tall, fontSize: Math.max(8, Math.min(14, 16 * scale)) }}
              >
                <span className="max-w-full truncate font-semibold text-kumo-default">{unit.unit_id}</span>
                {wide >= 70 && tall >= 48 && (
                  <>
                    <span className="max-w-full truncate text-[0.85em] text-kumo-subtle">{unit.sqm_size} sqm</span>
                    <span className={cn("max-w-full truncate text-[0.85em] font-medium", look.text)}>{word}</span>
                  </>
                )}
              </Tile>
            );
          })}
        </div>
      </div>

      <p className="border-t border-kumo-line px-4 py-2 text-sm text-kumo-subtle">
        {layout.arranged ? "Tap an available unit to see its details." : "Units are shown in number order, not their exact place on the floor. Tap an available unit to see its details."}
      </p>
    </div>
  );
}
