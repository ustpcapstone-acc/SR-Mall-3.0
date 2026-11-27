import { prisma } from "@srmall/database";
import type { Floor } from "@/lib/floors";
import type { FloorLayout } from "@/lib/floor-layout";

/** Every floor, from the bottom up. */
export const listFloors = (): Promise<Floor[]> =>
  prisma.floor.findMany({ orderBy: { level: "asc" }, select: { id: true, name: true, level: true } });

/** Which floors were arranged by hand, and their floor plan pictures, by floor id. */
export async function listFloorLayouts(): Promise<Record<string, FloorLayout>> {
  const floors = await prisma.floor.findMany({ select: { id: true, arranged: true, planUrl: true } });
  return Object.fromEntries(floors.map(({ id, arranged, planUrl }) => [id, { arranged, planUrl }]));
}
