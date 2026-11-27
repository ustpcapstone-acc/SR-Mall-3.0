/**
 * Floor Spaces & Map: where each unit is drawn. Positions are in floor units:
 * every floor is 1000 wide, whatever the screen, and as tall as it needs to be.
 */
export const CANVAS = { width: 1000, minHeight: 640, maxHeight: 4000, snap: 10 };

export const UNIT_BOX = { width: 120, height: 80, minWidth: 40, minHeight: 30, maxWidth: 600, maxHeight: 400 };

export type Box = { x: number; y: number; width: number; height: number };

export type FloorLayout = { arranged: boolean; planUrl: string | null };

export const AUTO_LAYOUT: FloorLayout = { arranged: false, planUrl: null };

/** x and y of a unit that hasn't been dragged into place (new, or moved from another floor). */
export const NOT_PLACED = -1;

const between = (value: number, low: number, high: number) => Math.min(Math.max(Math.round(value), low), high);

/** Keeps a unit a sensible size and inside the floor. */
export function clampBox(box: Box): Box {
  const width = between(box.width, UNIT_BOX.minWidth, UNIT_BOX.maxWidth);
  const height = between(box.height, UNIT_BOX.minHeight, UNIT_BOX.maxHeight);
  return { x: between(box.x, 0, CANVAS.width - width), y: between(box.y, 0, CANVAS.maxHeight - height), width, height };
}

/** The automatic line-up: six units to a row. */
const lineUp = (index: number, top: number): Box => ({
  x: 50 + (index % 6) * 150,
  y: top + Math.floor(index / 6) * 120,
  width: UNIT_BOX.width,
  height: UNIT_BOX.height,
});

/**
 * Where to draw each unit of one floor, given in unit-number order. On an
 * arranged floor, units without a saved place are lined up underneath and
 * marked `placed: false`.
 */
export function placeUnits(
  units: { id: string; x?: number; y?: number; width?: number; height?: number }[],
  arranged: boolean,
) {
  const places: Record<string, Box & { placed: boolean }> = {};
  if (!arranged) {
    units.forEach((unit, i) => (places[unit.id] = { ...lineUp(i, 50), placed: true }));
    return places;
  }
  let bottom = 0;
  const loose: string[] = [];
  for (const unit of units) {
    const { x = NOT_PLACED, y = NOT_PLACED } = unit;
    if (x < 0 || y < 0) {
      loose.push(unit.id);
      continue;
    }
    const box = clampBox({ x, y, width: unit.width || UNIT_BOX.width, height: unit.height || UNIT_BOX.height });
    places[unit.id] = { ...box, placed: true };
    bottom = Math.max(bottom, box.y + box.height);
  }
  loose.forEach((id, i) => (places[id] = { ...lineUp(i, bottom + 40), placed: false }));
  return places;
}

/** A floor plan picture uploaded through the app (or none). */
export const isPlanUrl = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && value.length <= 1000 && /^(https:\/\/|\/uploads\/floor-plans\/)/.test(value));
