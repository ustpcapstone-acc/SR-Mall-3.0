const FLOOR_LABELS: Record<string, string> = {
  ground: "Ground floor",
  first: "1st floor",
  second: "2nd floor",
};

/** "ground" to "Ground floor"; unknown values are shown as stored. */
export function floorLabel(floor?: string | null): string {
  const key = (floor || "").trim();
  return key ? FLOOR_LABELS[key] || `${key.charAt(0).toUpperCase()}${key.slice(1)} floor` : "";
}
