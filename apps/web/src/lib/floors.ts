/** A mall floor. `AreaSlot.floor` holds the id; `level` orders them from the bottom up. */
export type Floor = { id: string; name: string; level: number };

/** The floors every mall database starts with. Shown until the saved list arrives. */
export const DEFAULT_FLOORS: Floor[] = [
  { id: "ground", name: "Ground Floor", level: 0 },
  { id: "first", name: "1st Floor", level: 1 },
  { id: "second", name: "2nd Floor", level: 2 },
];

export const FLOOR_LIMITS = { minLevel: -5, maxLevel: 200, nameLength: 40, perAdd: 30 };

const ordinal = (n: number) => {
  const tail = n % 100;
  const suffix = tail >= 11 && tail <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};

/** 0 is "Ground Floor", 3 is "3rd Floor", -1 is "Basement 1". */
export function defaultFloorName(level: number) {
  if (level === 0) return "Ground Floor";
  return level < 0 ? `Basement ${-level}` : `${ordinal(level)} Floor`;
}

/** The id a new floor at this level gets. */
export const floorIdFor = (level: number) => DEFAULT_FLOORS.find((f) => f.level === level)?.id ?? `floor-${level}`;

/**
 * The name of a floor from its id. A floor that has since been removed (it can
 * still show in Tenant History) is named from the id.
 */
export function floorLabel(id?: string | null, floors: Floor[] = DEFAULT_FLOORS): string {
  const key = (id || "").trim();
  if (!key) return "";
  const known = floors.find((f) => f.id === key) ?? DEFAULT_FLOORS.find((f) => f.id === key);
  if (known) return known.name;
  const numbered = /^floor-(-?\d+)/.exec(key);
  return numbered ? defaultFloorName(Number(numbered[1])) : `${key.charAt(0).toUpperCase()}${key.slice(1)} floor`;
}
